/* Starship V3 — pas de tir de Starbase (Three.js)
   Tour de lancement et de capture « Mechazilla » d'après les photos : treillis en X avec goussets,
   escaliers intérieurs, plateformes, coiffe bardée, chariot et bras « chopsticks » avec rails de capture,
   amortisseurs, bras de service, table de lancement, éclairages de la tour et projecteurs au sol.
   1 unité = 10 m. Le pied de la tour est à y = 0 dans le groupe renvoyé. */
import * as THREE from 'three';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export const TOWER_H = 14.6;   // ≈ 146 m
export const TOWER_W = 1.4;    // section carrée
const BAY = 0.8;               // hauteur d'une travée

/* ---------- poutres instanciées : une boîte étirée entre deux points ---------- */
class Beams {
  constructor() { this.m = []; }
  add(a, b, w, h = w, roll = 0) {
    const A = a instanceof THREE.Vector3 ? a : new THREE.Vector3(...a);
    const B = b instanceof THREE.Vector3 ? b : new THREE.Vector3(...b);
    const d = new THREE.Vector3().subVectors(B, A), L = d.length();
    if (L < 1e-5) return;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll));
    const mx = new THREE.Matrix4().compose(A.clone().lerp(B, 0.5), q, new THREE.Vector3(w, L, h));
    this.m.push(mx);
  }
  box(c, s) { this.m.push(new THREE.Matrix4().compose(new THREE.Vector3(...c), new THREE.Quaternion(), new THREE.Vector3(...s))); }
  build(mat) {
    const inst = new THREE.InstancedMesh(UNIT, mat, this.m.length);
    this.m.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    return inst;
  }
}
const UNIT = new THREE.BoxGeometry(1, 1, 1);

