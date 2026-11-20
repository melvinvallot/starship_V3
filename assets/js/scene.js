/* Starship V3 — scène 3D (Three.js)
   Fusée procédurale : acier inoxydable PBR, tuiles hexagonales, volets, grid fins, 39 Raptor,
   « 3 » chromé irisé, panaches de flamme, fumée, séparation à chaud. Pilotée par window.SS. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createRocket, nozzleGeo, R, BOOST_H, RING_H, BOOST_TOP, SHIP_H, SHIP_CYL } from './rocket.js';

const SS = (window.SS = window.SS || {});
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const win = (p, a, b, c, d) => sstep(a, b, p) * (1 - sstep(c, d, p));
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
function cnv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/* ---------- dimensions (1 unité = 10 m) : voir rocket.js ---------- */
const TOTAL = BOOST_TOP + SHIP_H;   // 12.44
const HALF = TOTAL / 2;

/* ---------- moteur de rendu ---------- */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
renderer.setPixelRatio(DPR);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 3000);
const maxAniso = renderer.capabilities.getMaxAnisotropy();

/* ---------- environnement (studio avec panneaux chauds / froids, comme l'affiche) ---------- */
function makeEnv() {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; void main(){
      float h = vP.y;
      vec3 c = mix(vec3(.012,.012,.016), vec3(.10,.105,.12), smoothstep(-.3,.9,h));
      c += vec3(.22,.2,.18) * exp(-abs(h+.02)*14.);     // ligne d'horizon claire
      gl_FragColor = vec4(c,1.); }`,
  })));
  const panel = (w, h, col, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(40, 12, '#ffffff', 2.4, [0, 34, 8]);       // softbox zénithale
  panel(14, 46, '#ff7a24', 3.0, [-30, 2, 10]);     // orange gauche
  panel(14, 46, '#3f5cff', 2.8, [30, 4, -4]);      // bleu droit
  panel(3, 60, '#ffffff', 3.0, [14, 0, 30]);       // bande avant droite
  panel(2, 60, '#ffffff', 2.5, [-16, 0, 26]);      // bande avant gauche
  panel(30, 4, '#b48cff', 1.4, [0, -14, -30]);     // violet bas arrière
  const pm = new THREE.PMREMGenerator(renderer);
  const t = pm.fromScene(s, 0.015).texture;
  pm.dispose();
  return t;
}
scene.environment = makeEnv();

/* ---------- ciel (noir de l'affiche → crépuscule du pas de tir → espace) ---------- */
const skyU = { uAtmo: { value: 0 }, uAlt: { value: 0 }, uPaper: { value: 0 }, uSun: { value: new THREE.Vector3(-0.75, 0.04, -0.66).normalize() } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 64, 32), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, uniforms: skyU,
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `
    uniform float uAtmo, uAlt, uPaper; uniform vec3 uSun; varying vec3 vD;
    void main(){
      vec3 d = normalize(vD); float h = d.y;
      vec3 space = vec3(.004,.0045,.007) + vec3(.012,.013,.02) * exp(-abs(h)*2.);
      vec3 zen = vec3(.015,.035,.11), mid = vec3(.12,.17,.36), hor = vec3(1.,.42,.16), gnd = vec3(.03,.025,.028);
      vec3 dusk;
      if (h > 0.) dusk = mix(hor, mix(mid, zen, smoothstep(.12,.75,h)), smoothstep(0.,.2,h));
      else dusk = mix(hor*.5, gnd, smoothstep(0.,.08,-h));
      float s = max(dot(d, uSun), 0.);
      dusk += vec3(1.,.55,.25) * (pow(s, 600.) * 30. + pow(s, 24.) * 1.4 + pow(s, 4.) * .25);
      float thin = smoothstep(0., 1., uAlt * 1.35 - h * .35);
      vec3 c = mix(space, dusk, clamp(uAtmo * (1. - thin), 0., 1.));
      // limbe bleu de l'atmosphère vue d'en haut
      c += vec3(.15,.38,1.) * uAtmo * smoothstep(.35,1.,uAlt) * exp(-abs(h + .06) * 26.) * .9;
      c += vec3(1.,.45,.2) * uAtmo * smoothstep(.35,1.,uAlt) * exp(-abs(h + .07) * 60.) * pow(s, 2.) * 1.2;
      c = mix(c, vec3(1.75), uPaper);
      gl_FragColor = vec4(c, 1.);
    }`,
}));
sky.renderOrder = -10;
scene.add(sky);

/* étoiles */
const STARS = 11000;
const starG = new THREE.BufferGeometry();
{
  const r = rng(11), pos = new Float32Array(STARS * 3), sz = new Float32Array(STARS), ph = new Float32Array(STARS);
  for (let i = 0; i < STARS; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * 1200, u * 1200, Math.sin(a) * s * 1200], i * 3);
    sz[i] = Math.pow(r(), 5) * 3.4 + 0.7; ph[i] = r() * 100;
  }
  starG.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  starG.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  starG.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
}
const starU = { uTime: { value: 0 }, uOp: { value: 0.6 }, uDpr: { value: DPR } };
const stars = new THREE.Points(starG, new THREE.ShaderMaterial({
  uniforms: starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute float aSize; attribute float aPh; uniform float uTime, uDpr; varying float vTw;
    void main(){ vTw = .65 + .35 * sin(uTime * (1.5 + fract(aPh) * 3.) + aPh);
      gl_PointSize = aSize * uDpr; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragmentShader: `uniform float uOp; varying float vTw;
    void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d);
      gl_FragColor = vec4(vec3(.85,.9,1.) * a * vTw * uOp, 1.); }`,
}));
stars.renderOrder = -9;
scene.add(stars);

/* ---------- lumières ---------- */
const sun = new THREE.DirectionalLight(0xffe2c4, 2.2); sun.position.set(-6, 5, 8); scene.add(sun);
const rim = new THREE.DirectionalLight(0x8fb0ff, 1.4); rim.position.set(7, 3, -6); scene.add(rim);
const hemi = new THREE.HemisphereLight(0x9aa6ff, 0x1a120c, 0.25); scene.add(hemi);
const fireLight = new THREE.PointLight(0xff8a3a, 0, 40, 1.6); scene.add(fireLight);
const stageLight = new THREE.PointLight(0xffa060, 0, 18, 1.8); scene.add(stageLight);
const ventGlow = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,230,200,1)'); gr.addColorStop(0.25, 'rgba(255,150,60,.6)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(sp); return sp; })();

/* ---------- panache de flamme ---------- */
const plumeVS = `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position,1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const plumeFS = `uniform float uTime, uInt, uCore, uSeed; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  void main(){
    float y = 1. - vUv.y;
    float fr = abs(dot(normalize(vN), normalize(vV)));
    float body = pow(fr, uCore);
    float nn = n(vec2(vUv.x * 18. + uSeed, y * 7. - uTime * 13.)) * .6 + n(vec2(vUv.x * 41. - uSeed, y * 19. - uTime * 31.)) * .4;
    float fall = pow(1. - y, 1.4);
    float a = body * fall * (.45 + .75 * nn) * uInt;
    float diam = pow(max(0., sin(y * 38. - uTime * 2.)), 14.) * (1. - smoothstep(0., .5, y)) * body;
    vec3 hot = vec3(1., .95, .86), mid = vec3(1., .56, .2), cool = vec3(.85, .28, .32);
    vec3 c = mix(hot, mid, smoothstep(0., .3, y)); c = mix(c, cool, smoothstep(.45, 1., y));
    c += vec3(1., .75, 1.) * diam * .9;
    gl_FragColor = vec4(c * a * 2.6, 1.);
  }`;
