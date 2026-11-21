/* Starship V3 — rendu du vrai modèle 3D du vaisseau (rocket.js) pour la démonstration de largage.
   Le vaisseau est rendu de profil, à l'horizontale (nez à droite), dans un canevas hors écran
   que missions.js dessine sous ses calques 2D (fente, porte, satellites). */
import * as THREE from 'three';
import { createRocket, SHIP_H } from './rocket.js';

const SS = (window.SS = window.SS || {});
const OX = 0.75, HY = 1.25; // marge gauche (moteurs) et demi-hauteur, en unités du modèle

const canvas = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();

// environnement studio (mêmes panneaux chaud / froid que la scène principale)
(function env() {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `varying vec3 vP; void main(){
      float h = vP.y;
      vec3 c = mix(vec3(.012,.012,.016), vec3(.10,.105,.12), smoothstep(-.3,.9,h));
      c += vec3(.22,.2,.18) * exp(-abs(h+.02)*14.);
      gl_FragColor = vec4(c,1.); }`,
  })));
  const panel = (w, h, col, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
  };
  panel(40, 12, '#ffffff', 2.4, [0, 34, 8]);
  panel(14, 46, '#ff7a24', 3.0, [-30, 2, 10]);
  panel(14, 46, '#3f5cff', 2.8, [30, 4, -4]);
  panel(3, 60, '#ffffff', 3.0, [14, 0, 30]);
  panel(2, 60, '#ffffff', 2.5, [-16, 0, 26]);
  panel(30, 4, '#b48cff', 1.4, [0, -14, -30]);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(s, 0.015).texture;
  pm.dispose();
})();

// lumière du Soleil (en haut à droite, comme le halo du décor) et reflet bleuté de la Terre en dessous
const sun = new THREE.DirectionalLight(0xfff0dc, 2.6); sun.position.set(4, 6, 6); scene.add(sun);
const earth = new THREE.DirectionalLight(0x6fa8ff, 1.1); earth.position.set(0, -6, 3); scene.add(earth);
scene.add(new THREE.HemisphereLight(0x9aa6ff, 0x0b1a33, 0.25));

const { ship } = createRocket(renderer);
const roll = new THREE.Group(); roll.add(ship);
ship.rotation.y = -0.55;                 // on voit l'inox en haut et le bouclier thermique en bas
roll.rotation.z = -Math.PI / 2;          // axe du vaisseau à l'horizontale, nez à droite
roll.rotation.x = 0.18;
scene.add(roll);

const cam = new THREE.OrthographicCamera(-OX, SHIP_H + 0.35, HY, -HY, 0.1, 50);
cam.position.set(0, 0, 20); cam.lookAt(0, 0, 0);

let lastKey = '';
function render(L, dpr, force) {
  const s = L / SHIP_H; // pixels CSS par unité du modèle
  const key = Math.round(L) + ':' + dpr;
  if (key !== lastKey) {
    lastKey = key;
    renderer.setPixelRatio(dpr);
    renderer.setSize(Math.round((SHIP_H + 0.35 + OX) * s), Math.round(2 * HY * s), false);
    renderer.render(scene, cam);
  } else if (force) renderer.render(scene, cam);
  return { canvas, s, ox: OX, hy: HY };
}

SS.deployShip = { render, SHIP_H, CYL: 3.75 / SHIP_H };
