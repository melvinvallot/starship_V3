/* Starship V3 — modèle 3D détaillé de la fusée (Three.js)
   Référence : photos du vaisseau S42 sur son transporteur.
   - inox brillant à reflets irisés (bleuissement thermique) via MeshPhysicalMaterial + iridescence
   - anneaux soudés, tôles, lignes de rivets, plaques de renfort (carte de relief)
   - bouclier thermique en tuiles hexagonales noires, coiffe entièrement tuilée, bord en escalier
   - volets avant / arrière tuilés avec face intérieure en inox irisé, carénages d'actionneurs
   - deux conduites externes annelées, bandes ajourées, hublots et trappes, logo X, marquages S42
   Le reste de la scène (flammes, fumée, caméra) reste dans scene.js. */
import * as THREE from 'three';

/* ---------- dimensions (1 unité = 10 m) ---------- */
export const R = 0.45;              // rayon (9 m de diamètre)
export const BOOST_H = 7.0;         // corps du booster
export const RING_H = 0.23;         // anneau de hot staging
export const BOOST_TOP = BOOST_H + RING_H;
export const SHIP_H = 5.21;
export const SHIP_CYL = 3.75;

const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/* qualité : textures divisées par deux sur petits écrans / appareils modestes */
const LOW = Math.min(innerWidth, innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
const Q = LOW ? 0.5 : 1;

/* ---------- profil du vaisseau ---------- */
export function shipRadius(y) {
  if (y <= SHIP_CYL) return R;
  const t = (y - SHIP_CYL) / (SHIP_H - SHIP_CYL);
  return R * Math.pow(Math.max(0, 1 - Math.pow(t, 1.9)), 0.62);
}
/* abscisse curviligne : la texture suit la surface, les tuiles gardent leur taille jusqu'à la pointe */
function arcTable(radius, H, N = 600) {
  const ys = [0], ss = [0];
  let s = 0, py = 0, pr = radius(0);
  for (let i = 1; i <= N; i++) {
    const y = (H * i) / N, r = radius(y);
    s += Math.hypot(y - py, r - pr); ys.push(y); ss.push(s); py = y; pr = r;
  }
  const S = s;
  return {
    S,
    v(y) { // 0 en bas, 1 en haut
      const f = clamp(y / H) * N, i = Math.min(N - 1, Math.floor(f)), t = f - i;
      return (ss[i] + (ss[i + 1] - ss[i]) * t) / S;
    },
  };
}

/* ---------- géométries utilitaires ---------- */
function latheUV(pts, vOf, seg = 192) {
  const g = new THREE.LatheGeometry(pts, seg);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setY(i, clamp(vOf(p.getY(i))));
  uv.needsUpdate = true;
  return g;
}
export function nozzleGeo(rt, re, L, seg = 40) {
  const pts = [];
  pts.push(new THREE.Vector2(rt * 1.9, 0.07), new THREE.Vector2(rt * 1.7, 0.035), new THREE.Vector2(rt, 0));
  for (let i = 1; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(rt + (re - rt) * Math.pow(t, 0.6), -L * t)); }
  return new THREE.LatheGeometry(pts, seg);
}
/* conduite externe : tube avec sections annelées (soufflets) et embouts arrondis */
function pipeGeo(r, len, ribbed = [], seg = 20) {
  const pts = [new THREE.Vector2(0, 0)];
  const capN = 6;
  for (let i = 1; i <= capN; i++) { const a = (i / capN) * Math.PI / 2; pts.push(new THREE.Vector2(Math.sin(a) * r * 0.85, (1 - Math.cos(a)) * r * 1.2)); }
  const steps = Math.ceil(len / 0.006);
  for (let i = 0; i <= steps; i++) {
    const y = r * 1.2 + (len - r * 2.4) * (i / steps);
    let rr = r;
    for (const [a, b] of ribbed) if (y > a && y < b) rr = r * (1.0 + 0.16 * Math.pow(Math.abs(Math.sin((y - a) * 340)), 3));
    for (const [a] of ribbed) if (Math.abs(y - a) < 0.012) rr = r * 1.22; // collerette
    pts.push(new THREE.Vector2(rr, y));
  }
  for (let i = capN; i >= 0; i--) { const a = (i / capN) * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(0.0005, Math.sin(a) * r * 0.85), len - (1 - Math.cos(a)) * r * 1.2)); }
  return new THREE.LatheGeometry(pts, seg);
}

/* ---------- motifs de dessin ---------- */
function hexPath(g, x, y, rx, ry) {
  g.beginPath();
  for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; g.lineTo(x + Math.cos(a) * rx, y + Math.sin(a) * ry); }
  g.closePath();
}
/* ligne de rivets / points de soudure */
function dotsRaw(g, x0, y0, x1, y1, step, size, col) {
  const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.floor(L / step));
  g.fillStyle = col;
  for (let i = 0; i <= n; i++) { const t = i / n; g.fillRect(x0 + (x1 - x0) * t - size / 2, y0 + (y1 - y0) * t - size / 2, size, size); }
}
function blob(g, x, y, rx, ry, col0, col1) {
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
  gr.addColorStop(0, col0); gr.addColorStop(1, col1);
  g.save(); g.translate(x, y); g.scale(rx, ry); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, TAU); g.fill(); g.restore();
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r); g.lineTo(x + w, y + h - r);
  g.arcTo(x + w, y + h, x + w - r, y + h, r); g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r); g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r); g.closePath();
}

/* logo « X » stylisé : un trait épais et une longue virgule effilée */
function drawX(g, cx, cy, w, col) {
  const h = w * 0.36;
  g.save(); g.translate(cx, cy); g.fillStyle = col;
  // jambage descendant (gauche-haut → droite-bas), épais
  g.beginPath();
  g.moveTo(-w * 0.42, -h * 0.5); g.lineTo(-w * 0.24, -h * 0.5); g.lineTo(w * 0.02, h * 0.5); g.lineTo(-w * 0.16, h * 0.5); g.closePath(); g.fill();
  // virgule montante, très effilée vers la droite
  g.beginPath();
  g.moveTo(-w * 0.43, h * 0.5); g.lineTo(-w * 0.27, h * 0.5);
  g.quadraticCurveTo(-w * 0.02, -h * 0.1, w * 0.5, -h * 0.42);
  g.quadraticCurveTo(w * 0.02, -h * 0.28, -w * 0.43, h * 0.5);
  g.closePath(); g.fill();
  g.restore();
}