function makePlume(rTop, rBot, len, core = 1.2, k = 1) {
  const g = new THREE.Group();
  const mk = (rt, rb, L, c, s) => {
    const geo = new THREE.CylinderGeometry(rt, rb, L, 48, 24, true); geo.translate(0, -L / 2, 0);
    const mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uInt: { value: 0 }, uCore: { value: c }, uSeed: { value: s } }, vertexShader: plumeVS, fragmentShader: plumeFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; g.add(m); return m;
  };
  const outer = mk(rTop, rBot, len, core * 0.7, 3.1);
  const inner = mk(rTop * 0.82, rTop * 1.1, len * 0.42, core * 2.0, 7.7);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(rTop, 48), new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  disc.rotation.x = Math.PI / 2; disc.position.y = -0.02; g.add(disc);
  g.userData.set = (v, t, spread = 1, lenK = 1) => {
    g.visible = v > 0.002;
    outer.material.uniforms.uInt.value = v * 0.8 * k; inner.material.uniforms.uInt.value = v * 1.3 * k;
    outer.material.uniforms.uTime.value = inner.material.uniforms.uTime.value = t;
    outer.scale.set(spread, (1 + (spread - 1) * 0.6) * lenK, spread); inner.scale.set(1, lenK, 1);
    disc.material.opacity = v * 1.2;
  };
  g.visible = false;
  return g;
}