/* ---------- textures ---------- */
function ribTexture(seed, base = 70, w = 256, h = 512) {
  const c = cnv(w, h), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = `rgb(${base},${base + 2},${base + 6})`; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 8) { const k = base - 22 + r() * 14 | 0; g.fillStyle = `rgb(${k},${k + 1},${k + 4})`; g.fillRect(x, 0, 3, h); }
  for (let y = 0; y < h; y += 64) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, y, w, 3); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${90 + r() * 60 | 0},${60 + r() * 30 | 0},40,${0.08 + r() * 0.1})`; g.fillRect(r() * w, r() * h, 2 + r() * 10, 20 + r() * 120); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function concreteTexture() {
  const S = 1024, c = cnv(S, S), g = c.getContext('2d'), r = rng(31);
  g.fillStyle = '#4a4744'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { const k = 50 + r() * 40 | 0; g.fillStyle = `rgba(${k},${k - 2},${k - 5},.25)`; g.fillRect(r() * S, r() * S, 1 + r() * 4, 1 + r() * 4); }
  g.strokeStyle = 'rgba(20,18,16,.5)'; g.lineWidth = 2;
  for (let x = 0; x <= S; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(S, x); g.stroke(); }
  // brûlures autour de la table de lancement
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.32);
  gr.addColorStop(0, 'rgba(12,10,9,.85)'); gr.addColorStop(0.6, 'rgba(25,20,16,.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function fadeTex(k) {
  const c = cnv(256, 256), g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, '#fff'); gr.addColorStop(k, '#fff'); gr.addColorStop(1, '#000');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
export function glowTexture(inner = 'rgba(255,236,200,1)', mid = 'rgba(255,190,110,.45)') {
  const c = cnv(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.18, mid); gr.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/* ==================================================================
   BRAS « CHOPSTICKS » : treillis triangulaire, rail de capture, amortisseur
   ================================================================== */
function buildArm(M, side, L) {
  // side = +1 (bras côté caméra, z>0) ou -1 ; le bras part de x = 0 vers +x
  const g = new THREE.Group();
  const B = new Beams(), Bl = new Beams();
  const zi = -side * 0.09, zo = side * 0.09;               // membrures supérieures (intérieure / extérieure)
  const depth = (x) => 0.62 - 0.4 * (x / L);                // profondeur du treillis, plus forte à la racine
  const N = 9;
  for (let i = 0; i < N; i++) {
    const x0 = (i / N) * L, x1 = ((i + 1) / N) * L;
    B.add([x0, 0, zi], [x1, 0, zi], 0.07);
    B.add([x0, 0, zo], [x1, 0, zo], 0.07);
    B.add([x0, -depth(x0), 0], [x1, -depth(x1), 0], 0.08);   // membrure inférieure
    // montants et diagonales (motif en V)
    B.add([x0, 0, zi], [x0, -depth(x0), 0], 0.04);
    B.add([x0, 0, zo], [x0, -depth(x0), 0], 0.04);
    B.add([x0, 0, zi], [x0, 0, zo], 0.035);
    if (i % 2 === 0) { B.add([x0, -depth(x0), 0], [x1, 0, zi], 0.035); B.add([x0, -depth(x0), 0], [x1, 0, zo], 0.035); }
    else { B.add([x0, 0, zi], [x1, -depth(x1), 0], 0.035); B.add([x0, 0, zo], [x1, -depth(x1), 0], 0.035); }
  }
  B.add([L, 0, zi], [L, -depth(L), 0], 0.05); B.add([L, 0, zo], [L, -depth(L), 0], 0.05); B.add([L, 0, zi], [L, 0, zo], 0.05);
  // grand contreventement triangulaire au-dessus de la racine (silhouette des photos)
  B.add([0.05, 0, zo], [0.55, 0.42, 0], 0.06); B.add([0.05, 0, zi], [0.55, 0.42, 0], 0.06);
  B.add([0.55, 0.42, 0], [1.25, 0, zo], 0.05); B.add([0.55, 0.42, 0], [1.25, 0, zi], 0.05);
  B.add([0.55, 0.42, 0], [0.55, 0, 0], 0.04);
  // passerelle et garde-corps sur l'extérieur
  for (let x = 0.2; x < L - 0.05; x += 0.16) Bl.add([x, 0.03, zo], [x, 0.13, zo + side * 0.02], 0.012);
  Bl.add([0.2, 0.13, zo + side * 0.02], [L - 0.1, 0.13, zo + side * 0.02], 0.012);
  g.add(B.build(M.arm));
  g.add(Bl.build(M.rail));
  // rail de capture (sur lequel se posent les ergots du vaisseau)
  const rail = new THREE.Mesh(new THREE.BoxGeometry(L * 0.62, 0.05, 0.075), M.catchRail);
  rail.position.set(L * 0.6, 0.06, zi - side * 0.045); g.add(rail);
  for (let x = L * 0.32; x < L * 0.9; x += 0.1) {
    const s = new THREE.Mesh(UNIT, M.dark); s.scale.set(0.012, 0.012, 0.08); s.position.set(x, 0.09, zi - side * 0.045); g.add(s);
  }
  // carénage / amortisseur blanc à la racine (visible sur la photo 1)
  const shock = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.16), M.white);
  shock.position.set(0.28, 0.1, zi * 0.6); g.add(shock);
  const shock2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 10), M.rail);
  shock2.rotation.z = Math.PI / 2; shock2.position.set(0.55, 0.06, zi); g.add(shock2);
  // charnière
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 16), M.arm);
  hinge.position.set(0, -0.3, 0); g.add(hinge);
  // feu de position en bout de bras
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), M.lampRed); tip.position.set(L, 0.05, zo); g.add(tip);
  g.userData.tip = tip;
  return g;
}

/* ==================================================================
   TOUR
   ================================================================== */
export function createPad(opts = {}) {
  const pad = new THREE.Group();
  const H = TOWER_H, W = TOWER_W, h = W / 2;
  const r = rng(97);

  const ribs = ribTexture(4, 86);
  const M = {
    steel: new THREE.MeshStandardMaterial({ color: 0x6a6e74, metalness: 0.6, roughness: 0.58, envMapIntensity: 0.55 }),
    steelD: new THREE.MeshStandardMaterial({ color: 0x45484d, metalness: 0.55, roughness: 0.6, envMapIntensity: 0.5 }),
    arm: new THREE.MeshStandardMaterial({ color: 0x24262a, metalness: 0.55, roughness: 0.5, envMapIntensity: 0.5 }),
    rail: new THREE.MeshStandardMaterial({ color: 0x9a9ea4, metalness: 0.7, roughness: 0.35 }),
    catchRail: new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.9, roughness: 0.25 }),
    white: new THREE.MeshStandardMaterial({ color: 0xd8d9da, metalness: 0.1, roughness: 0.55 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x16171a, metalness: 0.3, roughness: 0.8 }),
    grate: new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.4, roughness: 0.7 }),
    clad: new THREE.MeshStandardMaterial({ map: ribs, color: 0x9a9ea4, metalness: 0.5, roughness: 0.6, envMapIntensity: 0.5 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x8a8580, metalness: 0, roughness: 0.95 }),
    lampWarm: new THREE.MeshBasicMaterial({ color: 0xfff1d6, toneMapped: false }),
    lampRed: new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false }),
  };
  ribs.repeat.set(3, 1);

  const tower = new THREE.Group(); pad.add(tower);
  const S = new Beams(), T = new Beams(), D = new Beams(), G = new Beams();
  const nb = Math.round(H / BAY);
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h]];
  // colonnes d'angle (doubles, comme sur les photos)
  corners.forEach(([x, z]) => {
    S.add([x, 0, z], [x, H, z], 0.15);
    S.add([x - Math.sign(x) * 0.13, 0, z], [x - Math.sign(x) * 0.13, H, z], 0.07, 0.1);
  });
  // colonnes centrales des faces latérales
  S.add([0, 0, -h], [0, H, -h], 0.08); S.add([0, 0, h], [0, H, h], 0.08);
  for (let i = 0; i <= nb; i++) {
    const y = Math.min(H, i * BAY);
    for (let k = 0; k < 4; k++) {
      const [x0, z0] = corners[k], [x1, z1] = corners[(k + 1) % 4];
      S.add([x0, y, z0], [x1, y, z1], 0.085, 0.11);            // poutre de ceinture
      if (i === nb) continue;
      const y1 = y + BAY, ym = y + BAY / 2;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      // croix de Saint-André avec gousset central
      T.add([x0, y + 0.04, z0], [x1, y1 - 0.04, z1], 0.055);
      T.add([x1, y + 0.04, z1], [x0, y1 - 0.04, z0], 0.055);
      G.box([mx, ym, mz], [Math.abs(x1 - x0) > 0.01 ? 0.18 : 0.04, 0.12, Math.abs(z1 - z0) > 0.01 ? 0.18 : 0.04]);
      // chevrons de rive : petites goussets aux nœuds
      G.box([x0, y + 0.05, z0], [0.2, 0.06, 0.2]);
    }
    if (i < nb && i % 2 === 0) {
      // plancher caillebotis sur la moitié arrière + palier
      D.box([0, y + 0.02, -h * 0.45], [W - 0.1, 0.02, W * 0.5]);
      // escalier intérieur en zigzag
      const zS = -h + 0.22;
      D.add([-h + 0.2, y + 0.02, zS], [h - 0.25, y + BAY, zS], 0.03, 0.12);
      D.add([h - 0.25, y + BAY, zS], [-h + 0.2, y + 2 * BAY, zS], 0.03, 0.12);
      D.add([-h + 0.2, y + 0.16, zS + 0.07], [h - 0.25, y + BAY + 0.14, zS + 0.07], 0.012);
      D.add([h - 0.25, y + BAY + 0.14, zS + 0.07], [-h + 0.2, y + 2 * BAY + 0.14, zS + 0.07], 0.012);
    }
  }
  // tuyauteries verticales le long de l'angle arrière droit (photo 4)
  [[h + 0.1, -h + 0.18, 0.035], [h + 0.1, -h + 0.32, 0.025], [h + 0.18, -h + 0.25, 0.03]].forEach(([x, z, w]) => D.add([x, 0, z], [x, H - 1.6, z], w));
  // colliers de tuyauterie
  for (let y = 0.4; y < H - 1.6; y += 0.6) D.box([h + 0.08, y, -h + 0.25], [0.06, 0.03, 0.3]);
  // rails du chariot sur la face avant (+x)
  [-0.45, 0.45].forEach((z) => S.add([h + 0.05, 0.6, z], [h + 0.05, H - 0.3, z], 0.06, 0.1));

  tower.add(S.build(M.steel), T.build(M.steel), G.build(M.steelD), D.build(M.grate));

  /* --- coiffe : local bardé + plateforme et garde-corps --- */
  const cap = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.95, W + 0.12), M.clad);
  cap.position.set(0, H - 0.75, 0); tower.add(cap);
  const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.06, W + 0.3), M.grate); top.position.y = H; tower.add(top);
  const RL = new Beams();
  const rh = h + 0.15;
  for (let k = 0; k < 4; k++) {
    const [x0, z0] = corners[k].map((v) => Math.sign(v) * rh), [x1, z1] = corners[(k + 1) % 4].map((v) => Math.sign(v) * rh);
    RL.add([x0, H + 0.13, z0], [x1, H + 0.13, z1], 0.015); RL.add([x0, H + 0.07, z0], [x1, H + 0.07, z1], 0.01);
    for (let t = 0; t <= 1; t += 0.1) RL.add([x0 + (x1 - x0) * t, H, z0 + (z1 - z0) * t], [x0 + (x1 - x0) * t, H + 0.13, z0 + (z1 - z0) * t], 0.012);
  }
  // mât et équipements sur le toit
  RL.add([-h + 0.2, H, -h + 0.2], [-h + 0.2, H + 0.55, -h + 0.2], 0.03);
  RL.add([h - 0.2, H, h - 0.2], [h - 0.2, H + 0.3, h - 0.2], 0.025);
  RL.box([0.2, H + 0.1, -0.3], [0.3, 0.16, 0.24]);
  tower.add(RL.build(M.rail));
  // bardage bas de la tour (photo 2)
  const low = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.4, W * 0.55), M.clad);
  low.position.set(-h - 0.04, 1.8, h * 0.4); tower.add(low);
  const low2 = new THREE.Mesh(new THREE.BoxGeometry(W * 0.5, 3.0, 0.06), M.clad);
  low2.position.set(-h * 0.4, 1.6, -h - 0.04); tower.add(low2);
  // socle en béton tronconique
  const base = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.82, W * 1.25, 0.45, 4, 1), M.concrete);
  base.rotation.y = Math.PI / 4; base.position.y = 0.2; tower.add(base);

  /* --- bras de service (QD) et plateforme intermédiaire --- */
  const qd = new Beams();
  const qy = 4.6, qx0 = h, qx1 = h + 0.75;
  [[qy, -0.4], [qy, 0.4], [qy + 0.45, -0.4], [qy + 0.45, 0.4]].forEach(([y, z]) => qd.add([qx0, y, z], [qx1, y, z], 0.06));
  [-0.4, 0.4].forEach((z) => { qd.add([qx1, qy, z], [qx1, qy + 0.45, z], 0.05); qd.add([qx0, qy, z], [qx1, qy + 0.45, z], 0.04); qd.add([qx0 - 0.02, qy - 0.5, z], [qx1 * 0.9, qy, z], 0.05); });
  qd.add([qx1, qy + 0.45, -0.4], [qx1, qy + 0.45, 0.4], 0.05); qd.add([qx1, qy, -0.4], [qx1, qy, 0.4], 0.05);
  qd.box([(qx0 + qx1) / 2, qy + 0.02, 0], [0.75, 0.025, 0.8]);
  for (let x = qx0 + 0.05; x <= qx1; x += 0.12) qd.add([x, qy + 0.45, -0.42], [x, qy + 0.56, -0.42], 0.01);
  qd.add([qx0, qy + 0.56, -0.42], [qx1, qy + 0.56, -0.42], 0.012);
  // plateforme côté gauche (photo 3, en bas)
  const py = 3.2;
  qd.box([-h - 0.3, py, 0], [0.6, 0.03, W + 0.3]);
  [-h - 0.6].forEach((x) => { qd.add([x, py, -h - 0.15], [x, py, h + 0.15], 0.05); qd.add([x, py, -h - 0.15], [x, py + 0.12, -h - 0.15], 0.012); qd.add([x, py + 0.12, -h - 0.15], [x, py + 0.12, h + 0.15], 0.012); });
  [-h + 0.1, 0, h - 0.1].forEach((z) => qd.add([-h, py - 0.45, z], [-h - 0.6, py, z], 0.04));
  // petites passerelles extérieures (photo 4)
  [[6.3, -1], [8.9, -1], [10.6, 1]].forEach(([y, s]) => { qd.box([0, y, s * (h + 0.18)], [0.5, 0.03, 0.34]); qd.add([-0.25, y, s * (h + 0.35)], [0.25, y, s * (h + 0.35)], 0.012); qd.add([-0.25, y + 0.11, s * (h + 0.35)], [0.25, y + 0.11, s * (h + 0.35)], 0.012); qd.add([0, y - 0.3, s * h], [0, y, s * (h + 0.34)], 0.03); });
  tower.add(qd.build(M.steelD));

  /* --- chariot + bras --- */
  const carriage = new THREE.Group(); tower.add(carriage);
  const CB = new Beams(), ch = 1.05, cw = h + 0.12;
  const cc = [[-cw, -cw], [cw, -cw], [cw, cw], [-cw, cw]];
  cc.forEach(([x, z]) => CB.add([x, -ch, z], [x, 0.15, z], 0.09));
  for (let k = 0; k < 4; k++) {
    const [x0, z0] = cc[k], [x1, z1] = cc[(k + 1) % 4];
    [-ch, -ch / 2, 0.15].forEach((y) => CB.add([x0, y, z0], [x1, y, z1], 0.08));
    CB.add([x0, -ch, z0], [x1, -ch / 2, z1], 0.05); CB.add([x0, -ch / 2, z0], [x1, 0.15, z1], 0.05);
  }
  // blocs de roulement et poulies au sommet du chariot
  [-0.45, 0.45].forEach((z) => { CB.box([cw + 0.04, -0.2, z], [0.12, 0.3, 0.18]); CB.box([cw + 0.04, -ch + 0.15, z], [0.12, 0.3, 0.18]); });
  carriage.add(CB.build(M.arm));
  const armL = 2.75;
  const arms = [1, -1].map((s) => {
    const piv = new THREE.Group(); piv.position.set(cw + 0.08, 0, s * 0.62);
    piv.add(buildArm(M, s, armL)); carriage.add(piv); return piv;
  });
  // câbles de levage du chariot
  const cableMat = new THREE.MeshBasicMaterial({ color: 0x1c1d20 });
  const cables = [-0.3, 0.3].map((z) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), cableMat); c.position.set(h + 0.16, 0, z); tower.add(c); return c; });

  /* --- éclairages --- */
  const glowTex = glowTexture();
  const warm = [], mkGlow = (x, y, z, s, parent = tower) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    sp.position.set(x, y, z); sp.scale.setScalar(s); parent.add(sp);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), M.lampWarm); bulb.position.set(x, y, z); parent.add(bulb);
    warm.push({ sp, bulb, s, ph: r() * 10 }); return sp;
  };
  for (let i = 1; i < nb - 1; i++) {
    const y = i * BAY + BAY * 0.85;
    if (r() < 0.8) mkGlow((r() - 0.5) * W * 0.6, y, (r() - 0.2) * W * 0.5, 0.75 + r() * 0.45);
    if (r() < 0.35) mkGlow(h - 0.05, y - 0.3, (r() - 0.5) * W * 0.7, 0.4);
  }
  // feux d'obstacle rouges au sommet
  const beacons = [[-h, H + 0.6, -h + 0.2], [h - 0.1, H + 0.35, h - 0.2], [h, H - 0.2, -h], [-h, H - 0.2, h]].map(([x, y, z]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M.lampRed.clone()); m.position.set(x, y, z); tower.add(m);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xff3020, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    sp.position.copy(m.position); sp.scale.setScalar(0.9); tower.add(sp); return { m, sp };
  });
  const towerLight = new THREE.PointLight(0xffc98a, 0, 9, 1.6); towerLight.position.set(0, 9, 0.2); tower.add(towerLight);
  const towerLight2 = new THREE.PointLight(0xffc98a, 0, 9, 1.6); towerLight2.position.set(0.2, 4, 0.2); tower.add(towerLight2);

  /* ==================================================================
     SOL, TABLE DE LANCEMENT, PROJECTEURS, PARC DE RÉSERVOIRS
     ================================================================== */
  const site = new THREE.Group(); pad.add(site);
  const cTex = concreteTexture();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshStandardMaterial({ map: cTex, color: 0x8a847c, roughness: 0.95, metalness: 0, transparent: true, alphaMap: fadeTex(0.8) }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(opts.olmX || 0, 0.004, 0); site.add(ground);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(80, 64), new THREE.MeshStandardMaterial({ color: 0x3b3833, roughness: 1, metalness: 0, transparent: true, depthWrite: false, alphaMap: fadeTex(0.35) }));
  soil.rotation.x = -Math.PI / 2; soil.position.set(opts.olmX || 0, -0.002, 0); soil.renderOrder = -1; site.add(soil);

  // table de lancement (OLM) : anneau sur six pieds, à la position de la fusée
  const olm = new THREE.Group(); olm.position.x = opts.olmX || 0; site.add(olm);
  const OH = opts.olmH || 1.9;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.12, 12, 48), M.steelD); ring.rotation.x = Math.PI / 2; ring.position.y = OH - 0.1; olm.add(ring);
  const ringTop = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.16, 48, 1, true), M.steelD); ringTop.position.y = OH - 0.12; olm.add(ringTop);
  const OB = new Beams();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(a) * 0.95, z = Math.sin(a) * 0.95;
    OB.add([x, 0, z], [x * 0.78, OH - 0.15, z * 0.78], 0.22, 0.3);
    OB.add([x * 0.78, OH * 0.55, z * 0.78], [Math.cos(a + Math.PI / 3) * 0.95 * 0.8, OH * 0.55, Math.sin(a + Math.PI / 3) * 0.95 * 0.8], 0.06);
  }
  // pinces de maintien (« clamps ») sur la table
  for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; OB.box([Math.cos(a) * 0.58, OH + 0.02, Math.sin(a) * 0.58], [0.06, 0.08, 0.06]); }
  olm.add(OB.build(M.concrete));
  const deflector = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 0.12, 32), M.steelD); deflector.position.y = 0.06; olm.add(deflector);

  // projecteurs sur mâts
  const flood = [];
  [[4.5, -5.5], [-3.5, -5], [6.5, 4.5]].forEach(([x, z]) => {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 3.2, 8), M.steelD); mast.position.set(x, 1.6, z); site.add(mast);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.08), M.dark); head.position.set(x, 3.22, z); head.lookAt(1, 8, 0); site.add(head);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff0dc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    sp.position.set(x, 3.25, z); sp.scale.setScalar(1.2); site.add(sp); flood.push(sp);
  });
  const spot = new THREE.SpotLight(0xffe7c8, 0, 40, 0.38, 0.7, 1.4); spot.position.set(4.5, 3.3, -5.5); spot.target.position.set(1.2, 10, 0); site.add(spot, spot.target);
  const spot2 = new THREE.SpotLight(0xffe7c8, 0, 40, 0.38, 0.7, 1.4); spot2.position.set(-3.5, 3.3, -5); spot2.target.position.set(0.4, 9, 0); site.add(spot2, spot2.target);

  // parc de réservoirs et bâtiments au loin (photo 2)
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x8e8d8a, metalness: 0.4, roughness: 0.5 });
  const TK = [[-14, 12, 0.45, 2.6], [-15.1, 12, 0.45, 2.6], [-17.5, 10, 0.35, 1.8], [-18.3, 10, 0.35, 1.8], [12, 16, 0.5, 3.0], [13.2, 16, 0.5, 3.0], [-22, 18, 0.6, 1.4]];
  TK.forEach(([x, z, rr, hh]) => {
    x *= 1.6; z *= 1.6;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, hh, 20), tankMat); t.position.set(x, hh / 2, z); site.add(t);
    const d = new THREE.Mesh(new THREE.SphereGeometry(rr, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), tankMat); d.position.set(x, hh, z); site.add(d);
  });
  const hz = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 16), tankMat); hz.rotation.z = Math.PI / 2; hz.position.set(-14, 0.4, 15); site.add(hz);
  const hz2 = hz.clone(); hz2.position.z = 15.8; site.add(hz2);
  const bldMat = new THREE.MeshStandardMaterial({ color: 0x6d5a48, roughness: 0.85 });
  const bld = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, 1.6, 4), bldMat); bld.rotation.y = Math.PI / 4; bld.position.set(-11, 0.8, 26); site.add(bld);
  // colonne de distillation (à droite sur la photo 2)
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 4.2, 16), tankMat); col.position.set(17, 2.1, 30); site.add(col);

  /* ---------- API ---------- */
  let armOpen = 1, armY = 12.6;
  pad.userData = {
    tower, site, carriage, arms, M,
    // ouverture des bras (0 = fermés sur le vaisseau, 1 = grands ouverts)
    setArms(open, y) {
      armOpen = open; armY = y;
      carriage.position.set(0, y, 0);
      arms[0].rotation.y = -open * 1.45;
      arms[1].rotation.y = open * 1.45;
      cables.forEach((c) => { const y0 = y + 0.3, y1 = H - 0.4; c.scale.y = Math.max(0.01, y1 - y0); c.position.y = (y0 + y1) / 2; });
    },
    // nuit : 0 = jour couvert, 1 = heure bleue / nuit, t = temps (clignotements)
    setLights(night, t) {
      const on = clamp(night);
      warm.forEach((w) => { const f = 0.92 + 0.08 * Math.sin(t * 7 + w.ph); w.sp.material.opacity = (0.1 + 0.9 * on) * f; w.bulb.visible = on > 0.05 || true; });
      const blink = (Math.sin(t * 3.2) > 0.2) ? 1 : 0.15;
      beacons.forEach((b, i) => { const k = (i % 2 ? blink : 1 - blink * 0.85); b.sp.material.opacity = (0.35 + 0.65 * on) * k; b.m.material.color.setRGB(1 * (0.3 + 0.7 * k), 0.16 * k, 0.1 * k); });
      arms.forEach((a) => { const tip = a.children[0].userData.tip; tip.material.color.setRGB(1 * (0.3 + 0.7 * blink), 0.16 * blink, 0.1 * blink); });
      flood.forEach((f) => (f.material.opacity = on));
      spot.intensity = spot2.intensity = on * 70;
      towerLight.intensity = towerLight2.intensity = on * 1.6;
    },
  };
  pad.userData.setArms(1, armY);
  return pad;
}
