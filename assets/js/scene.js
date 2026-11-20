/* Starship V3 — scène 3D (Three.js)
   Fusée procédurale : acier inoxydable PBR, tuiles hexagonales, volets, grid fins, 39 Raptor,
   « 3 » chromé irisé, panaches de flamme, fumée, séparation à chaud. Pilotée par window.SS. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createRocket, nozzleGeo, R, BOOST_H, RING_H, BOOST_TOP, SHIP_H, SHIP_CYL } from './rocket.js';
import { createPad, glowTexture } from './tower.js';

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
const envStudio = makeEnv();
scene.environment = envStudio;
/* environnement couvert (retour) : ciel gris-bleu diffus, horizon clair, sol sombre */
function makeEnvOver() {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; void main(){
      float h = vP.y;
      vec3 c = h > 0. ? mix(vec3(.75,.78,.88), vec3(.42,.47,.62), smoothstep(0.,.8,h)) : mix(vec3(.4,.38,.4), vec3(.08,.07,.07), smoothstep(0.,.3,-h));
      c += vec3(.5,.42,.5) * exp(-abs(h)*10.) * .6;
      gl_FragColor = vec4(c * 1.2,1.); }`,
  })));
  const pm = new THREE.PMREMGenerator(renderer);
  const t = pm.fromScene(s, 0.04).texture;
  pm.dispose();
  return t;
}
const envOver = makeEnvOver();
scene.fog = new THREE.FogExp2(0x8a93a8, 0);

/* ---------- ciel (noir de l'affiche → crépuscule du pas de tir → espace) ---------- */
const skyU = { uRe: { value: 0 }, uAtmo: { value: 0 }, uAlt: { value: 0 }, uPaper: { value: 0 }, uOver: { value: 0 }, uNight: { value: 0 }, uMoon: { value: new THREE.Vector3(-0.55, 0.36, -0.75).normalize() }, uSun: { value: new THREE.Vector3(-0.75, 0.04, -0.66).normalize() } };
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 64, 32), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, uniforms: skyU,
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `
    uniform float uAtmo, uAlt, uPaper, uOver, uNight, uRe; uniform vec3 uSun, uMoon; varying vec3 vD;
    float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + 7.1; a *= .5; } return s; }
    void main(){
      vec3 d = normalize(vD); float h = d.y;
      vec3 space = vec3(.004,.0045,.007) + vec3(.012,.013,.02) * exp(-abs(h)*2.);
      vec3 zen = vec3(.015,.035,.11), mid = vec3(.12,.17,.36), hor = vec3(1.,.42,.16), gnd = vec3(.03,.025,.028);
      vec3 dusk;
      if (h > 0.) dusk = mix(hor, mix(mid, zen, smoothstep(.12,.75,h)), smoothstep(0.,.2,h));
      else dusk = mix(hor, gnd, smoothstep(0.,.14,-h));
      float s = max(dot(d, uSun), 0.);
      dusk += vec3(1.,.55,.25) * (pow(s, 600.) * 30. + pow(s, 24.) * 1.4 + pow(s, 4.) * .25);
      // rentrée : espace noir, limbe bleu fondu, Terre sombre et voilée sous l'horizon
      if (uRe > .001) {
        float hz = h + .07;
        vec2 ep = d.xz / (abs(hz) + .05);
        float ec = fbm(ep * .6 + 2.);
        vec3 earth = mix(vec3(.13,.19,.33), vec3(.025,.04,.08), smoothstep(0., .45, -hz));
        earth += vec3(.16,.18,.22) * smoothstep(.45, .8, ec) * smoothstep(.0, .25, -hz) * .6;
        vec3 above = vec3(.005,.006,.014) + vec3(.22,.42,.95) * exp(-max(hz, 0.) * 11.) * .9 + vec3(1.,.55,.3) * exp(-max(hz, 0.) * 55.) * .35;
        vec3 re = mix(earth, above, smoothstep(-.02, .02, hz));
        dusk = mix(dusk, re, uRe);
      }
      // ciel couvert du retour (photos 1 à 3) puis heure bleue (photo 4)
      if (uOver > .001) {
        vec2 cp = d.xz / (max(h, 0.) + .16) * .9;
        float cl = fbm(cp * 1.1 + vec2(3., 1.)), cl2 = fbm(cp * 3.2 - 4.);
        float cov = smoothstep(.32, .78, cl * .75 + cl2 * .35) * smoothstep(0., .1, h);
        vec3 overSky = mix(vec3(.40,.45,.56), vec3(.17,.22,.36), smoothstep(0., .6, h));
        vec3 cloudL = vec3(.50,.54,.64), cloudD = vec3(.22,.26,.38);
        vec3 nightSky = mix(vec3(.66,.47,.62), vec3(.10,.10,.26), smoothstep(-.02, .5, h));
        vec3 nightCL = vec3(.50,.38,.56), nightCD = vec3(.16,.14,.27);
        vec3 cc = mix(cloudD, cloudL, smoothstep(.3, .9, cl2));
        vec3 nc = mix(nightCD, nightCL, smoothstep(.35, .95, cl2) * (1. - smoothstep(0., .5, h)) + .15);
        vec3 o = mix(overSky, cc, cov * .85 * smoothstep(-.02, .06, h));
        vec3 n = mix(nightSky, nc, cov * .7 * smoothstep(-.02, .06, h));
        // lune en croissant
        float md = dot(d, uMoon), md2 = dot(d, normalize(uMoon + vec3(.012, .006, .0)));
        float moon = smoothstep(.99985, .99992, md) * (1. - smoothstep(.99982, .9999, md2));
        n += vec3(1., .97, .9) * moon * 2.2 * (1. - cov * .6) + vec3(.5,.45,.6) * pow(max(md, 0.), 400.) * .25;
        vec3 ov = mix(o, n, uNight);
        vec3 hzC = mix(vec3(.36,.40,.50), vec3(.50,.37,.52), uNight), gC = mix(vec3(.17,.17,.16), vec3(.12,.10,.14), uNight);
        if (h < 0.) ov = mix(hzC, gC, smoothstep(0., .06, -h));
        dusk = mix(dusk, ov, uOver);
      }
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
const STARS = 3200;
const starG = new THREE.BufferGeometry();
{
  const r = rng(11), pos = new Float32Array(STARS * 3), sz = new Float32Array(STARS), ph = new Float32Array(STARS);
  for (let i = 0; i < STARS; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * s * 1200, u * 1200, Math.sin(a) * s * 1200], i * 3);
    sz[i] = Math.pow(r(), 6) * 3.2 + 0.6; ph[i] = r() * 100;
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

/* ---------- pas de tir : tour « Mechazilla », table de lancement, site (tower.js) ---------- */
const OLM_H = 1.9;                       // la table de lancement porte la fusée à y = -HALF
const GY = -HALF - OLM_H;                // niveau du sol
const TX = R + 0.6 + 0.7;               // axe de la tour, à droite de la fusée
const ARM_Y = GY + 12.6;                 // hauteur des rails de capture
const CATCH_Y = ARM_Y - 4.12 + 2.6;      // centre du vaisseau une fois posé sur les bras
const pad = createPad({ olmX: TX, olmH: OLM_H });
pad.position.set(TX, GY, 0);
pad.rotation.y = Math.PI;                // bras tournés vers la fusée (−x)
pad.visible = false;
world.add(pad);

/* ---------- effets du retour ---------- */
// 3 Raptor « mer » rallumés pour la bascule et l'atterrissage
const landPlumes = [0, 1, 2].map((i) => {
  const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
  const pl = makePlume(0.055, 0.2, 2.6, 1.35, 0.85);
  pl.position.set(Math.cos(a) * 0.1, -0.2, Math.sin(a) * 0.1);
  ship.add(pl); return pl;
});
// plasma de rentrée : deux gaines qui épousent la coque (tuiles chauffées au rouge + onde de choc rose),
// un halo diffus sous le ventre et un sillage ionisé orienté à l'opposé de la vitesse
function shipRadiusAt(y) { return y < SHIP_CYL ? R : R * Math.sqrt(Math.max(0, 1 - Math.pow((y - SHIP_CYL) / (SHIP_H - SHIP_CYL), 2))); }
const NOISE_GLSL = `float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * n(p); p = p * 2.07 + 3.1; a *= .5; } return s; }`;
function sheathGeo(off, stand, tipExt) {
  const pts = [];
  const N = 70;
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = -0.25 + t * (SHIP_H + 0.25 + tipExt);
    const yy = Math.min(y, SHIP_H - 0.001);
    let r = Math.max(0.001, (y > SHIP_H ? 0 : shipRadiusAt(Math.max(0, yy)))) + off;
    if (y > SHIP_H - 0.6) r *= Math.sqrt(Math.max(0, 1 - Math.pow((y - (SHIP_H - 0.6)) / (0.6 + tipExt), 2)));
    pts.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  const g = new THREE.LatheGeometry(pts, 96);
  // décalage côté ventre (−z) : l'onde de choc se tient à distance de la coque
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), L = Math.hypot(x, z) || 1;
    const belly = Math.max(0, -z / L);
    p.setX(i, x + (x / L) * stand * belly); p.setZ(i, z + (z / L) * stand * belly * 1.4);
  }
  g.computeVertexNormals();
  return g;
}
const sheathVS = `varying vec3 vNl; varying vec3 vPl; varying vec3 vN; varying vec3 vV;
  void main(){ vNl = normal; vPl = position; vec4 mv = modelViewMatrix * vec4(position,1.);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
function makeSheath(off, stand, tipExt, frag) {
  const mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uInt: { value: 0 } }, vertexShader: sheathVS, fragmentShader: frag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const m = new THREE.Mesh(sheathGeo(off, stand, tipExt), mat); m.frustumCulled = false; m.visible = false;
  m.userData.set = (v, t) => { m.visible = v > 0.003; mat.uniforms.uInt.value = v; mat.uniforms.uTime.value = t; };
  return m;
}
// tuiles chauffées : lueur rouge-orangé qui colle au ventre
const hotTiles = makeSheath(0.012, 0.0, 0.02, `uniform float uTime, uInt; varying vec3 vNl; varying vec3 vPl; varying vec3 vN; varying vec3 vV; ${NOISE_GLSL}
  void main(){
    float belly = smoothstep(.05, -.85, vNl.z);
    float ang = atan(vPl.x, vPl.z);
    float fl = fbm(vec2(ang * 5., vPl.y * 2.2 + uTime * 3.)) ;
    float nose = smoothstep(${(SHIP_H - 1.4).toFixed(2)}, ${SHIP_H.toFixed(2)}, vPl.y);
    float a = belly * (.45 + .7 * fl) * (1. + nose * 1.4) * uInt;
    vec3 c = mix(vec3(1., .28, .08), vec3(1., .62, .3), fl * belly + nose * .5);
    gl_FragColor = vec4(c * a * .55, 1.);
  }`);
// onde de choc : enveloppe rose-magenta, plus dense sur les bords (vue rasante)
const shock = makeSheath(0.035, 0.0, 0.12, `uniform float uTime, uInt; varying vec3 vNl; varying vec3 vPl; varying vec3 vN; varying vec3 vV; ${NOISE_GLSL}
  void main(){
    float belly = smoothstep(.35, -.8, vNl.z);
    float fr = 1. - abs(dot(normalize(vN), normalize(vV)));
    float ang = atan(vPl.x, vPl.z);
    float st = fbm(vec2(ang * 9., vPl.y * 1.4 - uTime * 7.)) * .65 + n(vec2(ang * 23., vPl.y * 4. - uTime * 15.)) * .35;
    float a = pow(fr, 3.5) * belly * (.3 + 1.1 * st * st) * uInt;
    vec3 c = mix(vec3(1., .55, .35), vec3(1., .3, .7), smoothstep(.5, .95, fr));
    gl_FragColor = vec4(c * a * .8, 1.);
  }`);
ship.add(hotTiles, shock);
const plasmaTex = glowTexture('rgba(255,210,220,1)', 'rgba(255,110,170,.35)');
const plasmaHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: plasmaTex, color: 0xff7aa8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
world.add(plasmaHalo);
// sillage ionisé
const plasmaTrail = (() => {
  const L = 16, geo = new THREE.CylinderGeometry(3.6, 0.75, L, 64, 24, true); geo.translate(0, L / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uInt: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: plumeVS,
    fragmentShader: `uniform float uTime, uInt; varying vec2 vUv; varying vec3 vN; varying vec3 vV; ${NOISE_GLSL}
      void main(){
        float y = vUv.y;                                   // 0 = au vaisseau, 1 = loin derrière
        float fr = pow(abs(dot(normalize(vN), normalize(vV))), 2.4);
        float st = fbm(vec2(vUv.x * 18., y * 3. - uTime * 5.)) * .7 + n(vec2(vUv.x * 52., y * 9. - uTime * 13.)) * .3;
        float a = fr * exp(-y * 4.2) * (.15 + 1.1 * st * st) * uInt;
        vec3 c = mix(vec3(1., .55, .45), vec3(.75, .25, .85), smoothstep(0., .35, y));
        gl_FragColor = vec4(c * a * .32, 1.);
      }`,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false;
  m.userData.set = (v, t) => { m.visible = v > 0.003; mat.uniforms.uInt.value = v; mat.uniforms.uTime.value = t; };
  world.add(m); return m;
})();
const wakeDir = new THREE.Vector3(), wakeUp = new THREE.Vector3(0, 1, 0), wakeTmp = new THREE.Vector3();
// boule de feu au rallumage (photo 1) et vapeur à la capture (photo 3)
const fireTex = glowTexture('rgba(255,250,210,1)', 'rgba(255,150,40,.7)');
const fireball = new THREE.Group(); fireball.rotation.y = -Math.PI / 2; ship.add(fireball);
const vapor = new THREE.Group(); world.add(vapor);
{
  const r = rng(808);
  for (let i = 0; i < 14; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: i < 9 ? fireTex : smokeTex, color: i < 9 ? 0xffa040 : 0x3a302a, transparent: true, depthWrite: false, blending: i < 9 ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: 0 }));
    sp.userData = { o: new THREE.Vector3(0.45 + r() * 0.5, 0.1 + r() * 0.5, (r() - 0.5) * 0.5), v: new THREE.Vector3(0.8 + r() * 1.4, -0.3 + r() * 0.9, (r() - 0.5) * 0.8), s: 0.5 + r() * 0.6, ph: r() };
    fireball.add(sp);
  }
  for (let i = 0; i < 18; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0xeeeef2, transparent: true, depthWrite: false, opacity: 0 }));
    const side = i % 2 ? 1 : -1;
    sp.userData = { o: new THREE.Vector3(0.2 + r() * 0.4, ARM_Y + 0.05 + r() * 0.3, side * (0.55 + r() * 0.2)), v: new THREE.Vector3(0.3 + r() * 0.5, 0.15 + r() * 0.35, side * (0.3 + r() * 0.6)), s: 0.5 + r() * 0.6 };
    vapor.add(sp);
  }
}
// trajectoire du vaisseau pendant le retour (centre du vaisseau, coordonnées monde)
const retPathQ = [0, 0.15, 0.3, 0.42, 0.58, 0.72, 0.76];
const retPath = new THREE.CatmullRomCurve3([
  new THREE.Vector3(26, 80, 0), new THREE.Vector3(12, 44, 0), new THREE.Vector3(4.2, 19, 0.1),
  new THREE.Vector3(-1.4, 11, 0.15), new THREE.Vector3(-0.6, 6.2, 0.05), new THREE.Vector3(0, CATCH_Y + 0.35, 0), new THREE.Vector3(0, CATCH_Y, 0),
], false, 'centripetal');
function retShipPos(q, out) {
  if (q >= 0.76) return out.set(0, CATCH_Y, 0);
  let i = 0; while (i < retPathQ.length - 2 && q > retPathQ[i + 1]) i++;
  const f = clamp((q - retPathQ[i]) / (retPathQ[i + 1] - retPathQ[i]));
  return retPath.getPoint((i + f) / (retPathQ.length - 1), out);
}
// assiette (rotation autour de z) : à plat (nez vers −x, ventre tuilé en bas), bascule, nez penché à l'opposé de la tour, puis vertical
function retPitch(q) {
  const flat = Math.PI / 2;
  if (q < 0.3) return flat;
  if (q < 0.41) return lerp(flat, 0.3, sstep(0.3, 0.41, q));
  if (q < 0.62) return lerp(0.3, 0.1, sstep(0.41, 0.62, q));
  return lerp(0.1, 0, sstep(0.62, 0.745, q));
}
SS.retPitch = retPitch;
// caméra du retour : cible = mélange point fixe / vaisseau (f), distance, lacet, élévation
const retK = [
  { q: 0.0, f: 1, p: [0, 0, 0], d: 12, yaw: 0.35, e: 0.12 },
  { q: 0.2, f: 1, p: [0, 0, 0], d: 13, yaw: 0.2, e: 0.08 },
  { q: 0.33, f: 1, p: [0, 0, 0], d: 15.5, yaw: 0.05, e: 0.03 },
  { q: 0.46, f: 0.55, p: [0.7, ARM_Y - 1.5, 0], d: 23, yaw: 0.6, e: 0.02 },
  { q: 0.62, f: 0.3, p: [0.8, ARM_Y - 3.2, 0], d: 28, yaw: 0.45, e: 0.04 },
  { q: 0.76, f: 0, p: [0.35, ARM_Y - 0.9, 0], d: 11.5, yaw: 0.4, e: -0.03 },
  { q: 0.88, f: 0, p: [0.2, ARM_Y - 1.7, 0], d: 11, yaw: 0.25, e: -0.16 },
  { q: 1.0, f: 0, p: [0.1, ARM_Y - 2.4, 0], d: 11, yaw: 0.4, e: -0.28 },
];
const retTmp = new THREE.Vector3(), retTmp2 = new THREE.Vector3();

/* ---------- post-traitement ---------- */
const composer = new EffectComposer(renderer);
composer.setPixelRatio(DPR);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.3, 0.5, 1.05);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* ---------- annotations du hero ---------- */
const annots = [
  ['Coiffe', 'Nose cone', ship, [0.12, 4.95, 0.12], 'r'],
  ['Soute', 'Payload bay', ship, [0.44, 3.55, 0.1], 'r'],
  ['Volets arrière', 'Aft flaps', ship, [0.75, 0.75, 0], 'r'],
  ['Anneau de hot staging', 'Hot-staging ring', booster, [0.45, BOOST_TOP - 0.1, 0.05], 'r'],
  ['Premier étage', 'First stage', booster, [0.45, 4.6, 0.05], 'r'],
  ['33 × Raptor 3', 'Engines', booster, [0.28, -0.2, 0.1], 'r'],
  ['Volets avant', 'Forward flaps', ship, [-0.62, 4.5, 0], 'l'],
  ['Second étage', 'Second stage', ship, [-0.45, 2.4, 0.05], 'l'],
  ['6 × Raptor 3', 'Dans la jupe', ship, [-0.25, -0.15, 0.1], 'l'],
  ['Grid fins', 'Grilles de pilotage', booster, [-0.72, 6.78, 0.1], 'l'],
  ['Chines', 'Profilés latéraux', booster, [-0.5, 3.6, 0.05], 'l'],
];
const annotSvg = document.getElementById('annotSvg');
const annotLabels = document.getElementById('annotLabels');
const annotEl = document.getElementById('annot');
const aItems = annots.map(([t, s, obj, p, side]) => {
  const el = document.createElement('div'); el.className = 'alabel ' + side;
  el.innerHTML = `<small>${s}</small>${t}`; annotLabels.appendChild(el);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); annotSvg.appendChild(path);
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', '2'); annotSvg.appendChild(dot);
  return { el, path, dot, obj, p: new THREE.Vector3(...p), side, w: 0, h: 0, sy: 0 };
});
function measureAnnots() { aItems.forEach((a) => { a.w = a.el.offsetWidth; a.h = a.el.offsetHeight; }); }
measureAnnots();
if (document.fonts) document.fonts.ready.then(measureAnnots);
const tmpV = new THREE.Vector3();
function updateAnnots(op, t) {
  annotEl.style.opacity = op;
  if (op <= 0.001 || innerWidth < 761) return;
  const W = innerWidth, H = innerHeight;
  // centre et largeur de la fusée à l'écran
  const c0 = tmpV.set(0, HALF, 0); stack.localToWorld(c0); c0.project(camera);
  const cx = (c0.x * 0.5 + 0.5) * W;
  const e = tmpV.set(R, HALF, 0); stack.localToWorld(e); e.project(camera);
  const halfW = Math.abs((e.x * 0.5 + 0.5) * W - cx);
  const colOff = Math.max(halfW + 70, Math.min(W * 0.16, 260));
  const sides = { l: [], r: [] };
  aItems.forEach((a, i) => {
    tmpV.copy(a.p); a.obj.localToWorld(tmpV); tmpV.project(camera);
    a.ax = (tmpV.x * 0.5 + 0.5) * W; a.ay = (-tmpV.y * 0.5 + 0.5) * H;
    a.sy = a.ay; sides[a.side].push(a);
  });
  Object.values(sides).forEach((arr) => { // évite les chevauchements
    arr.sort((a, b) => a.sy - b.sy);
    for (let i = 1; i < arr.length; i++) if (arr[i].sy < arr[i - 1].sy + 34) arr[i].sy = arr[i - 1].sy + 34;
  });
  aItems.forEach((a, i) => {
    const ly = a.sy - 14;
    const reveal = clamp((t - 0.9 - i * 0.08) / 0.6);
    const lx = a.side === 'r' ? cx + colOff : cx - colOff - a.w;
    a.el.style.transform = `translate3d(${lx}px,${ly}px,0)`;
    a.el.style.opacity = reveal;
    const ex = a.side === 'r' ? lx - 8 : lx + a.w + 8, ey = a.sy - 2;
    const mx = a.side === 'r' ? ex - 18 : ex + 18;
    const d = `M${ex} ${ey} L${mx} ${ey} C${(mx + a.ax) / 2} ${ey} ${(mx + a.ax) / 2} ${a.ay} ${a.ax} ${a.ay}`;
    a.path.setAttribute('d', d);
    const L = 400; a.path.style.strokeDasharray = L; a.path.style.strokeDashoffset = L * (1 - reveal);
    a.dot.setAttribute('cx', a.ax); a.dot.setAttribute('cy', a.ay); a.dot.style.opacity = reveal;
  });
}

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
const cur = { ty: HALF, tx: 0, tz: 0, yaw: 0, d: 25, e: 0, rot: 0, shiftX: 0, shiftY: 0, gap: 0.3, hero: 1, paper: 0, atmo: 0, over: 0, night: 0, re: 0 };
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
  fitDistances(); measureAnnots();
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

  const heroP = prog('hero'), introP = prog('intro'), anatP = prog('anat'), launchP = prog('launch'), retP = prog('ret');
  const reduce = SS.reduce;
  const mobile = camera.aspect < 0.85;
  const k = 1 - Math.exp(-dt * 5.5);
  const kf = 1 - Math.exp(-dt * 9);

  // révélation initiale (après le loader)
  const rv = SS.revealAt ? clamp((performance.now() - SS.revealAt) / 2600) : 0;
  const rvE = 1 - Math.pow(1 - rv, 4);
  const revealT = SS.revealAt ? (performance.now() - SS.revealAt) / 1000 : 0;

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
  T.atmo = 0; T.alt = 0; T.tx = 0; T.tz = 0; T.yaw = 0; T.over = 0; T.night = 0; T.re = 0;
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

  /* ----- retour : rentrée, chute à plat, bascule, rallumage, capture par la tour ----- */
  const retMode = retP > 0;
  let rEng = 0, rPlasma = 0, rFire = 0, rFireK = 0, rVapor = 0, rBump = 0, rArms = 1;
  const rPos = retTmp;
  if (retMode) {
    const q = retP;
    bFlame = bbFlame = sFlame = hsGlow = 0; smokeOn = 0; shake = 0;
    retShipPos(q, rPos);
    rEng = win(q, 0.3, 0.315, 0.745, 0.765);
    rPlasma = 1 - sstep(0.1, 0.24, q);
    rFire = win(q, 0.302, 0.318, 0.36, 0.43); rFireK = clamp((q - 0.302) / 0.13);
    rBump = win(q, 0.745, 0.762, 0.775, 0.86);
    rVapor = win(q, 0.752, 0.775, 0.86, 0.97);
    rArms = 1 - sstep(0.64, 0.745, q);
    rPos.y -= rBump * 0.09;
    shake = rEng * 0.035 * (1 - sstep(0.32, 0.5, q)) + rBump * 0.07 + rPlasma * 0.02;
    // caméra
    const n = retK.length - 1;
    let i = 0; while (i < n - 1 && q > retK[i + 1].q) i++;
    const A = retK[i], B = retK[i + 1], w = sstep(0, 1, clamp((q - A.q) / (B.q - A.q)));
    const f = lerp(A.f, B.f, w);
    retTmp2.set(lerp(A.p[0], B.p[0], w), lerp(A.p[1], B.p[1], w), lerp(A.p[2], B.p[2], w)).lerp(rPos, f);
    T.ty = retTmp2.y + HALF; T.tx = retTmp2.x; T.tz = retTmp2.z;
    T.d = lerp(A.d, B.d, w) * (mobile ? 1.3 : 1);
    T.yaw = lerp(A.yaw, B.yaw, w); T.e = lerp(A.e, B.e, w);
    T.shiftX = 0; T.shiftY = 0; T.gap = 0; T.rot = 0;
    T.atmo = 1; T.alt = 0; T.re = 1 - sstep(0.15, 0.3, q);
    T.over = sstep(0.14, 0.32, q); T.night = sstep(0.78, 0.97, q);
  }

  // paper (affiche blanche)
  T.paper = (SS.paper || 0) * (1 - sstep(0, 0.35, heroP));

  // amortissement
  for (const key of ['ty', 'tx', 'tz', 'yaw', 'd', 'e', 'rot', 'shiftX', 'shiftY', 'gap', 'hero', 'paper', 'atmo', 'over', 'night', 're']) cur[key] += (T[key] - cur[key]) * (key === 'paper' || key === 'atmo' || key === 'over' || key === 'night' || key === 're' ? k * 0.6 : k);
  cur.alt = retMode ? lerp(cur.alt ?? 0, T.alt, k) : T.alt;

  /* ----- application ----- */
  const bob = reduce ? 0 : Math.sin(time * 0.8) * 0.05 * cur.hero;
  const introDrop = (1 - rvE) * -16;
  stack.position.y = stackY + bob + introDrop;
  stack.rotation.y = cur.rot + (reduce ? 0 : SS.mx * 0.18 * cur.hero);
  shipPivot.position.y = BOOST_TOP + 2.6 + cur.gap + shipUp;
  boosterPivot.position.set(bX, 3.6 - bDown, 0);
  boosterPivot.rotation.z = bRotZ;
  shipPivot.rotation.z = -sstep(0.0, 1.0, clamp((launchP - 0.6) / 0.4)) * 0.12;
  booster.visible = !retMode;
  if (retMode) {
    stack.rotation.set(0, 0, 0);
    stack.position.set(rPos.x, rPos.y - (BOOST_TOP + 2.6), rPos.z);
    shipPivot.position.set(0, BOOST_TOP + 2.6, 0);
    // inox (+z local) tourné vers la tour (+x), volets avant au-dessus des bras (±z)
    shipPivot.rotation.order = 'ZYX';
    shipPivot.rotation.set(0, Math.PI / 2, retPitch(retP));
  } else { shipPivot.rotation.order = 'XYZ'; shipPivot.rotation.x = 0; shipPivot.rotation.y = 0; }

  // pas de tir : la tour sort de terre au début du lancement, reste là pour le retour
  const padIn = retMode ? 1 : sstep(0.0, 0.07, launchP);
  pad.visible = padIn > 0.001;
  if (pad.visible) {
    pad.position.y = GY - (1 - padIn) * 18;
    pad.userData.setArms(retMode ? rArms * 0.72 : 1, ARM_Y - GY - rBump * 0.09);
    pad.userData.setLights(retMode ? cur.night : 0.15, time);
    pad.userData.ground.visible = !retMode || cur.re < 0.6;
  }
  // 3 Raptor du retour, plasma, boule de feu, vapeur
  landPlumes.forEach((pl, i) => { pl.userData.set(rEng * (0.9 + Math.random() * 0.1), time + i * 1.7, 1 + 0.15 * Math.sin(time * 3 + i), 0.75 + 0.25 * sstep(0.3, 0.36, retP)); pl.rotation.set(Math.sin(time * 1.3 + i) * 0.03, 0, Math.sin(time * 1.1 + i * 2) * 0.03 + (retP < 0.42 ? 0.12 * rEng : 0)); });
  const pv = retMode ? rPlasma * (0.88 + 0.12 * Math.sin(time * 31) * Math.sin(time * 17)) : 0;
  hotTiles.userData.set(retMode ? sstep(0, 1, rPlasma * 1.3) * 0.9 : 0, time);
  shock.userData.set(pv, time);
  plasmaHalo.material.opacity = pv * 0.55; plasmaHalo.position.set(rPos.x, rPos.y - 0.7, rPos.z); plasmaHalo.scale.set(7.5, 3.2, 1);
  if (retMode && rPlasma > 0.003) {
    retShipPos(Math.min(1, retP + 0.01), wakeTmp); wakeDir.subVectors(rPos, wakeTmp).normalize();  // opposé à la vitesse
    plasmaTrail.quaternion.setFromUnitVectors(wakeUp, wakeDir);
    plasmaTrail.position.copy(rPos).addScaledVector(wakeDir, 0.6);
  }
  plasmaTrail.userData.set(pv, time);
  fireball.visible = rFire > 0.003;
  if (fireball.visible) fireball.children.forEach((sp) => { const u = sp.userData; const g = rFireK; sp.position.copy(u.o).addScaledVector(u.v, g * 1.4); sp.scale.setScalar(u.s * (0.4 + g * 2.6)); sp.material.opacity = rFire * (sp.material.blending === THREE.AdditiveBlending ? 0.95 : 0.6); });
  vapor.visible = rVapor > 0.003;
  if (vapor.visible) { const g = clamp((retP - 0.752) / 0.2); vapor.children.forEach((sp) => { const u = sp.userData; sp.position.set(u.o.x + u.v.x * g * 2, u.o.y + u.v.y * g * 2, u.o.z + u.v.z * g * 2); sp.scale.setScalar(u.s * (0.9 + g * 3.6)); sp.material.opacity = rVapor * 0.09 * (1 - g * 0.6); sp.material.color.setRGB(lerp(0.7, 0.5, cur.night), lerp(0.72, 0.45, cur.night), lerp(0.78, 0.58, cur.night)); }); }

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
  if (retMode) { fireLight.position.set(rPos.x, rPos.y - 3.4, rPos.z + 0.4); fireLight.intensity = (rEng * 9 + rFire * 18 + rPlasma * 14) * (0.85 + Math.random() * 0.3); fireLight.color.setRGB(1, lerp(0.54, 0.62, rPlasma), lerp(0.23, 0.5, rPlasma)); }
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
  camTgt.set(-cur.shiftX * visW + cur.tx, cur.ty - HALF + cur.shiftY * visH, cur.tz);
  if (launchP > 0) camTgt.y = cur.ty - HALF; // déjà en coordonnées monde
  if (launchP > 0) camTgt.y += cur.shiftY * visH;
  const par = reduce ? 0 : 1;
  {
    const ox = SS.mx * 0.5 * par * (cur.d / 25), oz = Math.cos(cur.e) * cur.d, cy = Math.cos(cur.yaw), sy = Math.sin(cur.yaw);
    camPos.set(camTgt.x + ox * cy + oz * sy, camTgt.y + Math.sin(cur.e) * cur.d - SS.my * 0.35 * par * (cur.d / 25), camTgt.z - ox * sy + oz * cy);
  }
  shakeT += dt * 40;
  if (shake > 0 && !reduce) { camPos.x += (Math.sin(shakeT * 1.3) + Math.sin(shakeT * 2.7)) * shake * 0.5; camPos.y += Math.sin(shakeT * 1.9 + 1) * shake * 0.5; }
  camera.position.copy(camPos);
  camera.lookAt(camTgt);

  // ciel & étoiles suivent la caméra
  sky.position.copy(camera.position); stars.position.copy(camera.position);
  skyU.uAtmo.value = cur.atmo; skyU.uAlt.value = cur.alt; skyU.uPaper.value = cur.paper;
  skyU.uOver.value = cur.over; skyU.uNight.value = cur.night; skyU.uRe.value = cur.re;
  scene.environment = cur.over > 0.5 ? envOver : envStudio;
  // brume : chaude au lancement, gris-bleu par temps couvert, lavande à l'heure bleue
  const fogLaunch = pad.visible && !retMode ? 0.006 * (1 - sstep(0.1, 0.5, cur.alt)) : 0;
  scene.fog.density = fogLaunch + cur.over * 0.011 * (1 - sstep(0.2, 0.7, cur.alt));
  scene.fog.color.setRGB(lerp(lerp(0.42, 0.36, cur.over), 0.5, cur.night), lerp(lerp(0.24, 0.4, cur.over), 0.37, cur.night), lerp(lerp(0.16, 0.5, cur.over), 0.52, cur.night));
  starU.uTime.value = time;
  starU.uOp.value = Math.max((0.55 + 0.45 * sstep(0.3, 1, cur.alt)) * (1 - cur.atmo * (1 - sstep(0.2, 0.8, cur.alt))), cur.re * 0.85) * (1 - cur.paper);
  renderer.toneMappingExposure = 1.0 - cur.paper * 0.05;
  bloom.strength = (0.26 + bFlame * 0.25 + hsGlow * 0.35 + sFlame * 0.1 + rEng * 0.15 + rPlasma * 0.3 + cur.night * 0.25) * (1 - cur.paper);
  bloom.threshold = lerp(1.05 + cur.atmo * 0.5, 1.0, cur.night);
  sun.intensity = lerp(lerp(2.2 + cur.atmo * 0.6, 0.9, cur.over), 0.3, cur.night);
  sun.color.setRGB(lerp(1, 0.86, cur.over), lerp(lerp(0.89, 0.7, cur.atmo), 0.9, cur.over), lerp(lerp(0.77, 0.5, cur.atmo), 1, cur.over));
  hemi.intensity = 0.25 + cur.over * 0.35 - cur.night * 0.2;
  hemi.color.setRGB(lerp(0.6, lerp(0.7, 0.6, cur.night), cur.over), lerp(0.65, lerp(0.75, 0.5, cur.night), cur.over), lerp(1, 0.9, cur.over));
  rim.intensity = 1.4 * (1 - cur.over * 0.5);

  composer.render();
  updateAnnots(cur.hero * (1 - sstep(0.0, 0.12, heroP)) * (SS.revealAt ? 1 : 0) * (1 - cur.paper * 0), revealT);
}

// rendu d'amorçage (compile les shaders avant la fin du loader)
camera.position.set(0, 0, Dfull); camera.lookAt(0, 0, 0);
composer.render();
SS.ready = true;
requestAnimationFrame(frame);