/* ---------- fumée du pas de tir ---------- */
function smokeTexture() {
  const c = cnv(128, 128), g = c.getContext('2d'), r = rng(5);
  for (let i = 0; i < 26; i++) {
    const x = 64 + (r() - 0.5) * 50, y = 64 + (r() - 0.5) * 50, rad = 18 + r() * 34;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const smokeTex = smokeTexture();
const PAD_Y = -HALF - 0.35;
const smoke = new THREE.Group(); scene.add(smoke);
const puffs = [];
for (let i = 0; i < 150; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0, color: 0x888888 }));
  s.userData = { life: 0, max: 1, v: new THREE.Vector3(), rot: 0, alive: false };
  smoke.add(s); puffs.push(s);
}
const sr = rng(77);
function spawnPuff(s, strength) {
  const a = sr() * Math.PI * 2, sp = 1.2 + sr() * 3.8;
  s.position.set(Math.cos(a) * 0.4, PAD_Y + sr() * 0.4, Math.sin(a) * 0.4 - 0.5);
  s.userData.v.set(Math.cos(a) * sp, 0.25 + sr() * 1.2, Math.sin(a) * sp * 0.6);
  s.userData.life = 0; s.userData.max = 3.5 + sr() * 4; s.userData.alive = true; s.userData.k = strength;
  s.material.rotation = sr() * 6.28;
}

/* ---------- le « 3 » chromé et le mot Starship ---------- */
function makeThree() {
  const pts = [];
  const ell = (cx, cy, rx, ry, a0, a1, n) => { for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * (i / n)) * Math.PI / 180; pts.push(new THREE.Vector3(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 0)); } };
  ell(0.05, 1.72, 2.25, 1.68, 158, -96, 46);
  pts.push(new THREE.Vector3(-0.55, 0.03, 0));
  ell(0.1, -1.86, 2.75, 1.86, 96, -158, 52);
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const geo = new THREE.TubeGeometry(curve, 420, 0.3, 48, false);
  geo.scale(1, 1, 0.5);
  // embouts arrondis
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xf2f2f2, metalness: 1, roughness: 0.14, envMapIntensity: 1.25,
    iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [120, 640], clearcoat: 1, clearcoatRoughness: 0.08,
  });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  [pts[0], pts[pts.length - 1]].forEach((p) => { const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 16), mat); cap.scale.z = 0.5; cap.position.copy(p); g.add(cap); });
  return g;
}
const textCanvas = cnv(4096, 1024);
const textTex = new THREE.CanvasTexture(textCanvas); textTex.colorSpace = THREE.SRGBColorSpace; textTex.anisotropy = maxAniso;
function drawText() {
  const g = textCanvas.getContext('2d');
  g.clearRect(0, 0, 4096, 1024);
  g.fillStyle = '#fff';
  g.font = '800 760px Archivo, "Helvetica Neue", Arial, sans-serif';
  try { g.letterSpacing = '-38px'; } catch (e) {}
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillText('Starship', 2048, 760);
  textTex.needsUpdate = true;
}
drawText();
if (document.fonts && document.fonts.load) document.fonts.load('800 200px Archivo').then(drawText).catch(() => {});
const textMat = new THREE.MeshBasicMaterial({ map: textTex, transparent: true, depthWrite: false, toneMapped: false, color: 0xffffff });
const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.25), textMat);

