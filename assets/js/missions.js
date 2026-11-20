/* Starship V3 — missions réelles et démonstration du largage des satellites.
   Données : vols d'essai 1 à 15 (avril 2023 – novembre 2026), sources publiques
   (Wikipédia « List of Starship launches », pages des vols 12 et 15, NPR, Space.com). */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const go = (sel) => { if (window.SS && SS.scrollTo) SS.scrollTo(sel); else $(sel).scrollIntoView({ behavior: 'smooth' }); };

  /* ================= Les quinze vols ================= */
  // b / s : issue du booster / du vaisseau. ok = amerrissage contrôlé, catch = rattrapé par la tour, lost = perdu.
  const FLIGHTS = [
    { n: 1, d: '20 avr. 2023', v: 'B7 · S24', blk: 'V1', t: 'Premier décollage', p: "Le lanceur perd le contrôle avant la séparation des étages et le système de sauvegarde le détruit. Le pas de tir est lourdement endommagé.", b: ['lost', 'Perdu'], s: ['lost', 'Perdu'], pay: 'Aucune charge' },
    { n: 2, d: '18 nov. 2023', v: 'B9 · S25', blk: 'V1', t: 'Premier « hot staging »', p: "La séparation à chaud fonctionne. Le booster est perdu pendant son retour, le vaisseau peu avant la fin de sa propulsion.", b: ['lost', 'Perdu'], s: ['lost', 'Perdu'], pay: 'Aucune charge' },
    { n: 3, d: '14 mars 2024', v: 'B10 · S28', blk: 'V1', t: "Premier vol dans l'espace", p: "Le vaisseau atteint l'espace et teste l'ouverture de la porte de sa soute. Il est perdu pendant la rentrée.", b: ['lost', 'Perdu'], s: ['lost', 'Perdu'], pay: 'Test de la porte' },
    { n: 4, d: '6 juin 2024', v: 'B11 · S29', blk: 'V1', t: 'Deux retours en douceur', p: "Pour la première fois, les deux étages reviennent : le booster dans le golfe du Mexique, le vaisseau dans l'océan Indien.", b: ['ok', 'Amerri'], s: ['ok', 'Amerri'], pay: 'Aucune charge' },
    { n: 5, d: '13 oct. 2024', v: 'B12 · S30', blk: 'V1', t: 'Première capture', p: "Les bras « chopsticks » de la tour rattrapent Super Heavy en vol. Le vaisseau amerrit pile sur sa cible.", b: ['catch', 'Rattrapé'], s: ['ok', 'Amerri'], pay: 'Aucune charge', star: 1 },
    { n: 6, d: '19 nov. 2024', v: 'B13 · S31', blk: 'V1', t: 'Rallumage dans le vide', p: "Capture annulée, le booster amerrit. Le vaisseau rallume un Raptor dans l'espace. À bord, une peluche banane sert d'indicateur d'apesanteur.", b: ['ok', 'Amerri'], s: ['ok', 'Amerri'], pay: 'Peluche banane (à bord)' },
    { n: 7, d: '16 janv. 2025', v: 'B14 · S33', blk: 'V2', t: 'Premier vaisseau V2', p: "Le booster est rattrapé une deuxième fois. Le vaisseau est perdu pendant sa propulsion, avant de pouvoir larguer ses simulateurs.", b: ['catch', 'Rattrapé'], s: ['lost', 'Perdu'], pay: '10 simulateurs · non largués', cat: 'catch' },
    { n: 8, d: '6 mars 2025', v: 'B15 · S34', blk: 'V2', t: 'Troisième capture', p: "Nouvelle capture du booster. Le vaisseau perd son contrôle pendant la propulsion et ses quatre simulateurs restent à bord.", b: ['catch', 'Rattrapé'], s: ['lost', 'Perdu'], pay: '4 simulateurs · non largués' },
    { n: 9, d: '27 mai 2025', v: 'B14-2 · S35', blk: 'V2', t: 'Premier booster réutilisé', p: "Le booster du vol 7 revole. Dans l'espace, la porte de la soute ne s'ouvre pas : aucun simulateur n'est largué.", b: ['lost', 'Perdu'], s: ['lost', 'Perdu'], pay: '8 simulateurs · non largués' },
    { n: 10, d: '26 août 2025', v: 'B16 · S37', blk: 'V2', t: 'Premier largage', p: "Huit simulateurs Starlink sortent un par un de la fente. Le vaisseau amerrit à quelques mètres de sa cible.", b: ['ok', 'Amerri'], s: ['ok', 'Amerri'], pay: '8 simulateurs · largués', demo: 'f10', star: 1 },
    { n: 11, d: '13 oct. 2025', v: 'B15-2 · S38', blk: 'V2', t: 'Dernier vol du V2', p: "Huit simulateurs largués, rallumage en orbite, et un vaisseau qui rentre presque intact dans l'océan Indien.", b: ['ok', 'Amerri'], s: ['ok', 'Amerri'], pay: '8 simulateurs · largués', demo: 'f11' },
    { n: 12, d: '22 mai 2026', v: 'B19 · S39', blk: 'V3', t: 'Débuts du Starship V3', p: "Premier vol depuis le pas de tir 2. Deux vrais satellites, largués avec 20 simulateurs, filment le bouclier thermique du vaisseau.", b: ['lost', 'Perdu'], s: ['ok', 'Amerri'], pay: '20 simulateurs + 2 satellites', demo: 'f12' },
    { n: 13, d: '24 juil. 2026', v: 'B20 · S40', blk: 'V3', t: 'Premiers Starlink V3', p: "Vingt vrais Starlink V3 sont largués sur une trajectoire suborbitale, puis rentrent dans l'atmosphère comme prévu.", b: ['lost', 'Perdu'], s: ['ok', 'Amerri'], pay: '20 Starlink V3 · largués', demo: 'f13' },
    { n: 14, d: '28 sept. 2026', v: 'B21 · S41', blk: 'V3', t: 'Première orbite', p: "Starship atteint l'orbite pour la première fois et y place 26 satellites Starlink V3, vers 275 km d'altitude.", b: ['ok', 'Amerri'], s: ['ok', 'Amerri'], pay: '26 Starlink V3 · en orbite', demo: 'f14', star: 1 },
    { n: 15, d: '13 nov. 2026', v: 'B22 · S42', blk: 'V3', t: 'Le vaisseau rattrapé', p: "26 Starlink V3 en orbite, 14 tours de la Terre en 22 heures, puis le vaisseau est rattrapé par la tour : une première.", b: ['lost', 'Perdu'], s: ['catch', 'Rattrapé'], pay: '26 Starlink V3 · en orbite', demo: 'f15', star: 1 },
  ];

  const grid = $('#volsGrid');
  if (grid) {
    grid.innerHTML = FLIGHTS.map((f) => `
      <li class="vol${f.star ? ' star' : ''}" data-pay="${f.demo ? 1 : 0}" data-catch="${f.b[0] === 'catch' || f.s[0] === 'catch' ? 1 : 0}">
        <div class="vol-top"><span class="vol-n">${String(f.n).padStart(2, '0')}</span><span class="vol-date">${f.d}<small>${f.v} · ${f.blk}</small></span></div>
        <h3>${f.t}</h3>
        <p>${f.p}</p>
        <div class="vol-out"><span class="${f.b[0]}">Booster<b>${f.b[1]}</b></span><span class="${f.s[0]}">Vaisseau<b>${f.s[1]}</b></span></div>
        <div class="vol-pay"><span>${f.pay}</span>${f.demo ? `<button type="button" class="vol-go" data-demo="${f.demo}">Voir le largage ↓</button>` : ''}</div>
      </li>`).join('');

    // filtres
    const tabs = $$('#volsTabs button'), ink = $('#volsInk');
    const placeInk = () => {
      const t = tabs.find((x) => x.getAttribute('aria-selected') === 'true');
      ink.style.width = t.offsetWidth + 'px';
      ink.style.transform = `translateX(${t.offsetLeft - 4}px)`;
    };
    tabs.forEach((t) => t.addEventListener('click', () => {
      tabs.forEach((x) => x.setAttribute('aria-selected', x === t ? 'true' : 'false'));
      placeInk();
      const f = t.dataset.f;
      $$('.vol', grid).forEach((li) => li.classList.toggle('hide', f === 'payload' ? li.dataset.pay !== '1' : f === 'catch' ? li.dataset.catch !== '1' : false));
      if (hasGsap) {
        gsap.fromTo($$('.vol:not(.hide)', grid), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, stagger: 0.04, ease: 'expo.out' });
        ScrollTrigger.refresh();
      }
    }));
    placeInk();
    addEventListener('resize', placeInk);
    document.fonts && document.fonts.ready.then(placeInk);

    if (hasGsap) {
      gsap.from('.vols-title', { yPercent: 30, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '#vols', start: 'top 75%' } });
      $$('.vol', grid).forEach((li, i) => gsap.from(li, { y: 50, opacity: 0, duration: 1, ease: 'expo.out', delay: (i % 3) * 0.08, scrollTrigger: { trigger: li, start: 'top 92%' } }));
      $$('#volsStats dd').forEach((dd) => {
        const o = { v: 0 }, to = +dd.dataset.count;
        gsap.to(o, { v: to, duration: reduce ? 0 : 2.2, ease: 'expo.out', onUpdate: () => (dd.textContent = Math.round(o.v)), scrollTrigger: { trigger: '#volsStats', start: 'top 85%' } });
      });
    } else $$('#volsStats dd').forEach((dd) => (dd.textContent = dd.dataset.count));
  }

  /* ================= Démonstration du largage ================= */
  // clock : [début, fin] du largage en secondes après le décollage, quand la chronologie officielle est publiée.
  const DEMOS = {
    f10: { label: 'Vol 10', date: '26 août 2025', n: 8, real: 0, orbit: 'Suborbitale', orbitNote: 'Simulateurs rentrés dans l’atmosphère', end: 'Huit simulateurs largués : le tout premier largage réussi de Starship.' },
    f11: { label: 'Vol 11', date: '13 oct. 2025', n: 8, real: 0, orbit: 'Suborbitale', orbitNote: 'Dernier vol du Starship V2', end: 'Huit simulateurs largués, puis un Raptor rallumé dans le vide avant la rentrée.' },
    f12: { label: 'Vol 12', date: '22 mai 2026', n: 22, real: 2, cams: [20, 21], orbit: 'Suborbitale', orbitNote: '20 simulateurs + 2 satellites fonctionnels', clock: [17 * 60 + 37, 27 * 60 + 15], end: 'Vingt simulateurs et deux vrais satellites, qui ont filmé le bouclier thermique du vaisseau.' },
    f13: { label: 'Vol 13', date: '24 juil. 2026', n: 20, real: 1, orbit: 'Suborbitale', orbitNote: 'Rentrés dans l’atmosphère comme prévu', end: 'Vingt Starlink V3 largués. Leur trajectoire les ramenait dans l’atmosphère, comme prévu.' },
    f14: { label: 'Vol 14', date: '28 sept. 2026', n: 26, real: 1, orbit: '≈ 275 km', orbitNote: 'Première mise en orbite', end: 'Vingt-six Starlink V3 en orbite vers 275 km : la première charge utile placée en orbite par Starship.' },
    f15: { label: 'Vol 15', date: '13 nov. 2026', n: 26, real: 1, cams: [0, 12, 25], orbit: '276 × 278 km', orbitNote: 'Inclinaison 30,5°', clock: [35 * 60 + 1, 77 * 60 + 40], end: 'Vingt-six Starlink V3 en orbite. Après 14 tours de la Terre, le vaisseau sera rattrapé par la tour.' },
  };
  const ORDER = ['f10', 'f11', 'f12', 'f13', 'f14', 'f15'];
  let cur = 'f15';

  const cv = $('#deployCv');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const sec = $('#largage');
  const elPhase = $('#dpPhase'), elCount = $('#dpCount'), elTotal = $('#dpTotal'), elClock = $('#dpClock'), elClockNote = $('#dpClockNote'), elOrbit = $('#dpOrbit'), elOrbitNote = $('#dpOrbitNote'), elBar = $('#dpBar'), elPlay = $('#dpPlay');
  const mBox = $('#dpMissions');
  mBox.innerHTML = ORDER.map((k) => `<button type="button" role="tab" data-k="${k}" aria-selected="${k === cur}"><b>${DEMOS[k].label}</b><span>${DEMOS[k].n} ${DEMOS[k].real ? (k === 'f12' ? 'objets' : 'Starlink V3') : 'simulateurs'}</span></button>`).join('');
  const setMission = (k) => {
    cur = k;
    $$('button', mBox).forEach((b) => b.setAttribute('aria-selected', b.dataset.k === k ? 'true' : 'false'));
    buildSats();
    lastPhase = '';
  };
  $$('button', mBox).forEach((b) => b.addEventListener('click', () => setMission(b.dataset.k)));

  /* --- état --- */
  let W = 0, H = 0, dpr = 1, visible = false, scrollP = 0, auto = null, lastPhase = '';
  let stars = [], clouds = null, cloudPat = null, sats = [];
  const rnd = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

  function buildSats() {
    const d = DEMOS[cur];
    sats = Array.from({ length: d.n }, (_, i) => ({
      real: d.real && (cur !== 'f12' || i >= 20),
      cam: d.cams ? d.cams.includes(i) : false,
      spin: (rnd() - 0.5) * 0.9,
      dir: (rnd() - 0.5) * 0.5,
      sp: 0.85 + rnd() * 0.3,
      ph: rnd() * 6.28,
    }));
  }
  buildSats();

  function resize() {
    const r = cv.getBoundingClientRect();
    W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    stars = Array.from({ length: Math.round(W * H / 2600) }, () => ({ x: rnd() * W, y: rnd() * H, r: rnd() * 1.1 + 0.2, a: rnd() * 0.7 + 0.2, f: rnd() * 3 + 0.5 }));
    buildClouds();
  }

  // texture de nuages procédurale (bruit de valeur fractal), répétable horizontalement
  function buildClouds() {
    const cw = 1024, ch = 256;
    clouds = document.createElement('canvas'); clouds.width = cw; clouds.height = ch;
    const c = clouds.getContext('2d'), img = c.createImageData(cw, ch), dd = img.data;
    const G = 32, g = Array.from({ length: G * G }, rnd);
    const vn = (x, y, per) => {
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const at = (a, b) => g[((b % G) + G) % G * G + ((a % per) + per) % per];
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy;
    };
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      let n = 0, a = 0.55, f = 1;
      for (let o = 0; o < 5; o++) { n += vn(x / cw * 8 * f, y / ch * 2 * f * 2.2, 8 * f) * a; a *= 0.5; f *= 2; }
      const v = smooth(0.48, 0.78, n);
      const i = (y * cw + x) * 4;
      dd[i] = 245; dd[i + 1] = 248; dd[i + 2] = 255; dd[i + 3] = v * 235;
    }
    c.putImageData(img, 0, 0);
    cloudPat = null;
  }

  /* --- géométrie du vaisseau --- */
  function layout() {
    const mob = W < 760;
    const L = mob ? W * 1.25 : Math.min(W * 0.74, 1180);
    const D = L * 0.173;
    const cy = mob ? H * 0.43 : H * 0.5;
    const slotU = [0.56, 0.69];
    const x0 = mob ? W * 0.5 - L * 0.62 : W * 0.5 - L * 0.46;
    const X = (u) => x0 + u * L;
    return { L, D, cy, x0, X, top: cy - D / 2, bot: cy + D / 2, slot: { x: X(slotU[0]), w: X(slotU[1]) - X(slotU[0]), y: cy - D * 0.2, h: D * 0.3 }, mob };
  }

  function hullPath(g) {
    const { X, top, bot, cy, D } = g;
    const p = new Path2D();
    p.moveTo(X(0.02), top);
    p.lineTo(X(0.79), top);
    p.bezierCurveTo(X(0.9), top, X(0.985), cy - D * 0.2, X(1), cy);
    p.bezierCurveTo(X(0.985), cy + D * 0.2, X(0.9), bot, X(0.79), bot);
    p.lineTo(X(0.02), bot);
    p.closePath();
    return p;
  }

  function drawEarth(t) {
    const R = W * 1.35 + H * 0.8, cx = W * 0.5, cy = H * 0.84 + R;
    // halo atmosphérique
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.arc(cx, cy, R + 2 + i * 7, Math.PI * 1.05, Math.PI * 1.95);
      ctx.strokeStyle = `rgba(120,180,255,${0.11 - i * 0.017})`; ctx.lineWidth = 10; ctx.stroke();
    }
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    const top = cy - R;
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, '#5aa6ff'); g.addColorStop(0.02, '#2a6fc0'); g.addColorStop(0.12, '#0f3f78'); g.addColorStop(1, '#06223f');
    ctx.fillStyle = g; ctx.fillRect(0, top, W, H - top);
    // nuages qui défilent (rotation de la Terre)
    if (clouds) {
      if (!cloudPat) cloudPat = ctx.createPattern(clouds, 'repeat');
      const sh = (H - top) * 1.4, k = sh / clouds.height;
      cloudPat.setTransform(new DOMMatrix().translate(-((t * 9) % (clouds.width * k)), top - 2).scale(k, k));
      ctx.globalAlpha = 0.85; ctx.fillStyle = cloudPat; ctx.fillRect(0, top, W, H - top); ctx.globalAlpha = 1;
    }
    // terminateur (côté nuit à gauche) et brume du limbe
    const n = ctx.createLinearGradient(0, 0, W, 0);
    n.addColorStop(0, 'rgba(2,4,10,.82)'); n.addColorStop(0.35, 'rgba(2,4,10,.25)'); n.addColorStop(1, 'rgba(2,4,10,0)');
    ctx.fillStyle = n; ctx.fillRect(0, top, W, H - top);
    const h = ctx.createLinearGradient(0, top, 0, top + 40);
    h.addColorStop(0, 'rgba(190,225,255,.55)'); h.addColorStop(1, 'rgba(190,225,255,0)');
    ctx.fillStyle = h; ctx.fillRect(0, top, W, 40);
    ctx.restore();
  }

  function drawShip(g, door, remaining, t) {
    const { X, top, bot, cy, D, L, slot } = g;
    const hull = hullPath(g);
    // moteurs (3 Raptor vide + 3 au niveau de la mer, vus de profil)
    ctx.fillStyle = '#1a1b1f';
    const bell = (yc, len, r) => {
      ctx.beginPath(); ctx.moveTo(X(0.02), yc - r * 0.35); ctx.lineTo(X(0.02) - len, yc - r); ctx.lineTo(X(0.02) - len, yc + r); ctx.lineTo(X(0.02), yc + r * 0.35); ctx.closePath();
      const bg = ctx.createLinearGradient(0, yc - r, 0, yc + r); bg.addColorStop(0, '#5c5550'); bg.addColorStop(0.5, '#2a2624'); bg.addColorStop(1, '#121212');
      ctx.fillStyle = bg; ctx.fill();
    };
    bell(cy - D * 0.22, L * 0.045, D * 0.17); bell(cy + D * 0.2, L * 0.045, D * 0.17); bell(cy, L * 0.03, D * 0.1);

    // corps : acier en haut, tuiles du bouclier thermique en bas
    ctx.save(); ctx.clip(hull);
    const sg = ctx.createLinearGradient(0, top, 0, bot);
    sg.addColorStop(0, '#f2f4f6'); sg.addColorStop(0.18, '#c4c9cf'); sg.addColorStop(0.42, '#8e949b'); sg.addColorStop(0.5, '#6f747b');
    sg.addColorStop(0.5, '#1b1c1f'); sg.addColorStop(0.75, '#111214'); sg.addColorStop(1, '#060607');
    ctx.fillStyle = sg; ctx.fillRect(X(0) - 2, top, L + 4, D);
    // reflet du soleil qui glisse
    const gx = X(0.2 + 0.6 * ((Math.sin(t * 0.15) + 1) / 2));
    const rg = ctx.createRadialGradient(gx, top + D * 0.12, 0, gx, top + D * 0.12, L * 0.3);
    rg.addColorStop(0, 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(X(0), top, L, D * 0.5);
    // tuiles hexagonales (rangées décalées)
    ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
    const ts = Math.max(5, D * 0.06);
    for (let y = cy + 2, r = 0; y < bot; y += ts * 0.86, r++) {
      ctx.beginPath();
      for (let x = X(0) + (r % 2) * ts / 2; x < X(1); x += ts) { ctx.moveTo(x, y); ctx.lineTo(x, y + ts * 0.8); }
      ctx.moveTo(X(0), y); ctx.lineTo(X(1), y); ctx.stroke();
    }
    // anneaux soudés
    ctx.strokeStyle = 'rgba(40,44,50,.35)';
    for (let u = 0.08; u < 0.8; u += 0.055) { ctx.beginPath(); ctx.moveTo(X(u), top); ctx.lineTo(X(u), cy); ctx.stroke(); }
    // ombrage cylindrique
    const sh = ctx.createLinearGradient(0, top, 0, bot);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.9, 'rgba(0,0,0,.25)'); sh.addColorStop(1, 'rgba(0,0,0,.6)');
    ctx.fillStyle = sh; ctx.fillRect(X(0), top, L, D);

    // fente du distributeur : intérieur sombre éclairé
    const ig = ctx.createLinearGradient(0, slot.y, 0, slot.y + slot.h);
    ig.addColorStop(0, '#020203'); ig.addColorStop(0.5, '#0d0f13'); ig.addColorStop(1, '#030304');
    ctx.fillStyle = ig; ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
    if (door > 0.05) {
      const lg = ctx.createRadialGradient(slot.x + slot.w / 2, slot.y + slot.h * 0.2, 0, slot.x + slot.w / 2, slot.y + slot.h * 0.2, slot.w * 0.6);
      lg.addColorStop(0, `rgba(255,220,170,${0.25 * door})`); lg.addColorStop(1, 'rgba(255,220,170,0)');
      ctx.fillStyle = lg; ctx.fillRect(slot.x, slot.y, slot.w, slot.h);
      // le prochain satellite sur son rail
      if (remaining > 0) {
        ctx.fillStyle = 'rgba(120,124,132,.55)';
        ctx.fillRect(slot.x + slot.w * 0.06, slot.y + slot.h * 0.55, slot.w * 0.88, slot.h * 0.18);
        ctx.fillStyle = 'rgba(201,164,106,.5)';
        ctx.fillRect(slot.x + slot.w * 0.06, slot.y + slot.h * 0.86, slot.w * 0.88, 2);
      }
    }
    // porte coulissante (glisse vers le nez)
    const dx = slot.x + door * slot.w * 1.04;
    const dg = ctx.createLinearGradient(0, slot.y, 0, slot.y + slot.h);
    dg.addColorStop(0, '#a9aeb5'); dg.addColorStop(1, '#787d84');
    ctx.fillStyle = dg; ctx.fillRect(dx, slot.y - 2, slot.w, slot.h + 4);
    ctx.strokeStyle = 'rgba(30,32,36,.7)'; ctx.strokeRect(dx + 0.5, slot.y - 1.5, slot.w - 1, slot.h + 3);
    ctx.strokeStyle = 'rgba(20,22,26,.8)'; ctx.strokeRect(slot.x - 0.5, slot.y - 2.5, slot.w + 1, slot.h + 5);
    ctx.restore();

    // ailerons (flaps) avant et arrière
    const flap = (u0, u1, up, dark) => {
      const y = up ? top : bot, k = up ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(X(u0), y); ctx.lineTo(X(u0 + (u1 - u0) * 0.25), y + k * D * 0.28); ctx.lineTo(X(u1), y + k * D * 0.2); ctx.lineTo(X(u1), y); ctx.closePath();
      ctx.fillStyle = dark ? '#0c0d0f' : '#9da2a9'; ctx.fill();
    };
    flap(0.06, 0.2, true, false); flap(0.06, 0.2, false, true);
    flap(0.8, 0.88, true, false); flap(0.8, 0.88, false, true);

    // vue « rayons X » de la soute : la pile de satellites restants
    const bx0 = X(0.44), bx1 = X(0.78);
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.setLineDash([3, 4]); ctx.strokeStyle = '#c9a46a'; ctx.lineWidth = 1;
    ctx.strokeRect(bx0, top + D * 0.08, bx1 - bx0, D * 0.36);
    ctx.setLineDash([]);
    const n = sats.length, lw = (bx1 - bx0 - 12) / Math.max(n, 1);
    for (let i = 0; i < remaining; i++) {
      const x = bx0 + 6 + (i + 0.5) * lw;
      ctx.fillStyle = 'rgba(201,164,106,.75)';
      ctx.fillRect(x - Math.max(1, lw * 0.3), top + D * 0.12, Math.max(1.5, lw * 0.6), D * 0.28);
    }
    ctx.restore();
    return hull;
  }

  function drawSat(s, x, y, sc, rot, unfold, t) {
    const L = lay.L, bw = L * 0.115 * sc, bh = L * 0.02 * sc;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    if (s.real) {
      // panneaux solaires qui se déplient de chaque côté
      if (unfold > 0) {
        const aw = bw * 0.95 * unfold, ah = bh * 1.6;
        for (const side of [-1, 1]) {
          const ax = side < 0 ? -bw / 2 - aw : bw / 2;
          const ag = ctx.createLinearGradient(0, -ah / 2, 0, ah / 2);
          ag.addColorStop(0, '#2a3f6e'); ag.addColorStop(0.5, '#132449'); ag.addColorStop(1, '#0a1530');
          ctx.fillStyle = ag; ctx.fillRect(ax, -ah / 2, aw, ah);
          ctx.strokeStyle = 'rgba(160,190,255,.25)'; ctx.lineWidth = 0.6;
          for (let k = 1; k < 6; k++) { const xx = ax + (aw * k) / 6; ctx.beginPath(); ctx.moveTo(xx, -ah / 2); ctx.lineTo(xx, ah / 2); ctx.stroke(); }
          ctx.strokeRect(ax, -ah / 2, aw, ah);
        }
      }
      const g = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
      g.addColorStop(0, '#d9dce1'); g.addColorStop(1, '#6b7078');
      ctx.fillStyle = g; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      ctx.fillStyle = '#c9a46a'; ctx.fillRect(-bw * 0.12, -bh / 2, bw * 0.24, bh); // antennes / feuille dorée
      if (s.cam) { ctx.fillStyle = `rgba(255,90,60,${0.6 + 0.4 * Math.sin(t * 6 + s.ph)})`; ctx.beginPath(); ctx.arc(bw * 0.38, 0, Math.max(1.2, bh * 0.28), 0, 7); ctx.fill(); }
    } else {
      // simulateur de masse : une plaque d'acier sans panneaux
      const g = ctx.createLinearGradient(0, -bh / 2, 0, bh / 2);
      g.addColorStop(0, '#b7b1a6'); g.addColorStop(1, '#4e4a45');
      ctx.fillStyle = g; ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.8;
      for (let k = 1; k < 4; k++) { const xx = -bw / 2 + (bw * k) / 4; ctx.beginPath(); ctx.moveTo(xx, -bh / 2); ctx.lineTo(xx, bh / 2); ctx.stroke(); }
    }
    ctx.restore();
  }

  function label(x1, y1, x2, y2, title, sub, a) {
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.strokeStyle = '#c9a46a'; ctx.fillStyle = '#c9a46a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x1, y1, 2.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x2 + (x2 > x1 ? 28 : -28), y2); ctx.stroke();
    ctx.textAlign = x2 > x1 ? 'left' : 'right';
    const tx = x2 + (x2 > x1 ? 34 : -34);
    ctx.font = '600 10px "JetBrains Mono", monospace'; ctx.fillStyle = '#c9a46a';
    ctx.fillText(sub.toUpperCase(), tx, y2 - 7);
    ctx.font = '500 13px Inter, system-ui, sans-serif'; ctx.fillStyle = '#eef0f2';
    ctx.fillText(title, tx, y2 + 9);
    ctx.restore();
  }

  const fmtClock = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `T+${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; };

  // phases de la progression (0 → 1)
  const P_DOOR = [0.08, 0.17], P_REL = [0.2, 0.86];
  const EMERGE = 0.035; // durée de sortie d'un satellite, en unités de progression
  let lay = null;

  function frame(now) {
    const t = now / 1000;
    if (auto) { auto.p = clamp((now - auto.t0) / auto.dur); if (auto.p >= 1) { auto = null; elPlay.querySelector('span').textContent = 'Rejouer le largage'; } }
    const p = auto ? auto.p : scrollP;
    if (!visible) return;
    lay = lay || layout();
    const g = lay, d = DEMOS[cur], N = sats.length;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#020305'; ctx.fillRect(0, 0, W, H);
    for (const s of stars) { ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(t * s.f + s.x)); ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.r, s.r); }
    ctx.globalAlpha = 1;
    drawEarth(reduce ? 0 : t);
    // lueur du soleil
    const sun = ctx.createRadialGradient(W * 0.95, H * 0.06, 0, W * 0.95, H * 0.06, W * 0.5);
    sun.addColorStop(0, 'rgba(255,240,215,.22)'); sun.addColorStop(1, 'rgba(255,240,215,0)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);

    // caméra : léger rapprochement + flottement
    const zoom = 0.86 + 0.14 * smooth(0, 0.16, p);
    const bob = reduce ? 0 : Math.sin(t * 0.5) * 4;
    const fx = g.slot.x + g.slot.w / 2, fy = g.cy;
    ctx.translate(fx, fy + bob); ctx.scale(zoom, zoom); ctx.rotate(reduce ? 0 : Math.sin(t * 0.21) * 0.006); ctx.translate(-fx, -fy);

    const door = smooth(P_DOOR[0], P_DOOR[1], p);
    const rel = (i) => P_REL[0] + (P_REL[1] - P_REL[0]) * (N > 1 ? i / (N - 1) : 0);
    let out = 0, started = 0;
    for (let i = 0; i < N; i++) { const a = p - rel(i); if (a > 0) started++; if (a > EMERGE * 0.6) out++; }
    const inside = N - started;

    // satellites déjà loin (derrière le vaisseau visuellement : plus petits)
    const drawn = [];
    for (let i = 0; i < N; i++) {
      const a = p - rel(i);
      if (a <= 0) continue;
      const s = sats[i], e = a / EMERGE;
      let x, y, sc, rot, unf;
      const sx = g.slot.x + g.slot.w / 2, sy = g.slot.y + g.slot.h * 0.65;
      if (e < 1) {
        const k = 1 - Math.pow(1 - e, 3);
        x = sx; y = sy + k * g.D * 0.6; sc = 0.92 + 0.12 * k; rot = 0; unf = 0;
      } else {
        const dd = (e - 1) * s.sp + (reduce ? 0 : 0);
        const drift = reduce ? 0 : Math.sin(t * 0.4 + s.ph) * 3;
        x = sx - dd * g.L * 0.085 + drift;
        y = sy + g.D * 0.6 + dd * g.D * (0.16 + s.dir * 0.14) + dd * dd * g.D * 0.004;
        sc = 1.04 / (1 + dd * 0.16);
        rot = (s.spin * dd * 0.16) + (reduce ? 0 : Math.sin(t * 0.3 + s.ph) * 0.03);
        unf = s.real ? smooth(0.6, 3.5, e - 1) : 0;
      }
      if (x < -g.L * 0.3 || y > H + 60) continue;
      drawn.push({ s, x, y, sc, rot, unf, e });
    }
    // les plus éloignés d'abord
    drawn.sort((a, b) => a.sc - b.sc);

    const hull = drawShip(g, door, inside, t);
    // sortie : le satellite n'apparaît qu'à l'extérieur de la coque ou dans la fente
    ctx.save();
    const clip = new Path2D();
    clip.rect(-W, -H, W * 3, H * 3);
    clip.addPath(hullPath(g));
    clip.rect(g.slot.x, g.slot.y, g.slot.w, g.slot.h);
    ctx.clip(clip, 'evenodd');
    for (const o of drawn) drawSat(o.s, o.x, o.y, o.sc, o.rot, o.unf, t);
    ctx.restore();

    // annotations
    const la = smooth(0.02, 0.1, p) * (1 - smooth(0.32, 0.4, p));
    const mob = g.mob;
    label(g.slot.x + g.slot.w * 0.5, g.slot.y, mob ? g.slot.x + g.slot.w * 0.1 : g.slot.x + g.slot.w * 0.2, g.top - g.D * 0.75, 'Fente de largage', 'Distributeur « PEZ »', la);
    if (!mob) label(g.X(0.48), g.top + g.D * 0.2, g.X(mob ? 0.42 : 0.3), g.top - g.D * 0.55, `${N} satellites empilés`, 'Soute', la);
    if (!mob) label(g.X(0.1), g.bot - g.D * 0.1, g.X(0.2), g.bot + g.D * 0.8, 'Bouclier thermique', 'Tuiles hexagonales', la * 0.9);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // HUD
    const done = Math.min(N, out);
    elCount.textContent = done;
    elTotal.textContent = '/ ' + N;
    if (d.clock) {
      const f = clamp((p - P_REL[0]) / (P_REL[1] - P_REL[0]));
      elClock.textContent = fmtClock(d.clock[0] + (d.clock[1] - d.clock[0]) * f);
      elClockNote.textContent = 'Chronologie officielle du ' + d.label.toLowerCase();
    } else { elClock.textContent = '—'; elClockNote.textContent = 'Horaire du largage non publié'; }
    elOrbit.textContent = d.orbit; elOrbitNote.textContent = d.orbitNote + ' · ' + d.date;
    elBar.style.transform = `scaleX(${p})`;
    let ph;
    if (p < P_DOOR[0]) ph = `${d.label}, ${d.date}. Le vaisseau file à près de 28 000 km/h. Dans la soute, les satellites sont empilés à plat.`;
    else if (p < P_REL[0]) ph = 'La porte coulisse le long de la coque : la fente du distributeur « PEZ » est ouverte.';
    else if (done < N) ph = sats.some((s) => s.real) ? 'Un par un, chaque satellite glisse sur son rail jusqu’à la fente, s’éloigne, puis déploie ses panneaux solaires.' : 'Un par un, chaque simulateur glisse sur son rail jusqu’à la fente puis s’éloigne. Ce sont des plaques d’acier, sans électronique.';
    else ph = d.end;
    if (ph !== lastPhase) { elPhase.textContent = ph; lastPhase = ph; }
  }

  resize();
  addEventListener('resize', () => { resize(); lay = null; });
  new IntersectionObserver((e) => (visible = e[0].isIntersecting), { rootMargin: '100px' }).observe(sec);

  if (hasGsap) {
    ScrollTrigger.create({ trigger: sec, start: 'top top', end: 'bottom bottom', onUpdate: (s) => { scrollP = s.progress; if (auto && Math.abs(s.progress - auto.sp) > 0.03) { auto = null; elPlay.querySelector('span').textContent = 'Lancer le largage'; } } });
    gsap.ticker.add(() => frame(performance.now()));
  } else {
    scrollP = 1;
    const loop = (n) => { frame(n); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  // lecture automatique : le largage se joue sans défiler
  const play = () => { auto = { t0: performance.now(), dur: reduce ? 1 : 16000, p: 0, sp: scrollP }; elPlay.querySelector('span').textContent = 'Largage en cours…'; };
  elPlay.addEventListener('click', play);
  $$('.vol-go').forEach((b) => b.addEventListener('click', () => {
    setMission(b.dataset.demo);
    go('#largage');
    setTimeout(() => { if (hasGsap) auto = null; play(); if (auto) auto.sp = scrollP; }, 1700);
  }));
})();