/* texture répétable de tuiles hexagonales (volets, carénages) */
let _tileTex = null;
function tileTextures() {
  if (_tileTex) return _tileTex;
  const r = rng(41), hr = 15, cw = Math.sqrt(3) * hr, rh = 1.5 * hr;
  const nx = 18, ny = 20, W = Math.round(nx * cw), H = Math.round(ny * rh);
  const c = cnv(W, H), g = c.getContext('2d'), b = cnv(W, H), q = b.getContext('2d');
  g.fillStyle = '#050506'; g.fillRect(0, 0, W, H); q.fillStyle = '#3a3a3a'; q.fillRect(0, 0, W, H);
  for (let j = -1; j <= ny + 1; j++) for (let i = -1; i <= nx + 1; i++) {
    const x = i * cw + (j & 1 ? cw / 2 : 0), y = j * rh, sh = 20 + r() * 20 + (r() < 0.025 ? 40 : 0);
    g.fillStyle = `rgb(${sh | 0},${sh | 0},${(sh + 3) | 0})`; hexPath(g, x, y, hr - 1.3, hr - 1.3); g.fill();
    q.fillStyle = '#c8c8c8'; hexPath(q, x, y, hr - 1.3, hr - 1.3); q.fill();
    g.fillStyle = 'rgba(225,228,232,.85)';
    for (const kk of [0, 1]) { const an = Math.PI / 6 + (kk * Math.PI) / 3; g.fillRect(x + Math.cos(an) * hr - 1.5, y + Math.sin(an) * hr - 1.5, 3, 3); }
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const bump = new THREE.CanvasTexture(b); bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  const k = 1 / (nx * 0.031); // ~3,1 cm (×10) par colonne de tuiles
  map.repeat.set(k, k * (W / H)); bump.repeat.copy(map.repeat);
  return (_tileTex = { map, bump });
}

/* ==================================================================
   TEXTURES DE COQUE (couleur, rugosité/métal, relief, irisation)
   Le centre horizontal (u = 0,5) est la face avant, côté caméra.
   ================================================================== */
function hullTextures(o) {
  const { W, H, len, radius, vOf, seed } = o;
  const r = rng(seed);
  const c = cnv(W, H), g = c.getContext('2d');      // couleur
  const m = cnv(W, H), q = m.getContext('2d');      // G = rugosité, B = métal
  const b = cnv(W, H), k = b.getContext('2d');      // relief
  const IW = W >> 2, IH = H >> 2;
  const ic = cnv(IW, IH), ir = ic.getContext('2d'); // R = intensité d'irisation, G = épaisseur du film

  const X = (a) => W * (0.5 + a / TAU);                // angle (rad, 0 = face avant) → px
  const Y = (y) => H * (1 - vOf(y));                    // hauteur (unités) → px
  const pxU = (y) => W / (TAU * Math.max(0.02, radius(y))); // px par unité, horizontalement
  const pxV = H / o.S;                                  // px par unité, verticalement
  const d = pxV / 780;                                  // échelle des petits détails (rivets)
  const dots = (ctx, x0, y0, x1, y1, step, size, col) => dotsRaw(ctx, x0, y0, x1, y1, step * d, Math.max(1, size * d), col);

  /* --- base inox --- */
  g.fillStyle = '#b9bec5'; g.fillRect(0, 0, W, H);
  q.fillStyle = 'rgb(0,60,255)'; q.fillRect(0, 0, W, H);
  k.fillStyle = 'rgb(128,128,128)'; k.fillRect(0, 0, W, H);

  /* anneaux et tôles : chaque anneau (1,83 m) est fait de 3 tôles, à joints décalés */
  const ringU = 0.183;
  const rings = [];
  for (let y = 0; y < len; y += ringU) rings.push(y);
  rings.forEach((y0, ri) => {
    const y1 = Math.min(len, y0 + ringU), py0 = Y(y0), py1 = Y(y1), hpx = py0 - py1;
    const off = r() * W, sheets = 3;
    for (let s = 0; s < sheets; s++) {
      const x0 = (off + (s * W) / sheets) % W, w = W / sheets + 1;
      const t = 176 + r() * 22, warm = r() * 6;
      const fill = (ctx, style) => { ctx.fillStyle = style; ctx.fillRect(x0, py1, w, hpx); if (x0 + w > W) ctx.fillRect(x0 - W, py1, w, hpx); };
      fill(g, `rgba(${(t + warm) | 0},${(t + 3) | 0},${(t + 8 - warm) | 0},.6)`);
      fill(q, `rgb(0,${(38 + r() * 30) | 0},255)`);
      // joint vertical de tôle + rivets de part et d'autre
      g.fillStyle = 'rgba(40,40,46,.55)'; g.fillRect(x0, py1, 2, hpx);
      k.fillStyle = 'rgb(165,165,165)'; k.fillRect(x0 - 1, py1, 4, hpx);
      dots(g, x0 - 7, py1 + 4, x0 - 7, py0 - 4, 11, 2.4, 'rgba(92,70,52,.75)');
      dots(k, x0 - 7, py1 + 4, x0 - 7, py0 - 4, 11, 2.4, 'rgb(200,200,200)');
      if (r() < 0.6) { dots(g, x0 + 9, py1 + 4, x0 + 9, py0 - 4, 11, 2.2, 'rgba(92,70,52,.7)'); dots(k, x0 + 9, py1 + 4, x0 + 9, py0 - 4, 11, 2.2, 'rgb(195,195,195)'); }
    }
    // lisses internes visibles (lignes de soudure par points, verticales et courtes)
    const nStr = 10 + (r() * 18 | 0);
    for (let i = 0; i < nStr; i++) {
      const x = r() * W, a = py1 + hpx * (0.1 + r() * 0.2), e = py0 - hpx * (0.1 + r() * 0.2);
      dots(g, x, a, x, e, 8, 1.8, 'rgba(110,86,64,.55)'); dots(k, x, a, x, e, 8, 1.8, 'rgb(178,178,178)');
    }
    // soudure circonférentielle : cordon sombre + liseré clair + teinte ambrée
    if (ri > 0) {
      const gr = g.createLinearGradient(0, py0 - 10, 0, py0 + 10);
      gr.addColorStop(0, 'rgba(150,110,60,0)'); gr.addColorStop(0.5, 'rgba(150,108,62,.35)'); gr.addColorStop(1, 'rgba(150,110,60,0)');
      g.fillStyle = gr; g.fillRect(0, py0 - 10, W, 20);
      g.fillStyle = 'rgba(30,30,34,.45)'; g.fillRect(0, py0 - 1.5, W, 3);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, py0 + 1.5, W, 1);
      k.fillStyle = 'rgb(215,215,215)'; k.fillRect(0, py0 - 2.5, W, 5);
      q.fillStyle = 'rgb(0,110,255)'; q.fillRect(0, py0 - 2, W, 4);
      // rangée de rivets juste au-dessus et en dessous
      if (r() < 0.6) { dots(g, 0, py0 - 9, W, py0 - 9, 12, 2.2, 'rgba(96,74,54,.7)'); dots(k, 0, py0 - 9, W, py0 - 9, 12, 2.2, 'rgb(190,190,190)'); }
      if (r() < 0.3) { dots(g, 0, py0 + 9, W, py0 + 9, 12, 2.2, 'rgba(96,74,54,.6)'); dots(k, 0, py0 + 9, W, py0 + 9, 12, 2.2, 'rgb(185,185,185)'); }
    }
  });

  /* plaques de renfort rectangulaires à bord riveté (face avant surtout) */
  for (let i = 0; i < (o.doublers || 0); i++) {
    const a = (r() - 0.5) * 2.2, y = 0.3 + r() * (Math.min(len, SHIP_CYL) - 0.6);
    const w = (0.05 + r() * 0.14) * pxU(y), h = (0.04 + r() * 0.12) * pxV, x = X(a), py = Y(y);
    g.strokeStyle = 'rgba(70,64,60,.3)'; g.lineWidth = 1.2; g.strokeRect(x, py, w, h);
    k.strokeStyle = 'rgb(150,150,150)'; k.lineWidth = 2; k.strokeRect(x, py, w, h);
    dots(g, x + 4, py + 4, x + w - 4, py + 4, 9, 2, 'rgba(96,74,54,.75)'); dots(g, x + 4, py + h - 4, x + w - 4, py + h - 4, 9, 2, 'rgba(96,74,54,.75)');
    dots(g, x + 4, py + 4, x + 4, py + h - 4, 9, 2, 'rgba(96,74,54,.75)'); dots(g, x + w - 4, py + 4, x + w - 4, py + h - 4, 9, 2, 'rgba(96,74,54,.75)');
  }

  /* brossage vertical, reflets, coulures */
  for (let i = 0; i < 16000 * Q; i++) {
    const v = r() < 0.5 ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${r() * 0.035})`;
    g.fillRect(r() * W, r() * H, 1, r() * H * 0.1);
  }
  for (let i = 0; i < 400 * Q; i++) {
    g.fillStyle = `rgba(${80 + r() * 50},${70 + r() * 40},${60 + r() * 30},${r() * 0.06})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 2, r() * H * 0.15);
  }

  /* irisation : film d'oxyde (épaisseur) + intensité en plaques et coulures verticales */
  ir.fillStyle = 'rgb(0,128,0)'; ir.fillRect(0, 0, IW, IH);
  for (let i = 0; i < 260; i++) {
    const gg = 40 + r() * 215 | 0;
    blob(ir, r() * IW, r() * IH, 8 + r() * 40, 12 + r() * 70, `rgba(0,${gg},0,.5)`, `rgba(0,${gg},0,0)`);
  }
  ir.globalCompositeOperation = 'lighter';
  const ix = (a) => IW * (0.5 + a / TAU), iy = (y) => IH * (1 - vOf(y));
  (o.iriZones || []).forEach(([yA, yB, amt, spread]) => {
    for (let i = 0; i < 26; i++) {
      const y = yA + r() * (yB - yA), a = (r() - 0.5) * spread;
      blob(ir, ix(a), iy(y), 10 + r() * 34, 8 + r() * 26, `rgba(255,0,0,${amt * (0.12 + r() * 0.22)})`, 'rgba(255,0,0,0)');
    }
    // coulures sinueuses vers le bas (comme sur la photo)
    for (let i = 0; i < 18; i++) {
      let x = ix((r() - 0.5) * spread), y = iy(yB - r() * (yB - yA) * 0.3);
      const L = (0.3 + r() * 0.7) * (iy(yA) - iy(yB)), wv = 1.5 + r() * 4;
      ir.strokeStyle = `rgba(255,0,0,${amt * (0.12 + r() * 0.2)})`; ir.lineWidth = 2 + r() * 6; ir.lineCap = 'round';
      ir.beginPath(); ir.moveTo(x, y);
      for (let s = 0; s < 20; s++) { y += L / 20; x += Math.sin(s * 0.9 + i) * wv; ir.lineTo(x, y); }
      ir.stroke();
    }
  });
  ir.globalCompositeOperation = 'source-over';

  /* suie / brûlures vers les moteurs */
  if (o.soot) {
    const y1 = Y(len * o.soot);
    const gr = g.createLinearGradient(0, H, 0, y1);
    gr.addColorStop(0, 'rgba(16,12,10,.96)'); gr.addColorStop(0.35, 'rgba(42,30,22,.6)'); gr.addColorStop(1, 'rgba(60,45,30,0)');
    g.fillStyle = gr; g.fillRect(0, y1, W, H - y1);
    for (let i = 0; i < 600 * Q; i++) {
      const x = r() * W, l = r() * (H - y1) * 1.6;
      g.fillStyle = `rgba(${55 + r() * 50},${36 + r() * 25},${22 + r() * 12},${r() * 0.12})`;
      g.fillRect(x, H - l, 1 + r() * 4, l);
    }
    const gq = q.createLinearGradient(0, H, 0, y1);
    gq.addColorStop(0, 'rgba(0,215,80,.95)'); gq.addColorStop(1, 'rgba(0,215,80,0)');
    q.fillStyle = gq; q.fillRect(0, y1, W, H - y1);
  }

  /* bandes ajourées (lames claires verticales) */
  (o.slatBands || []).forEach(([y, h, aMax]) => {
    const p0 = Y(y + h / 2), p1 = Y(y - h / 2), x0 = X(-aMax), x1 = X(aMax), step = 0.034 * pxU(y), sw = step * 0.5;
    g.fillStyle = 'rgba(40,40,46,.85)'; g.fillRect(x0, p0, x1 - x0, p1 - p0);
    k.fillStyle = 'rgb(70,70,70)'; k.fillRect(x0, p0, x1 - x0, p1 - p0);
    for (let x = x0 + 2; x < x1 - sw; x += step) {
      const gr = g.createLinearGradient(x, 0, x + sw, 0);
      gr.addColorStop(0, '#9fa4ab'); gr.addColorStop(0.5, '#eef1f4'); gr.addColorStop(1, '#8d9299');
      g.fillStyle = gr; g.fillRect(x, p0 + 2, sw, p1 - p0 - 4);
      k.fillStyle = 'rgb(220,220,220)'; k.fillRect(x, p0 + 2, sw, p1 - p0 - 4);
    }
    g.fillStyle = 'rgba(20,20,24,.8)'; g.fillRect(x0, p0 - 2, x1 - x0, 3); g.fillRect(x0, p1 - 1, x1 - x0, 3);
    dots(g, x0, p0 - 8, x1, p0 - 8, 10, 2.2, 'rgba(96,74,54,.75)'); dots(g, x0, p1 + 8, x1, p1 + 8, 10, 2.2, 'rgba(96,74,54,.75)');
    q.fillStyle = 'rgb(0,50,255)'; q.fillRect(x0, p0, x1 - x0, p1 - p0);
  });

  /* bande ovale (« stade ») en relief, rivetée */
  if (o.oval) {
    const [y, h, a] = o.oval, x0 = X(-a), x1 = X(a), p0 = Y(y + h / 2), p1 = Y(y - h / 2), rr = (p1 - p0) / 2;
    for (const [ctx, col, lw] of [[k, 'rgb(225,225,225)', 7], [g, 'rgba(40,42,48,.75)', 2.5]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; roundRect(ctx, x0, p0, x1 - x0, p1 - p0, rr); ctx.stroke();
      roundRect(ctx, x0 + 14, p0 + 14, x1 - x0 - 28, p1 - p0 - 28, rr - 14); ctx.stroke();
    }
    g.fillStyle = 'rgba(205,212,222,.25)'; roundRect(g, x0 + 14, p0 + 14, x1 - x0 - 28, p1 - p0 - 28, rr - 14); g.fill();
    // rivets le long du contour
    const per = 2 * (x1 - x0 - 2 * rr) + TAU * rr, n = per / 10 | 0;
    g.fillStyle = 'rgba(96,74,54,.8)'; k.fillStyle = 'rgb(200,200,200)';
    for (let i = 0; i < n; i++) {
      let d = (i / n) * per, px, py;
      const L = x1 - x0 - 2 * rr;
      if (d < L) { px = x0 + rr + d; py = p0 + 7; } else if ((d -= L) < Math.PI * rr) { const t = d / rr - Math.PI / 2; px = x1 - rr + Math.cos(t) * (rr - 7); py = p0 + rr + Math.sin(t) * (rr - 7); }
      else if ((d -= Math.PI * rr) < L) { px = x1 - rr - d; py = p1 - 7; } else { d -= L; const t = d / rr + Math.PI / 2; px = x0 + rr + Math.cos(t) * (rr - 7); py = p0 + rr + Math.sin(t) * (rr - 7); }
      g.fillRect(px - 1, py - 1, 2.4, 2.4); k.fillRect(px - 1, py - 1, 2.4, 2.4);
    }
  }

  /* hublots, trappes, prises */
  (o.ports || []).forEach(([a, y, rad, kind]) => {
    const x = X(a), py = Y(y), rx = rad * pxU(y), ry = rad * pxV;
    if (kind === 'gold') {
      blob(g, x, py, rx, ry, 'rgba(176,140,82,1)', 'rgba(120,92,52,1)');
      g.strokeStyle = 'rgba(60,56,52,.9)'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, py, rx, ry, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(80,80,88,.8)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, py, rx * 1.35, ry * 1.35, 0, 0, TAU); g.stroke();
      for (let i = 0; i < 24; i++) { const t = (i / 24) * TAU; g.fillStyle = 'rgba(60,50,40,.9)'; g.fillRect(x + Math.cos(t) * rx * 1.18 - 1, py + Math.sin(t) * ry * 1.18 - 1, 2.5, 2.5); }
      k.fillStyle = 'rgb(200,200,200)'; k.beginPath(); k.ellipse(x, py, rx * 1.35, ry * 1.35, 0, 0, TAU); k.fill();
      k.fillStyle = 'rgb(150,150,150)'; k.beginPath(); k.ellipse(x, py, rx, ry, 0, 0, TAU); k.fill();
      q.fillStyle = 'rgb(0,90,255)'; q.beginPath(); q.ellipse(x, py, rx, ry, 0, 0, TAU); q.fill();
    } else if (kind === 'tile') { // trappe carrée tuilée
      g.fillStyle = '#0b0b0d'; roundRect(g, x - rx, py - ry, rx * 2, ry * 2, rx * 0.15); g.fill();
      const hr = 0.018 * pxU(y);
      g.save(); roundRect(g, x - rx + 3, py - ry + 3, rx * 2 - 6, ry * 2 - 6, rx * 0.12); g.clip();
      for (let j = -3; j < 8; j++) for (let i = -3; i < 8; i++) { const hx = x - rx + i * hr * 1.732 + (j & 1 ? hr * 0.866 : 0), hy = py - ry + j * hr * 1.5; const sh = 24 + r() * 16; g.fillStyle = `rgb(${sh | 0},${sh | 0},${(sh + 2) | 0})`; hexPath(g, hx, hy, hr - 1.2, hr - 1.2); g.fill(); }
      g.restore();
      k.fillStyle = 'rgb(210,210,210)'; roundRect(k, x - rx, py - ry, rx * 2, ry * 2, rx * 0.15); k.fill();
      q.fillStyle = 'rgb(0,200,0)'; q.fillRect(x - rx, py - ry, rx * 2, ry * 2);
      ir.fillStyle = 'rgb(0,128,0)'; ir.fillRect((x - rx) / 4, (py - ry) / 4, rx / 2, ry / 2);
    } else if (kind === 'slot') { // fente noire horizontale arrondie
      const w = rad * pxU(y), h = 0.022 * pxV;
      g.fillStyle = '#08080a'; roundRect(g, x - w / 2, py - h / 2, w, h, h / 2); g.fill();
      g.strokeStyle = 'rgba(120,124,130,.8)'; g.lineWidth = 2; roundRect(g, x - w / 2 - 3, py - h / 2 - 3, w + 6, h + 6, h / 2 + 3); g.stroke();
      k.fillStyle = 'rgb(60,60,60)'; roundRect(k, x - w / 2, py - h / 2, w, h, h / 2); k.fill();
      q.fillStyle = 'rgb(0,180,60)'; roundRect(q, x - w / 2, py - h / 2, w, h, h / 2); q.fill();
    } else if (kind === 'vent') { // grappe de trous d'évent
      const st = 0.022 * pxU(y), rr = st * 0.36;
      for (let jj = 0; jj < 4; jj++) for (let ii = 0; ii < 5; ii++) {
        const hx = x + (ii - 2) * st + (jj & 1 ? st / 2 : 0), hy = py + (jj - 1.5) * st * 0.9;
        g.fillStyle = '#060608'; g.beginPath(); g.arc(hx, hy, rr, 0, TAU); g.fill();
        k.fillStyle = 'rgb(50,50,50)'; k.beginPath(); k.arc(hx, hy, rr, 0, TAU); k.fill();
      }
    } else if (kind === 'grille') { // trappe à lames horizontales
      const w = rad * pxU(y), h = rad * pxV * 1.1;
      g.fillStyle = 'rgba(60,62,68,.9)'; g.fillRect(x - w / 2, py - h / 2, w, h);
      for (let yy = py - h / 2 + 4; yy < py + h / 2 - 3; yy += 7) { g.fillStyle = 'rgba(200,204,210,.8)'; g.fillRect(x - w / 2 + 3, yy, w - 6, 3); k.fillStyle = 'rgb(200,200,200)'; k.fillRect(x - w / 2 + 3, yy, w - 6, 3); }
    } else { // hublot sombre
      ir.fillStyle = 'rgb(0,128,0)'; ir.fillRect((x - rx * 1.5) / 4, (py - ry * 1.5) / 4, rx * 0.75 + 1, ry * 0.75 + 1);
      g.fillStyle = 'rgba(70,72,78,.9)'; g.beginPath(); g.ellipse(x, py, rx * 1.4, ry * 1.4, 0, 0, TAU); g.fill();
      blob(g, x, py, rx, ry, 'rgba(6,6,8,1)', 'rgba(26,26,30,1)');
      k.fillStyle = 'rgb(190,190,190)'; k.beginPath(); k.ellipse(x, py, rx * 1.4, ry * 1.4, 0, 0, TAU); k.fill();
      k.fillStyle = 'rgb(60,60,60)'; k.beginPath(); k.ellipse(x, py, rx, ry, 0, 0, TAU); k.fill();
    }
  });

  /* logos X et marquages */
  (o.logos || []).forEach(([a, y, w]) => { drawX(g, X(a), Y(y), w * pxU(y), 'rgba(22,22,26,.92)'); });
  (o.marks || []).forEach(([a, y, size, rot]) => {
    const x = X(a), py = Y(y), s = size * pxV;
    g.save(); g.translate(x, py); g.rotate(rot);
    g.fillStyle = 'rgba(245,247,250,.95)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${s | 0}px Archivo, "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    g.fillText('S42', 0, s * 0.18);
    g.font = `700 ${(s * 0.3) | 0}px Archivo, "Helvetica Neue", Arial, sans-serif`;
    g.fillText("DON'T PANIC", 0, -s * 0.52);
    g.restore();
  });

  /* bouclier thermique : tuiles hexagonales, bord en escalier, coiffe entièrement couverte */
  if (o.tiles) {
    const hrW = 0.0185, cwW = Math.sqrt(3) * hrW, rhW = 1.5 * hrW; // taille d'une tuile (unités)
    const S = o.S, rowsN = Math.ceil(S / rhW);
    let step = 0;
    for (let j = 0; j <= rowsN; j++) {
      const v = 1 - (j * rhW) / S, py = (1 - v) * H;                // du haut vers le bas
      // hauteur y correspondant à v (recherche dichotomique)
      let lo = 0, hi = len; for (let it = 0; it < 22; it++) { const mid = (lo + hi) / 2; if (vOf(mid) < v) lo = mid; else hi = mid; }
      const y = lo, rad = Math.max(0.004, radius(y));
      const n = Math.max(6, Math.round((TAU * rad) / cwW)), cpx = W / n;
      const rx = cpx / Math.sqrt(3), ryp = hrW * pxV;
      if (j % 3 === 0) step = (r() * 3 | 0) - 1;                      // marches du bord
      const aEdge = o.tiles(y) + step * (cwW / rad) * 0.5;            // demi-largeur de la zone inox (rad)
      const rect = o.rectBand && y > o.rectBand[0] && y < o.rectBand[1];
      const odd = (j & 1) && !rect ? cpx / 2 : 0;
      for (let i = 0; i < n; i++) {
        const x = i * cpx + odd, a = (x / W - 0.5) * TAU;
        if (Math.abs(a) < aEdge) continue;
        const sh = 9 + r() * 15 + (r() < 0.02 ? 30 : 0), rough = (190 + r() * 50) | 0;
        const xs = [x]; if (x < rx + 3) xs.push(x + W); if (x > W - rx - 3) xs.push(x - W); // raccord de la couture
        for (const xx of xs) {
          if (rect) { // rangée de tuiles rectangulaires (base de la coiffe)
            const x0 = xx - odd, w = cpx, h = rhW * pxV;
            g.fillStyle = '#34343a'; g.fillRect(x0 - 1, py - h / 2 - 1, w + 2, h + 2);
            g.fillStyle = `rgb(${sh | 0},${sh | 0},${(sh + 3) | 0})`; g.fillRect(x0 + 1, py - h / 2 + 1, w - 2, h - 2);
            k.fillStyle = 'rgb(70,70,70)'; k.fillRect(x0 - 1, py - h / 2 - 1, w + 2, h + 2);
            k.fillStyle = 'rgb(190,190,190)'; k.fillRect(x0 + 1, py - h / 2 + 1, w - 2, h - 2);
            q.fillStyle = `rgb(0,${rough},0)`; q.fillRect(x0 - 1, py - h / 2 - 1, w + 2, h + 2);
            ir.fillStyle = 'rgb(0,128,0)'; ir.fillRect(x0 / 4 - 1, (py - h / 2) / 4 - 1, w / 4 + 2, h / 4 + 2);
            continue;
          }
          g.fillStyle = '#3b3b40'; hexPath(g, xx, py, rx + 1.2, ryp + 1.2); g.fill();
          g.fillStyle = `rgb(${sh | 0},${sh | 0},${(sh + 3) | 0})`; hexPath(g, xx, py, rx - 1, ryp - 1); g.fill();
          // points de fixation blancs aux sommets
          g.fillStyle = 'rgba(225,228,232,.85)';
          for (const kk of [0, 1]) { const an = Math.PI / 6 + (kk * Math.PI) / 3; g.fillRect(xx + Math.cos(an) * (rx + 0.6) - 1.1, py + Math.sin(an) * (ryp + 0.6) - 1.1, 2.2, 2.2); }
          k.fillStyle = 'rgb(70,70,70)'; hexPath(k, xx, py, rx + 1.2, ryp + 1.2); k.fill();
          k.fillStyle = 'rgb(190,190,190)'; hexPath(k, xx, py, rx - 1, ryp - 1); k.fill();
          q.fillStyle = `rgb(0,${rough},0)`; hexPath(q, xx, py, rx + 1.2, ryp + 1.2); q.fill();
          ir.fillStyle = 'rgb(0,128,0)'; ir.fillRect((xx - rx) / 4 - 1, (py - ryp) / 4 - 1, rx / 2 + 2, ryp / 2 + 2);
        }
      }
    }
  }

  /* panneaux noirs lisses (carénages des volets avant) et marquages blancs par-dessus */
  (o.panels || []).forEach(([a0, a1, y0, y1]) => {
    for (const sgn of [-1, 1]) {
      const xa = X(sgn * a0), xb = X(sgn * a1), x0 = Math.min(xa, xb), w = Math.abs(xb - xa), p0 = Y(y1), p1 = Y(y0);
      g.fillStyle = '#0c0c0f'; g.beginPath(); g.moveTo(x0, p0); g.lineTo(x0 + w, p0); g.lineTo(x0 + w, p1 - (sgn > 0 ? 0 : w * 0.5)); g.lineTo(x0, p1 - (sgn > 0 ? w * 0.5 : 0)); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x0, p0, w, 2);
      q.fillStyle = 'rgb(0,95,40)'; q.fillRect(x0, p0, w, p1 - p0);
      k.fillStyle = 'rgb(150,150,150)'; k.fillRect(x0, p0, w, p1 - p0);
      ir.fillStyle = 'rgb(0,128,0)'; ir.fillRect(x0 / 4, p0 / 4, w / 4, (p1 - p0) / 4);
      for (let yy = p0 + 30; yy < p1 - w * 0.5; yy += 64) dotsRaw(g, x0 + 6, yy, x0 + w - 6, yy, 14, 1.6, 'rgba(255,255,255,.12)');
    }
  });
  (o.panelMarks || []).forEach(([a, y, size, rot]) => {
    const x = X(a), py = Y(y), s = size * pxV;
    g.save(); g.translate(x, py); g.rotate(rot);
    g.fillStyle = 'rgba(245,247,250,.96)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `800 ${s | 0}px Archivo, "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    g.fillText('S42', 0, s * 0.12);
    g.font = `700 ${(s * 0.3) | 0}px Archivo, "Helvetica Neue", Arial, sans-serif`;
    g.fillText("DON'T PANIC", 0, -s * 0.58);
    g.restore();
  });

  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const rm = new THREE.CanvasTexture(m), bump = new THREE.CanvasTexture(b), iri = new THREE.CanvasTexture(ic);
  [map, rm, bump, iri].forEach((t) => { t.wrapS = THREE.RepeatWrapping; t.anisotropy = o.aniso; });
  return { map, rm, bump, iri };
}