/* ---------- assemblage ---------- */
const world = new THREE.Group(); scene.add(world);
const stack = new THREE.Group(); world.add(stack);
const boosterPivot = new THREE.Group(); boosterPivot.position.y = 3.6; stack.add(boosterPivot);
const rocket = createRocket(renderer);
const booster = rocket.booster; booster.position.y = -3.6; boosterPivot.add(booster);
const shipPivot = new THREE.Group(); shipPivot.position.y = BOOST_TOP + 2.6; stack.add(shipPivot);
const ship = rocket.ship; ship.position.y = -2.6; shipPivot.add(ship);

const boosterPlume = makePlume(0.43, 1.25, 7.5, 1.1, 1.0); booster.add(boosterPlume); boosterPlume.position.y = -0.2;
const shipPlume = makePlume(0.36, 0.9, 4.2, 1.2, 0.9); ship.add(shipPlume); shipPlume.position.y = -0.34;

const heroGroup = new THREE.Group(); world.add(heroGroup);
const three3 = makeThree(); three3.position.z = -2.0; heroGroup.add(three3);
textPlane.position.set(0, 0.62, -0.95); heroGroup.add(textPlane);

/* ---------- post-traitement ---------- */
const composer = new EffectComposer(renderer);
composer.setPixelRatio(DPR);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.3, 0.5, 1.05);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------- étapes de l'anatomie (cible locale y, distance, élévation, rotation) ---------- */
const anatK = [
  { y: HALF, d: null, e: 0.0, r: 0.0 },                  // vue d'ensemble
  { y: BOOST_TOP + 4.75, d: 4.2, e: 0.12, r: 0.5 },       // coiffe
  { y: BOOST_TOP + 4.45, d: 4.4, e: 0.05, r: -1.0 },      // volets avant
  { y: BOOST_TOP + 3.4, d: 4.8, e: 0.0, r: 0.12 },        // soute
  { y: BOOST_TOP + 2.6, d: 6.2, e: 0.05, r: Math.PI },    // bouclier
  { y: BOOST_TOP + 0.45, d: 4.6, e: -0.22, r: 1.0 },      // volets arrière + moteurs
  { y: BOOST_TOP - 0.05, d: 3.6, e: 0.1, r: 0.35 },       // anneau
  { y: 6.75, d: 3.6, e: 0.55, r: 0.75 },                  // grid fins
  { y: 3.2, d: 7.5, e: 0.04, r: 1.45 },                   // chines
  { y: 3.6, d: 14, e: 0.02, r: 0.2 },                     // premier étage
  { y: 0.1, d: 4.4, e: -0.62, r: 0.1 },                   // 33 raptor
];

/* ---------- état courant amorti ---------- */
const cur = { ty: HALF, tx: 0, d: 25, e: 0, rot: 0, shiftX: 0, shiftY: 0, gap: 0.3, hero: 1, paper: 0, atmo: 0 };
let Dfull = 25, visScale = 1;
function fitDistances() {
  const fov = camera.fov * Math.PI / 180;
  const needH = 13.6 / 0.86;
  Dfull = needH / (2 * Math.tan(fov / 2));
  const asp = camera.aspect;
  // largeur du « 3 » ≈ 6.2 : garde-la dans l'écran sur mobile
  const needW = 6.6 / (2 * Math.tan(fov / 2) * asp);
  Dfull = Math.max(Dfull, needW);
  const visW = 2 * Dfull * Math.tan(fov / 2) * asp;
  const tw = Math.min(visW * 0.9, 11.2);
  textPlane.scale.set(tw, tw, 1);
  visScale = Math.min(1, asp);
}
fitDistances();
cur.d = Dfull;

function onResize() {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false); composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  fitDistances();
}
addEventListener('resize', onResize);

/* ---------- boucle ---------- */
const clock = new THREE.Clock();
let time = 0, shakeT = 0;
const camPos = new THREE.Vector3(), camTgt = new THREE.Vector3();
const prog = (k) => (SS.st && SS.st[k] ? SS.st[k].progress : 0);

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;
  const post = prog('post');
  const fade = 1 - sstep(0.15, 0.85, post);
  canvas.style.opacity = fade;
  if (fade <= 0.001) { canvas.style.visibility = 'hidden'; return; }
  canvas.style.visibility = 'visible';

  const heroP = prog('hero'), introP = prog('intro'), anatP = prog('anat'), launchP = prog('launch');
  const reduce = SS.reduce;
  const mobile = camera.aspect < 0.85;
  const k = 1 - Math.exp(-dt * 5.5);
  const kf = 1 - Math.exp(-dt * 9);

  // révélation initiale (après le loader)
  const rv = SS.revealAt ? clamp((performance.now() - SS.revealAt) / 2600) : 0;
  const rvE = 1 - Math.pow(1 - rv, 4);

  /* ----- cible caméra ----- */
  let T = {};
  const idle = reduce ? 0 : Math.sin(time * 0.22) * 0.32;
  const heroMode = 1 - sstep(0.0, 0.08, anatP);
  // anatomie
  const n = anatK.length - 1;
  const f = anatP * n, i0 = Math.min(n - 1, Math.floor(f)), fr = f - i0;
  const w = sstep(0.18, 0.82, fr);
  const A = anatK[i0], B = anatK[i0 + 1];
  const dA = A.d ?? Dfull, dB = B.d ?? Dfull;
  T.ty = lerp(A.y, B.y, w);
  T.d = lerp(dA, dB, w) * (mobile ? 1.25 : 1);
  T.e = lerp(A.e, B.e, w);
  T.rot = lerp(A.r, B.r, w) + idle * heroMode * (1 - sstep(0, 0.5, anatP));
  const shiftOn = sstep(0.0, 0.9, introP);
  T.shiftX = mobile ? 0 : 0.2 * shiftOn;
  T.shiftY = mobile ? -0.17 * sstep(0.0, 0.03, anatP) : 0;
  T.gap = 0.3 * (1 - sstep(0.1, 0.8, introP));
  T.hero = 1 - sstep(0.0, 0.55, heroP);
  T.atmo = 0; T.alt = 0;
  let stackY = -HALF, shipUp = 0, bDown = 0, bX = 0, bRotZ = 0, bFlame = 0, sFlame = 0, bbFlame = 0, hsGlow = 0, spread = 1, smokeOn = 0, shake = 0, stackRot = null;

  if (launchP > 0) {
    const p = launchP;
    const lw = sstep(0.0, 0.06, p); // passage de l'anatomie au lancement
    const ign = sstep(0.075, 0.12, p);
    bFlame = ign * (1 - sstep(0.52, 0.535, p));
    const ascent = clamp((p - 0.12) / 0.435);
    const rise = Math.pow(ascent, 2.1) * 52 + clamp((p - 0.555) / 0.445) * 30;
    stackY = -HALF + rise;
    sFlame = sstep(0.53, 0.545, p);
    const sep = clamp((p - 0.56) / 0.44);
    shipUp = Math.pow(sep, 1.5) * 26;
    bDown = Math.pow(sep, 1.2) * 9;
    bX = sstep(0.0, 1.0, sep) * 3.5;
    bRotZ = sstep(0.6, 0.82, p) * Math.PI * 0.92;
    bbFlame = win(p, 0.72, 0.745, 0.86, 0.89) * 0.55;
    hsGlow = win(p, 0.528, 0.545, 0.58, 0.64);
    spread = 1 + ascent * 1.4 + sep * 0.8;
    smokeOn = ign * (1 - sstep(0.18, 0.3, p));
    shake = bFlame * (0.03 + 0.09 * (1 - sstep(0.12, 0.28, p))) + hsGlow * 0.06;

    // cible de caméra en coordonnées monde
    const follow = rise - 4 * (1 - Math.exp(-rise / 4));
    const aY = -HALF + 5.4 + follow;
    const ringY = stackY + BOOST_TOP + shipUp * 0.5;
    const shipY = stackY + BOOST_TOP + 2.6 + shipUp;
    const wr = win(p, 0.47, 0.53, 0.62, 0.72), ws = sstep(0.64, 0.82, p);
    const wy = aY * (1 - wr) * (1 - ws) + ringY * wr * (1 - ws) + shipY * ws;
    const wd = lerp(lerp(lerp(22, 27, sstep(0.12, 0.45, p)), 13, wr), 17, ws);
    T.ty = lerp(T.ty, wy + HALF, lw);
    T.d = lerp(T.d, wd * (mobile ? 1.3 : 1), lw);
    T.e = lerp(T.e, lerp(-0.1, 0.06, sstep(0.3, 0.6, p)), lw);
    T.shiftX = lerp(T.shiftX, 0, lw); T.shiftY = lerp(T.shiftY, mobile ? -0.05 : -0.04, lw);
    stackRot = lerp(T.rot, 0.35 + p * 0.9, lw);
    T.rot = stackRot;
    T.gap = 0;
    T.atmo = sstep(0.0, 0.07, p);
    T.alt = clamp(rise / 70);
  }

  // paper (affiche blanche)
  T.paper = (SS.paper || 0) * (1 - sstep(0, 0.35, heroP));

  // amortissement
  for (const key of ['ty', 'd', 'e', 'rot', 'shiftX', 'shiftY', 'gap', 'hero', 'paper', 'atmo']) cur[key] += (T[key] - cur[key]) * (key === 'paper' || key === 'atmo' ? k * 0.6 : k);
  cur.alt = T.alt;

  /* ----- application ----- */
  const bob = reduce ? 0 : Math.sin(time * 0.8) * 0.05 * cur.hero;
  const introDrop = (1 - rvE) * -16;
  stack.position.y = stackY + bob + introDrop;
  stack.rotation.y = cur.rot + (reduce ? 0 : SS.mx * 0.18 * cur.hero);
  shipPivot.position.y = BOOST_TOP + 2.6 + cur.gap + shipUp;
  boosterPivot.position.set(bX, 3.6 - bDown, 0);
  boosterPivot.rotation.z = bRotZ;
  shipPivot.rotation.z = -sstep(0.0, 1.0, clamp((launchP - 0.6) / 0.4)) * 0.12;

  // hero : « 3 » et texte
  const hv = cur.hero * rvE * (1 - sstep(0.45, 0.9, heroP)) * (anatP > 0 || launchP > 0 ? 0 : 1);
  heroGroup.visible = hv > 0.003;
  heroGroup.position.y = 0.05 + (1 - cur.hero) * 2;
  three3.scale.setScalar(lerp(0.75, 1, hv));
  three3.rotation.y = (reduce ? 0 : SS.mx * 0.35 + Math.sin(time * 0.35) * 0.12);
  three3.rotation.x = (reduce ? 0 : SS.my * 0.12);
  three3.position.z = -2.0 - (1 - cur.hero) * 6;
  three3.children.forEach((m) => { m.material.transparent = hv < 0.999; m.material.opacity = hv; });
  textMat.opacity = clamp((rv - 0.25) / 0.5) * Math.min(cur.hero, hv * 4);
  textMat.color.setRGB(0.93 - cur.paper * 0.9, 0.93 - cur.paper * 0.9, 0.94 - cur.paper * 0.89);
  textPlane.position.x = (reduce ? 0 : SS.mx * -0.15);

  // flammes, lumières
  boosterPlume.userData.set(Math.max(bFlame, bbFlame) * (0.92 + Math.random() * 0.08), time, spread);
  const sepK = clamp((launchP - 0.56) / 0.44);
  shipPlume.userData.set(sFlame * (0.92 + Math.random() * 0.08), time, 1 + sepK * 1.2, 0.08 + 0.92 * sstep(0, 0.12, sepK));
  booster.userData.glowRing.material.opacity = hsGlow * 0.9;
  ventGlow.material.opacity = hsGlow * 0.85; ventGlow.position.set(0, stack.position.y + BOOST_TOP, 0.2); ventGlow.scale.set(2.4 + hsGlow * 1.2, 0.9 + hsGlow * 0.4, 1);
  const bw = new THREE.Vector3(); booster.getWorldPosition(bw);
  fireLight.position.set(bw.x, bw.y - 3.2, bw.z - 0.6); fireLight.intensity = bFlame * 22 * (0.85 + Math.random() * 0.3);
  stageLight.position.set(0, stack.position.y + BOOST_TOP + shipUp * 0.3, -0.2); stageLight.intensity = (hsGlow * 14 + sFlame * 2) * (0.85 + Math.random() * 0.3);

  // fumée
  if (smokeOn > 0.01 || puffs.some((p) => p.userData.alive)) {
    let spawn = smokeOn > 0.01 ? Math.ceil(smokeOn * 3) : 0;
    for (const s of puffs) {
      const u = s.userData;
      if (!u.alive) { if (spawn > 0) { spawnPuff(s, smokeOn); spawn--; } else { s.material.opacity = 0; continue; } }
      u.life += dt;
      const t = u.life / u.max;
      if (t >= 1) { u.alive = false; s.material.opacity = 0; continue; }
      u.v.multiplyScalar(1 - dt * 0.35); u.v.y += dt * 0.08;
      s.position.addScaledVector(u.v, dt);
      const sc = 1.4 + t * 7.5; s.scale.set(sc, sc, 1);
      s.material.opacity = Math.sin(Math.PI * Math.min(1, t * 1.6)) * 0.85 * u.k;
      const lit = bFlame * Math.exp(-(s.position.y - PAD_Y) * 0.25) * (1 - t);
      s.material.color.setRGB(0.3 + lit * 0.55, 0.28 + lit * 0.3, 0.28 + lit * 0.1);
      s.material.rotation += dt * 0.1;
    }
  }

  // caméra
  const fov = camera.fov * Math.PI / 180;
  const visH = 2 * cur.d * Math.tan(fov / 2), visW = visH * camera.aspect;
  camTgt.set(-cur.shiftX * visW, cur.ty - HALF + (launchP > 0 ? 0 : 0) + cur.shiftY * visH, 0);
  if (launchP > 0) camTgt.y = cur.ty - HALF; // déjà en coordonnées monde
  if (launchP > 0) camTgt.y += cur.shiftY * visH;
  const par = reduce ? 0 : 1;
  camPos.set(camTgt.x + SS.mx * 0.5 * par * (cur.d / 25), camTgt.y + Math.sin(cur.e) * cur.d - SS.my * 0.35 * par * (cur.d / 25), Math.cos(cur.e) * cur.d);
  shakeT += dt * 40;
  if (shake > 0 && !reduce) { camPos.x += (Math.sin(shakeT * 1.3) + Math.sin(shakeT * 2.7)) * shake * 0.5; camPos.y += Math.sin(shakeT * 1.9 + 1) * shake * 0.5; }
  camera.position.copy(camPos);
  camera.lookAt(camTgt);

  // ciel & étoiles suivent la caméra
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  skyU.uAtmo.value = cur.atmo; skyU.uAlt.value = cur.alt; skyU.uPaper.value = cur.paper;
  starU.uTime.value = time;
  starU.uOp.value = (0.55 + 0.45 * sstep(0.3, 1, cur.alt)) * (1 - cur.atmo * (1 - sstep(0.2, 0.8, cur.alt))) * (1 - cur.paper);
  renderer.toneMappingExposure = 1.0 - cur.paper * 0.05;
  bloom.strength = (0.26 + bFlame * 0.25 + hsGlow * 0.35 + sFlame * 0.1) * (1 - cur.paper);
  bloom.threshold = 1.05 + cur.atmo * 0.5;
  sun.intensity = 2.2 + cur.atmo * 0.6;
  sun.color.setRGB(1, lerp(0.89, 0.7, cur.atmo), lerp(0.77, 0.5, cur.atmo));

  composer.render();
}

// rendu d'amorçage (compile les shaders avant la fin du loader)
camera.position.set(0, 0, Dfull); camera.lookAt(0, 0, 0);
composer.render();
SS.ready = true;
requestAnimationFrame(frame);