/* face inox des volets avant : panneaux rivetés, raidisseurs en éventail (motif losange), bord tuilé */
function forwardFlapTextures(aniso) {
  const W = 1024, H = 1440, X0 = 0.46, Y0 = -0.02, YS = 0.66;   // cadre en unités de forme
  const c = cnv(W, H), g = c.getContext('2d'), b = cnv(W, H), k = b.getContext('2d'), r = rng(57);
  const px = (x) => (x / X0) * W, py = (y) => (1 - (y - Y0) / YS) * H;
  g.fillStyle = '#c4c8ce'; g.fillRect(0, 0, W, H); k.fillStyle = '#808080'; k.fillRect(0, 0, W, H);
  // tôles rectangulaires
  for (let y = 0; y < 0.66; y += 0.055) for (let x = 0; x < 0.46; x += 0.07) {
    const t = 176 + r() * 30; g.fillStyle = `rgba(${t | 0},${(t + 3) | 0},${(t + 7) | 0},.7)`;
    g.fillRect(px(x), py(y + 0.055), px(0.07), py(0) - py(0.055));
  }
  g.strokeStyle = 'rgba(60,62,68,.7)'; g.lineWidth = 2; k.strokeStyle = '#b8b8b8'; k.lineWidth = 4;
  for (let y = 0; y < 0.66; y += 0.055) { for (const [ctx] of [[g], [k]]) { ctx.beginPath(); ctx.moveTo(0, py(y)); ctx.lineTo(W, py(y)); ctx.stroke(); } dotsRaw(g, 0, py(y) - 6, W, py(y) - 6, 12, 2.4, 'rgba(90,72,56,.75)'); }
  for (let x = 0; x < 0.46; x += 0.07) { for (const [ctx] of [[g], [k]]) { ctx.beginPath(); ctx.moveTo(px(x), 0); ctx.lineTo(px(x), H); ctx.stroke(); } dotsRaw(g, px(x) + 6, 0, px(x) + 6, H, 12, 2.4, 'rgba(90,72,56,.75)'); }
  // raidisseurs en éventail depuis la ferrure d'actionneur centrale → motif losange
  const hx = px(0.27), hy = py(0.21);
  g.lineWidth = 3; k.lineWidth = 7;
  for (const [tx, ty] of [[0.02, 0.62], [0.45, 0.17], [0.44, -0.02], [0.02, 0.0], [0.03, 0.33], [0.45, 0.08]]) {
    g.strokeStyle = 'rgba(70,72,80,.75)'; g.beginPath(); g.moveTo(hx, hy); g.lineTo(px(tx), py(ty)); g.stroke();
    k.strokeStyle = '#d6d6d6'; k.beginPath(); k.moveTo(hx, hy); k.lineTo(px(tx), py(ty)); k.stroke();
    dotsRaw(g, hx + 8, hy + 8, px(tx) + 8, py(ty) + 8, 12, 2.2, 'rgba(90,72,56,.7)');
  }
  // losange de la ferrure
  g.fillStyle = '#8f949b'; g.beginPath(); g.moveTo(hx - 60, hy); g.lineTo(hx, hy - 34); g.lineTo(hx + 60, hy); g.lineTo(hx, hy + 34); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(40,40,46,.9)'; g.lineWidth = 3; g.stroke();
  k.fillStyle = '#e8e8e8'; k.beginPath(); k.moveTo(hx - 60, hy); k.lineTo(hx, hy - 34); k.lineTo(hx + 60, hy); k.lineTo(hx, hy + 34); k.closePath(); k.fill();
  // brossage + légère suie vers le bord d'attaque
  for (let i = 0; i < 5000; i++) { const v = r() < 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${r() * 0.04})`; g.fillRect(r() * W, r() * H, 1, r() * 120); }
  const gr = g.createLinearGradient(px(0.45), py(0.17), px(0.3), py(0.3));
  gr.addColorStop(0, 'rgba(20,20,24,.5)'); gr.addColorStop(1, 'rgba(20,20,24,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = aniso;
  const bump = new THREE.CanvasTexture(b);
  for (const t of [map, bump]) { t.repeat.set(1 / X0, 1 / YS); t.offset.set(0, -Y0 / YS); }
  return { map, bump };
}

/* ==================================================================
   MATÉRIAUX
   ================================================================== */
function makeMaterials() {
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xc4c9cf, metalness: 1, roughness: 0.22, envMapIntensity: 1.0, iridescence: 0.35, iridescenceIOR: 1.7, iridescenceThicknessRange: [200, 600] });
  const steelIri = new THREE.MeshPhysicalMaterial({ color: 0xc9cdd3, metalness: 1, roughness: 0.16, envMapIntensity: 1.05, iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [180, 820] });
  const flapSteel = new THREE.MeshPhysicalMaterial({ color: 0xa8aeb6, metalness: 1, roughness: 0.2, envMapIntensity: 0.9, iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [250, 900], side: THREE.DoubleSide });
  { // film d'oxyde marbré sur la face inox des volets (reflets arc-en-ciel)
    const c = cnv(256, 256), x = c.getContext('2d'), r = rng(23);
    x.fillStyle = 'rgb(70,110,0)'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 40; i++) { const v = 60 + r() * 150 | 0, k = 50 + r() * 110 | 0; blob(x, r() * 256, r() * 256, 30 + r() * 70, 30 + r() * 70, `rgba(${k},${v},0,.45)`, `rgba(${k},${v},0,0)`); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.5, 1.5);
    flapSteel.iridescenceMap = t; flapSteel.iridescenceThicknessMap = t;
  }
  const bell = new THREE.MeshStandardMaterial({ color: 0x6b5d50, metalness: 1, roughness: 0.42, side: THREE.DoubleSide, envMapIntensity: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17181b, metalness: 0.3, roughness: 0.7 });
  const t = tileTextures();
  const tile = new THREE.MeshStandardMaterial({ map: t.map, bumpMap: t.bump, bumpScale: 1.2, metalness: 0.05, roughness: 0.74 });
  const chine = new THREE.MeshPhysicalMaterial({ color: 0x9a9fa6, metalness: 1, roughness: 0.3, envMapIntensity: 0.8 });
  return { steel, steelIri, flapSteel, bell, dark, tile, chine };
}

/* ==================================================================
   STARSHIP (second étage) — vaisseau S42
   ================================================================== */
function buildShip(M, aniso) {
  const g = new THREE.Group();
  const arc = arcTable(shipRadius, SHIP_H);
  const pts = [new THREE.Vector2(0, 0.0), new THREE.Vector2(R - 0.02, 0.0), new THREE.Vector2(R, 0.02)];
  for (let i = 0; i <= 90; i++) { const y = 0.03 + (SHIP_H - 0.03) * (i / 90); pts.push(new THREE.Vector2(Math.max(0.0005, shipRadius(y)), y)); }

  // zone inox de la face avant : demi-largeur angulaire selon la hauteur (le reste est tuilé)
  const steelHalf = (y) => {
    if (y < 4.2) return 1.0;
    if (y < 4.74) return 1.0 * Math.sqrt(Math.max(0, 1 - Math.pow((y - 4.2) / 0.54, 4.5))) - 0.03;
    return -1;
  };
  const tex = hullTextures({
    W: 2048 * Q, H: 4096 * Q, len: SHIP_H, radius: shipRadius, vOf: arc.v, S: arc.S, seed: 3, aniso,
    tiles: steelHalf, rectBand: [4.5, 4.82], doublers: 12,
    panels: [[0.98, 1.36, 3.05, 4.32]],
    panelMarks: [[-1.18, 3.62, 0.13, -Math.PI / 2], [1.18, 3.62, 0.13, -Math.PI / 2]],
    iriZones: [[2.9, 4.6, 1.0, 2.6], [1.6, 3.0, 0.7, 2.4], [0.2, 1.7, 0.45, 2.4]],
    slatBands: [[3.27, 0.06, 1.15], [2.31, 0.05, 1.15], [0.62, 0.06, 1.15]],
    oval: [3.61, 0.13, 0.8],
    ports: [[0.07, 3.475, 0.05, 'gold'], [-0.15, 3.49, 0.012, 'dark'], [-0.22, 3.49, 0.012, 'dark'],
      [-0.56, 2.55, 0.028, 'dark'], [0.52, 0.9, 0.028, 'dark'], [0.6, 2.95, 0.016, 'dark'], [-0.4, 1.4, 0.016, 'dark'],
      [-0.42, 3.935, 0.05, 'tile'], [0.42, 3.935, 0.05, 'tile'],
      [-0.52, 3.43, 0.034, 'dark'], [0.52, 3.43, 0.034, 'dark'],
      [-0.6, 3.07, 0.013, 'dark'], [-0.53, 3.07, 0.013, 'dark'], [0.53, 3.07, 0.013, 'dark'], [0.6, 3.07, 0.013, 'dark'],
      [-0.55, 2.17, 0.013, 'dark'], [0.55, 2.17, 0.013, 'dark'],
      [-0.62, 2.06, 0.15, 'slot'], [0, 2.06, 0.15, 'slot'], [0.62, 2.06, 0.15, 'slot'],
      [-0.62, 1.5, 0.15, 'slot'], [0, 1.5, 0.15, 'slot'], [0.62, 1.5, 0.15, 'slot'],
      [0.6, 1.2, 0, 'vent'], [-0.6, 1.22, 0.1, 'grille'],
      [-0.55, 0.37, 0.034, 'dark'], [0.55, 0.37, 0.034, 'dark']],
    logos: [[0.0, 3.935, 0.3], [0.0, 0.17, 0.26]],
  });
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: tex.map, roughnessMap: tex.rm, metalnessMap: tex.rm, bumpMap: tex.bump, bumpScale: 1.6,
    metalness: 1, roughness: 1, envMapIntensity: 1.05,
    iridescence: 1, iridescenceMap: tex.iri, iridescenceThicknessMap: tex.iri, iridescenceIOR: 1.85, iridescenceThicknessRange: [160, 760],
  });
  const body = new THREE.Mesh(latheUV(pts, arc.v, 192), bodyMat);
  body.rotation.y = Math.PI; // u = 0,5 (centre de la texture) face à la caméra
  g.add(body);

  /* --- volets --- */
  const fwdTex = forwardFlapTextures(aniso);
  const fwdMat = M.flapSteel.clone(); fwdMat.map = fwdTex.map; fwdMat.bumpMap = fwdTex.bump; fwdMat.bumpScale = 1.4; fwdMat.color.set(0xffffff);
  const hingeBracket = (piv, y, front) => { // ferrure de charnière + vérin
    const b = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.022, 0.05), M.steel); b.add(plate);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.11, 8), M.steel);
    rod.rotation.z = Math.PI / 2; rod.position.set(0.05, 0.004, front * 0.022); b.add(rod);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 10), M.dark);
    cyl.rotation.z = Math.PI / 2; cyl.position.set(0.02, 0.004, front * 0.022); b.add(cyl);
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.012), M.steel); lug.position.set(0.1, 0.004, front * 0.022); b.add(lug);
    b.position.set(0.0, y, front * 0.01); piv.add(b);
  };
  const flap = (shape, y, ang, depth, tilt, opts = {}) => {
    const s = new THREE.Shape(shape.map(([x, yy]) => new THREE.Vector2(x, yy)));
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 });
    geo.translate(0, 0, -depth / 2);
    const piv = new THREE.Group();
    const rr = shipRadius(y) - 0.02;
    piv.position.set(Math.sin(ang) * rr, y, Math.cos(ang) * rr);
    piv.rotation.set(0, ang - Math.PI / 2, tilt);
    piv.add(new THREE.Mesh(geo, M.tile));
    const front = Math.cos(ang - Math.PI / 2) >= 0 ? 1 : -1;  // côté du volet qui regarde l'avant
    const hh = Math.max(...shape.map((p) => p[1]));
    if (opts.plate) { // face sous le vent : inox à panneaux, bordée par les tuiles du bord d'attaque
      const inner = new THREE.Shape(opts.plate.map(([x, yy]) => new THREE.Vector2(x, yy)));
      const pm = new THREE.Mesh(new THREE.ShapeGeometry(inner), fwdMat);
      pm.position.z = front * (depth / 2 + 0.0115);
      if (front < 0) { pm.scale.z = -1; }
      piv.add(pm);
      for (const f of [0.14, 0.5, 0.86]) hingeBracket(piv, hh * f, front);
    }
    // charnière + carénage d'actionneur tuilé le long de la racine
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, hh * 0.92, 12), M.steel);
    hinge.position.set(0.0, hh * 0.48, 0); piv.add(hinge);
    const fr = opts.fairing || 0.034;
    const fair = new THREE.Mesh(new THREE.CapsuleGeometry(fr, hh * (opts.fairLen || 0.55), 8, 20), M.tile);
    fair.scale.set(0.75, 1, 1.15); fair.position.set(0.005, hh * (opts.fairY || 0.45), -front * fr * 0.7); piv.add(fair);
    g.add(piv);
    return piv;
  };
  // volets avant : grands volets en flèche, hauts sur la coiffe (bord d'attaque oblique, bord de fuite horizontal)
  const fwd = [[0, 0], [0.44, -0.02], [0.455, 0.17], [0.03, 0.64], [0, 0.62]];
  const fwdPlate = [[0.035, 0.03], [0.405, 0.015], [0.415, 0.15], [0.05, 0.555], [0.035, 0.55]];
  // volets arrière : entièrement tuilés, gros carénage arrondi le long de la racine
  const aft = [[0, 0], [0.36, 0], [0.34, 0.66], [0.1, 1.3], [0, 1.34]];
  const fy = 4.13, tiltF = Math.atan((shipRadius(fy) - shipRadius(fy + 0.62)) / 0.62);
  g.userData.flaps = [
    flap(fwd, fy, Math.PI / 2 + 0.14, 0.03, tiltF, { plate: fwdPlate, fairing: 0.03, fairLen: 0.6, fairY: 0.42 }),
    flap(fwd, fy, -Math.PI / 2 - 0.14, 0.03, tiltF, { plate: fwdPlate, fairing: 0.03, fairLen: 0.6, fairY: 0.42 }),
    flap(aft, 0.06, Math.PI / 2 + 0.13, 0.05, 0, { fairing: 0.07, fairLen: 0.95, fairY: 0.52 }),
    flap(aft, 0.06, -Math.PI / 2 - 0.13, 0.05, 0, { fairing: 0.07, fairLen: 0.95, fairY: 0.52 }),
  ];

  /* --- deux conduites externes annelées sur la face avant --- */
  const pg = pipeGeo(0.028, 3.12, [[0.06, 0.32], [1.3, 1.52], [2.5, 2.74], [2.9, 3.05]]);
  [-0.34, 0.34].forEach((a) => {
    const p = new THREE.Mesh(pg, M.steelIri);
    const rr = R + 0.03;
    p.position.set(Math.sin(a) * rr, 0.36, Math.cos(a) * rr); g.add(p);
    // pattes de fixation
    for (let y = 0.6; y < 3.4; y += 0.36) {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.018, 0.034), M.steel);
      br.position.set(Math.sin(a) * (R + 0.012), y, Math.cos(a) * (R + 0.012)); br.rotation.y = a; g.add(br);
    }
  });
  // raceway arrière (côté tuilé)
  const rw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 3.4, 0.024), M.tile);
  rw.position.set(Math.sin(Math.PI - 0.5) * (R + 0.01), 1.95, Math.cos(Math.PI - 0.5) * (R + 0.01)); rw.rotation.y = Math.PI - 0.5; g.add(rw);

  /* --- dessous : jupe + 6 Raptor (3 mer, 3 vide) --- */
  const skirt = new THREE.Mesh(new THREE.CircleGeometry(R - 0.01, 64), M.dark);
  skirt.rotation.x = Math.PI / 2; skirt.position.y = 0.005; g.add(skirt);
  const sl = nozzleGeo(0.028, 0.06, 0.2), vac = nozzleGeo(0.03, 0.115, 0.36);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + Math.PI / 6;
    const m1 = new THREE.Mesh(sl, M.bell); m1.position.set(Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1); g.add(m1);
    const a2 = a + Math.PI / 3;
    const m2 = new THREE.Mesh(vac, M.bell); m2.position.set(Math.cos(a2) * 0.29, 0, Math.sin(a2) * 0.29); g.add(m2);
  }
  return g;
}

/* ==================================================================
   SUPER HEAVY (premier étage)
   ================================================================== */
function buildBooster(M, aniso) {
  const g = new THREE.Group();
  const cyl = () => R;
  const vOf = (y) => y / BOOST_H;
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(R - 0.015, 0), new THREE.Vector2(R, 0.02), new THREE.Vector2(R, BOOST_H)];
  const tex = hullTextures({
    W: 1536 * Q, H: 4096 * Q, len: BOOST_H, radius: cyl, vOf, S: BOOST_H, seed: 9, aniso,
    soot: 0.2, doublers: 14,
    iriZones: [[5.6, 7.0, 0.55, 2.6], [3.0, 5.0, 0.3, 2.2]],
    slatBands: [[5.35, 0.05, 1.3], [1.6, 0.05, 1.3]],
    ports: [[-0.5, 4.2, 0.03, 'dark'], [0.62, 2.6, 0.03, 'dark'], [0.2, 6.2, 0.02, 'dark'], [-0.3, 0.95, 0.02, 'dark']],
  });
  const body = new THREE.Mesh(latheUV(pts, vOf, 192), new THREE.MeshPhysicalMaterial({
    map: tex.map, roughnessMap: tex.rm, metalnessMap: tex.rm, bumpMap: tex.bump, bumpScale: 1.3,
    metalness: 1, roughness: 1, envMapIntensity: 1.0,
    iridescence: 1, iridescenceMap: tex.iri, iridescenceThicknessMap: tex.iri, iridescenceIOR: 1.8, iridescenceThicknessRange: [180, 700],
  }));
  body.rotation.y = Math.PI;
  g.add(body);
  // dôme supérieur
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R - 0.01, 48, 16, 0, TAU, 0, Math.PI / 2), M.steel);
  dome.scale.y = 0.3; dome.position.y = BOOST_H - 0.02; g.add(dome);

  // anneau ajouré de hot staging (lames + relief)
  const rc = cnv(2048, 128), rg = rc.getContext('2d'), rb = cnv(2048, 128), rbg = rb.getContext('2d');
  rg.fillStyle = '#8a8f96'; rg.fillRect(0, 0, 2048, 128); rbg.fillStyle = '#bbb'; rbg.fillRect(0, 0, 2048, 128);
  for (let i = 0; i < 48; i++) {
    const x = i * (2048 / 48);
    rg.fillStyle = '#050505'; rg.fillRect(x + 8, 18, 2048 / 48 - 16, 92); rbg.fillStyle = '#222'; rbg.fillRect(x + 8, 18, 2048 / 48 - 16, 92);
    rg.fillStyle = 'rgba(255,255,255,.35)'; rg.fillRect(x + 8, 110, 2048 / 48 - 16, 2);
    dotsRaw(rg, x + 4, 8, x + 4, 120, 9, 2, 'rgba(90,70,52,.8)');
  }
  rg.fillStyle = 'rgba(0,0,0,.55)'; rg.fillRect(0, 0, 2048, 5); rg.fillRect(0, 123, 2048, 5);
  dotsRaw(rg, 0, 10, 2048, 10, 10, 2.2, 'rgba(90,70,52,.8)'); dotsRaw(rg, 0, 117, 2048, 117, 10, 2.2, 'rgba(90,70,52,.8)');
  const rt = new THREE.CanvasTexture(rc); rt.colorSpace = THREE.SRGBColorSpace; rt.anisotropy = aniso;
  const rbt = new THREE.CanvasTexture(rb);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R, R, RING_H, 128, 1, true), new THREE.MeshStandardMaterial({ map: rt, bumpMap: rbt, bumpScale: 2, metalness: 0.9, roughness: 0.38, side: THREE.DoubleSide }));
  ring.position.y = BOOST_H + RING_H / 2; g.add(ring);
  const glowRing = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.98, R * 0.98, RING_H * 0.9, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: 0, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
  glowRing.position.y = ring.position.y; g.add(glowRing); g.userData.glowRing = glowRing;
  // couronne supérieure (renfort) pour l'interface avec le vaisseau
  const crown = new THREE.Mesh(new THREE.TorusGeometry(R + 0.004, 0.008, 8, 128), M.steel);
  crown.rotation.x = Math.PI / 2; crown.position.y = BOOST_TOP; g.add(crown);

  // grid fins (3, grande taille sur V3) : cadre épais + treillis en losanges
  const gc = cnv(256, 256), gg = gc.getContext('2d');
  gg.fillStyle = '#000'; gg.fillRect(0, 0, 256, 256); gg.strokeStyle = '#fff'; gg.lineWidth = 6;
  for (let i = -256; i < 512; i += 26) { gg.beginPath(); gg.moveTo(i, 0); gg.lineTo(i + 256, 256); gg.stroke(); gg.beginPath(); gg.moveTo(i, 256); gg.lineTo(i + 256, 0); gg.stroke(); }
  gg.lineWidth = 18; gg.strokeRect(0, 0, 256, 256);
  const gt = new THREE.CanvasTexture(gc);
  const latt = new THREE.MeshStandardMaterial({ color: 0x8c9096, metalness: 0.9, roughness: 0.4, alphaMap: gt, alphaTest: 0.5, side: THREE.DoubleSide });
  const finSide = new THREE.MeshPhysicalMaterial({ color: 0x9a9ea5, metalness: 1, roughness: 0.3 });
  const finGeo = new THREE.BoxGeometry(0.36, 0.06, 0.3);
  const transp = new THREE.MeshBasicMaterial({ visible: false });
  [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 - (2 * Math.PI) / 3].forEach((a) => {
    const f = new THREE.Group();
    const box = new THREE.Mesh(finGeo, [finSide, finSide, latt, latt, finSide, transp]);
    box.position.z = R + 0.19; f.add(box);
    for (let k = -1; k <= 1; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.055, 0.008), finSide);
      blade.position.set(0, 0, R + 0.19 + k * 0.09); f.add(blade);
    }
    const act = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.06), M.steel); act.position.set(0, 0, R + 0.02); f.add(act);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.1, 12), M.chine); pin.rotation.x = Math.PI / 2; pin.position.set(0, 0, R + 0.06); f.add(pin);
    f.rotation.y = a; f.position.y = 6.78; g.add(f);
  });

  // chines (profilés latéraux arrondis)
  const chineGeo = new THREE.CapsuleGeometry(0.022, 4.25, 4, 12);
  [Math.PI / 2 - 0.15, -Math.PI / 2 + 0.15].forEach((a) => {
    const ch = new THREE.Mesh(chineGeo, M.chine);
    ch.scale.set(0.55, 1, 1);
    ch.position.set(Math.sin(a) * (R + 0.012), 2.75, Math.cos(a) * (R + 0.012)); ch.rotation.y = a; g.add(ch);
  });
  // raceway + conduites (COPV, câblage)
  const rw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 6.6, 0.03), M.chine);
  rw.position.set(Math.sin(-1.0) * (R + 0.012), 3.55, Math.cos(-1.0) * (R + 0.012)); rw.rotation.y = -1.0; g.add(rw);
  const bp = pipeGeo(0.024, 6.2, [[0.1, 0.3], [2.0, 2.2], [4.1, 4.3], [5.85, 6.05]]);
  [-0.34, 0.34].forEach((a) => {
    const p = new THREE.Mesh(bp, M.steelIri);
    p.position.set(Math.sin(a) * (R + 0.026), 0.42, Math.cos(a) * (R + 0.026)); g.add(p);
    for (let y = 0.7; y < 6.6; y += 0.42) {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.016, 0.03), M.steel);
      br.position.set(Math.sin(a) * (R + 0.01), y, Math.cos(a) * (R + 0.01)); br.rotation.y = a; g.add(br);
    }
  });

  // dessous : 33 Raptor (même disposition que les panaches de scene.js)
  const base = new THREE.Mesh(new THREE.CircleGeometry(R - 0.005, 64), new THREE.MeshStandardMaterial({ color: 0x141210, metalness: 0.4, roughness: 0.8 }));
  base.rotation.x = Math.PI / 2; base.position.y = 0.004; g.add(base);
  const geo = nozzleGeo(0.022, 0.054, 0.2, 28);
  const inst = new THREE.InstancedMesh(geo, M.bell, 33);
  const Mx = new THREE.Matrix4();
  let n = 0;
  [[3, 0.075, 0], [10, 0.215, 0.3], [20, 0.375, 0.15]].forEach(([c, rr, rot]) => {
    for (let i = 0; i < c; i++) { const a = (i / c) * TAU + rot; Mx.makeTranslation(Math.cos(a) * rr, 0, Math.sin(a) * rr); inst.setMatrixAt(n++, Mx); }
  });
  g.add(inst);
  return g;
}

/* point d'entrée */
export function createRocket(renderer) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const M = makeMaterials();
  return { ship: buildShip(M, aniso), booster: buildBooster(M, aniso) };
}
