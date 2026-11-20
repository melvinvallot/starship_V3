/* Starship V3 — interface, défilement et animations DOM.
   La scène 3D (scene.js) lit l'état partagé window.SS. */
(() => {
  'use strict';
  const SS = (window.SS = window.SS || {});
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const fmt = (n, d = 0) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  SS.reduce = reduce;
  SS.mx = 0; SS.my = 0; SS.paper = 0; SS.vel = 0;
  document.body.classList.add('loading');

  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  if (!hasGsap) { document.body.classList.remove('loading'); const l = $('#loader'); if (l) l.remove(); return; }
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Défilement fluide (Lenis) ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on('scroll', (e) => { SS.vel = e.velocity || 0; ScrollTrigger.update(); });
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const scrollTo = (target, opts = {}) => {
    if (lenis) lenis.scrollTo(target, { immediate: true, force: true, ...opts }); // saut instantané
    else {
      const y = typeof target === 'number' ? target : (typeof target === 'string' ? $(target) : target).getBoundingClientRect().top + scrollY;
      scrollTo0(y);
    }
  };
  const scrollTo0 = (y) => window.scrollTo({ top: y, behavior: 'auto' });
  $$('[data-scroll]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (!id || id[0] !== '#') return;
    e.preventDefault();
    scrollTo(id === '#hero' ? 0 : id);
  }));

  /* ---------- Déclencheurs partagés avec la 3D ---------- */
  SS.st = {
    hero: ScrollTrigger.create({ trigger: '#hero', start: 'top top', end: 'bottom top' }),
    intro: ScrollTrigger.create({ trigger: '#intro', start: 'top bottom', end: 'bottom bottom' }),
    anat: ScrollTrigger.create({ trigger: '#anatomie', start: 'top top', end: 'bottom bottom' }),
    launch: ScrollTrigger.create({ trigger: '#lancement', start: 'top top', end: 'bottom bottom' }),
    post: ScrollTrigger.create({ trigger: '.marquee', start: 'top bottom', end: 'bottom top' }),
  };

  /* ---------- Chargement & compte à rebours ---------- */
  const ldNum = $('#ldNum'), ldBar = $('#ldBar'), ldPct = $('#ldPct'), ldMsg = $('#ldMsg');
  const msgs = ['Chargement des ergols…', 'Pressurisation des réservoirs…', 'Refroidissement des Raptor…', 'Vérifications finales…', 'Go pour le lancement'];
  const t0 = performance.now();
  const minDur = reduce ? 400 : 2600;
  let loaderDone = false;
  function loaderTick() {
    if (loaderDone) return;
    const k = clamp((performance.now() - t0) / minDur);
    const ready = SS.ready || performance.now() - t0 > 9000;
    const p = ready ? k : Math.min(k, 0.9);
    ldNum.textContent = String(Math.max(0, Math.ceil(10 - p * 10))).padStart(2, '0');
    ldBar.style.transform = `scaleX(${p})`;
    ldPct.textContent = Math.round(p * 100) + ' %';
    ldMsg.textContent = msgs[Math.min(msgs.length - 1, Math.floor(p * msgs.length))];
    if (p >= 1) { loaderDone = true; endLoader(); return; }
    requestAnimationFrame(loaderTick);
  }
  requestAnimationFrame(loaderTick);
  $('#loader').addEventListener('click', () => { SS.ready = true; });

  function endLoader() {
    SS.revealAt = performance.now();
    const tl = gsap.timeline({ defaults: { ease: 'expo.inOut' } });
    tl.to('#loader', { clipPath: 'inset(0 0 100% 0)', duration: reduce ? 0.2 : 1.1 })
      .set('#loader', { display: 'none' })
      .add(() => { document.body.classList.remove('loading'); if (lenis) lenis.start(); ScrollTrigger.refresh(); }, 0.5)
      .from('.nav', { yPercent: -120, duration: 1, ease: 'expo.out' }, 0.8)
      .from('.hero-top .tag, .paper-toggle', { y: -20, opacity: 0, stagger: 0.08, duration: 0.9, ease: 'expo.out' }, 1.0)
      .from('.specs > div', { x: -30, opacity: 0, stagger: 0.1, duration: 0.9, ease: 'expo.out' }, 1.4)
      .from('.blueprint', { y: 30, opacity: 0, duration: 1, ease: 'expo.out' }, 1.5)
      .from('.scroll-hint', { opacity: 0, duration: 1 }, 2);
    // compteurs des specs
    $$('.specs b[data-count]').forEach((b, i) => {
      const end = parseFloat(b.dataset.count), d = +(b.dataset.dec || 0), o = { v: 0 };
      tl.to(o, { v: end, duration: 2.2, ease: 'expo.out', onUpdate: () => (b.textContent = fmt(o.v, d)) }, 1.4 + i * 0.1);
    });
    // tracé du plan
    $$('.bp-draw > *').forEach((el) => {
      const L = el.getTotalLength ? el.getTotalLength() : 200;
      el.style.strokeDasharray = L; el.style.strokeDashoffset = L;
    });
    tl.to('.bp-draw > *', { strokeDashoffset: 0, duration: 2.2, stagger: 0.04, ease: 'power2.inOut' }, 1.5);
  }

  /* ---------- Horloge de mission ---------- */
  const clockEl = $('#clock');
  setInterval(() => {
    const s = Math.floor((performance.now() - t0) / 1000);
    clockEl.textContent = [s / 3600, (s / 60) % 60, s % 60].map((v) => String(Math.floor(v)).padStart(2, '0')).join(':');
  }, 250);

  /* ---------- Affiche noire / blanche ---------- */
  const paperBtn = $('#paperToggle');
  const setPaper = (on) => {
    document.body.classList.toggle('paper', on);
    paperBtn.setAttribute('aria-pressed', on);
    SS.paper = on ? 1 : 0;
    try { localStorage.setItem('ss-paper', on ? '1' : '0'); } catch (e) {}
  };
  try { if (localStorage.getItem('ss-paper') === '1') setPaper(true); } catch (e) {}
  paperBtn.addEventListener('click', () => setPaper(!document.body.classList.contains('paper')));

  /* ---------- Souris, curseur, aimants ---------- */
  const cursor = $('#cursor'), cTxt = $('#cursorTxt');
  let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
  addEventListener('pointermove', (e) => {
    tx = e.clientX; ty = e.clientY;
    SS.mx = (e.clientX / innerWidth) * 2 - 1;
    SS.my = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });
  if (fine) {
    gsap.ticker.add(() => {
      cx += (tx - cx) * 0.22; cy += (ty - cy) * 0.22;
      cursor.style.transform = `translate3d(${cx}px,${cy}px,0)`;
      cTxt.textContent = String(Math.round(cx)).padStart(4, '0') + ' · ' + String(Math.round(cy)).padStart(4, '0');
    });
    document.addEventListener('pointerover', (e) => {
      cursor.classList.toggle('hover', !!e.target.closest('a,button,.eng,.mcard,.sc-col'));
    });
    $$('.btn, .brand, .paper-toggle').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.5, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1,.4)' }));
    });
  }

  /* ---------- Progression, rail, nav active ---------- */
  const navBar = $('#navProgress');
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => (navBar.style.transform = `scaleX(${s.progress})`) });
  ['hero', 'anatomie', 'lancement', 'raptor', 'mission', 'echelle', 'versions'].forEach((id) => {
    ScrollTrigger.create({
      trigger: '#' + id, start: 'top 55%', end: 'bottom 55%',
      onToggle: (s) => {
        if (!s.isActive) return;
        $$('[data-rail]').forEach((a) => a.classList.toggle('on', a.dataset.rail === id));
        $$('.nav-links a').forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + id));
      },
    });
  });

  /* ---------- Hero : les éléments s'effacent en scrollant ---------- */
  gsap.to('.hero-top, .specs, .blueprint, .scroll-hint, .paper-toggle', {
    opacity: 0, y: -40, ease: 'none',
    scrollTrigger: { trigger: '#hero', start: 'top top', end: '45% top', scrub: true },
  });

  /* ---------- Intro : une phrase par ligne, révélées l'une après l'autre ---------- */
  const lines = $$('#revealWords .ln');
  const showLines = (p) => {
    const n = p * (lines.length + 0.4);
    lines.forEach((l, i) => {
      const t = clamp((n - i) / 0.8);
      l.style.opacity = t; l.style.transform = `translate3d(0,${(1 - t) * 28}px,0)`; l.style.filter = t > 0.99 ? 'none' : `blur(${(1 - t) * 6}px)`;
    });
  };
  const linesST = ScrollTrigger.create({
    trigger: '#intro', start: 'top 75%', end: 'center 45%',
    onUpdate: (s) => showLines(s.progress), onRefresh: (s) => showLines(s.progress),
  });
  showLines(linesST.progress);

  /* ---------- Anatomie ---------- */
  // [liste, titre, texte, étage, hauteur (m depuis la base), [[clé, valeur] × 3]]
  const steps = [
    ['Vue d\'ensemble', 'Le système Starship', 'Super Heavy, le premier étage, propulse l\'ensemble pendant environ deux minutes et demie. Starship, le second étage, termine le trajet jusqu\'à l\'orbite. Les deux sont conçus pour être récupérés et réutilisés.', 'Système complet', 62,
      [['Hauteur', '124,4 m'], ['Masse au décollage', '≈ 5 600 t'], ['Moteurs', '39 Raptor 3']]],
    ['Coiffe', 'Coiffe', 'Une pointe ogivale en acier inoxydable, recouverte de tuiles côté exposé. Elle abrite un réservoir d\'en-tête utilisé pour la manœuvre d\'atterrissage et encaisse les plus fortes contraintes aérodynamiques.', 'Starship · second étage', 121,
      [['Matériau', 'Acier inoxydable'], ['Protection', 'Tuiles en céramique'], ['Contient', 'Réservoir d\'en-tête']]],
    ['Volets avant', 'Volets avant', 'Deux volets articulés pilotent le vaisseau pendant sa chute à plat dans l\'atmosphère. Sur V3, ils sont plus petits et décalés du côté sous le vent, pour être moins exposés au plasma.', 'Starship · second étage', 117,
      [['Nombre', '2'], ['Rôle', 'Contrôle en chute à plat'], ['Sur V3', 'Plus petits, côté sous le vent']]],
    ['Soute', 'Soute', 'Une longue porte façon distributeur libère les satellites Starlink de nouvelle génération un par un. Sur V3, l\'objectif est de dépasser 100 tonnes en orbite basse, en mode réutilisable.', 'Starship · second étage', 108,
      [['Charge utile visée', '> 100 t'], ['Ouverture', 'Porte « distributeur »'], ['Usage', 'Satellites Starlink']]],
    ['Bouclier thermique', 'Bouclier thermique', 'Environ 18 000 tuiles hexagonales en céramique couvrent la face qui affronte la rentrée. Fixées par des goujons, elles laissent l\'acier se dilater librement sous elles.', 'Starship · second étage', 98,
      [['Tuiles', '≈ 18 000'], ['Température', '> 1 400 °C'], ['Vitesse de rentrée', '> 26 000 km/h']]],
    ['Volets arrière', 'Volets arrière & 6 Raptor', 'Les grands volets arrière stabilisent la chute. Dans la jupe, trois Raptor 3 pour l\'atmosphère, au centre, et trois Raptor Vacuum à grande tuyère pour le vide spatial.', 'Starship · second étage', 76,
      [['Raptor atmosphère', '3'], ['Raptor Vacuum', '3'], ['Volets arrière', '2']]],
    ['Hot staging', 'Anneau de hot staging', 'Le vaisseau allume ses moteurs avant même de se séparer. L\'anneau ajouré laisse s\'échapper les gaz brûlants. Sur V3, il fait partie intégrante du booster.', 'Interface entre les étages', 72,
      [['Altitude', '≈ 65 km'], ['Moment', '≈ T+02:40'], ['Sur V3', 'Intégré au booster']]],
    ['Grid fins', 'Grid fins', 'Trois grilles de pilotage, plus grandes et plus robustes que les quatre des versions précédentes. Elles orientent le booster pendant sa descente vers les bras de la tour.', 'Super Heavy · premier étage', 68,
      [['Nombre', '3, contre 4 avant'], ['Rôle', 'Guidage en descente'], ['Retour', 'Capture par la tour']]],
    ['Chines', 'Chines', 'Deux profilés longitudinaux courent le long du booster. Ils ajoutent un peu de portance et stabilisent sa trajectoire pendant le retour vers le site de lancement.', 'Super Heavy · premier étage', 32,
      [['Nombre', '2'], ['Position', 'Flancs du booster'], ['Rôle', 'Portance et stabilité']]],
    ['Premier étage', 'Super Heavy', 'Le premier étage : environ 72 mètres d\'acier et plus de 3 400 tonnes de méthane et d\'oxygène liquide. Il revient se faire attraper par la tour quelques minutes après le décollage.', 'Super Heavy · premier étage', 36,
      [['Hauteur', '≈ 72 m'], ['Ergols', '> 3 400 t'], ['Retour', '≈ 7 min après le décollage']]],
    ['33 Raptor 3', '33 Raptor 3', 'Trente-trois moteurs au méthane, plus simples et plus légers que les Raptor 2. Ils n\'ont plus besoin de carénage de protection. Ensemble, ils développent la plus forte poussée de l\'histoire.', 'Super Heavy · premier étage', 0,
      [['Poussée totale', '≈ 9 200 tf'], ['Par moteur', '≈ 280 tf'], ['Ergols', 'Méthane + oxygène liquide']]],
  ];
  SS.anatSteps = steps.length;
  $('#anTot').textContent = String(steps.length).padStart(2, '0');
  const list = $('#anatList');
  list.innerHTML = steps.map((s, i) => `<li><button type="button" data-i="${i}">${s[0]}</button></li>`).join('');
  const anBtns = $$('button', list);
  const anBody = $('#anatBody');
  let curStep = -1;
  function showStep(i) {
    if (i === curStep) return;
    const first = curStep === -1;
    curStep = i;
    const s = steps[i];
    anBtns.forEach((b, j) => b.classList.toggle('on', j === i));
    $('#anIdx').textContent = String(i + 1).padStart(2, '0');
    $('#anMark').style.left = (s[4] / 124.4) * 100 + '%';
    $('#anPosV').textContent = i === 0 ? '124,4 m' : `à ${s[4]} m`;
    const swap = () => {
      $('#anTitle').textContent = s[1]; $('#anText').textContent = s[2];
      $('#anPart').textContent = s[3];
      $('#anSpecs').innerHTML = s[5].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    };
    if (first || reduce) { swap(); return; }
    gsap.timeline()
      .to(anBody.children, { y: -14, opacity: 0, duration: 0.22, stagger: 0.03, ease: 'power2.in' })
      .add(swap)
      .fromTo(anBody.children, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.06, ease: 'expo.out' });
  }
  showStep(0);
  ScrollTrigger.create({
    trigger: '#anatomie', start: 'top top', end: 'bottom bottom',
    onUpdate: (s) => {
      const f = s.progress * (steps.length - 1);
      showStep(Math.round(f));
    },
  });
  anBtns.forEach((b) => b.addEventListener('click', () => {
    const st = SS.st.anat, i = +b.dataset.i;
    scrollTo(st.start + (st.end - st.start) * (i / (steps.length - 1)) + 2);
  }));
  gsap.from('.ex', { y: 24, opacity: 0, duration: 0.9, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '.explore', start: 'top 85%', toggleActions: 'play none none reverse' } });
  gsap.from('#anatCard', { x: -40, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '#anatomie', start: 'top 60%', toggleActions: 'play none none reverse' } });

  /* ---------- Lancement : HUD, callouts ---------- */
  const callout = $('#callout'), cTxtEl = $('#calloutTxt'), cSub = $('#calloutSub');
  const hud = $('#hud'), hudClock = $('#hudClock'), hudSign = $('#hudSign'), hudFill = $('#hudFill');
  const evs = $$('.hud-line span');
  const gB = $('#gBooster'), gS = $('#gShip');
  const C50 = 2 * Math.PI * 50 * 0.75, C41 = 2 * Math.PI * 41 * 0.75;
  [gB, gS].forEach((g) => {
    $$('.g-bg, .g-spd', g).forEach((c) => (c.style.strokeDasharray = `${C50} 999`));
    $$('.g-bg2, .g-alt', g).forEach((c) => (c.style.strokeDasharray = `${C41} 999`));
  });
  const setGauge = (g, v, a, vMax, aMax) => {
    $('.g-spd', g).style.strokeDashoffset = C50 * (1 - clamp(v / vMax));
    $('.g-alt', g).style.strokeDashoffset = C41 * (1 - clamp(a / aMax));
    $('.g-v', g).textContent = fmt(Math.round(v));
    $('.g-a', g).textContent = fmt(a, a < 10 ? 1 : 0);
  };
  // temps de mission (s) en fonction de la progression p
  const missionT = (p) => (p < 0.12 ? -10 * (1 - p / 0.12) : p < 0.555 ? ((p - 0.12) / 0.435) * 160 : 160 + ((p - 0.555) / 0.445) * 340);
  SS.missionT = missionT;
  const callouts = [
    [0.0, 0.08, null, 'Compte à rebours'],
    [0.08, 0.12, 'Allumage', '33 moteurs Raptor 3'],
    [0.12, 0.2, 'Décollage', 'Starbase, Texas'],
    [0.3, 0.38, 'Max-Q', 'Pression dynamique maximale'],
    [0.46, 0.53, 'MECO', 'Extinction des moteurs du booster'],
    [0.535, 0.62, 'Hot staging', 'Séparation des étages'],
    [0.7, 0.82, 'Boostback', 'Le booster fait demi-tour'],
    [0.9, 1.01, 'En route', 'vers l\'orbite'],
  ];
  const tStr = (t) => { t = Math.abs(t); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60); return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':'); };
  let lastCall = '';
  ScrollTrigger.create({
    trigger: '#lancement', start: 'top top', end: 'bottom bottom',
    onUpdate: (s) => updLaunch(s.progress),
    onRefresh: (s) => updLaunch(s.progress),
  });
  function updLaunch(p) {
    const t = missionT(p);
    $('#launchHead').style.opacity = 1 - clamp(p / 0.05);
    $('#launchHead').style.transform = `translateY(${-clamp(p / 0.05) * 40}px)`;
    hud.style.opacity = clamp((p - 0.02) / 0.04) * (1 - clamp((p - 0.97) / 0.03));
    hudSign.textContent = t < 0 ? '-' : '+';
    hudClock.textContent = tStr(t < 0 ? Math.ceil(-t) : t);
    hudFill.style.transform = `scaleX(${clamp((p - 0.12) / 0.86)})`;
    const evAt = [0.12, 0.3, 0.535, 0.7, 0.98];
    evs.forEach((e, i) => e.classList.toggle('on', p >= evAt[i]));
    // télémétrie
    const ts = Math.max(0, t);
    let bv, ba, sv, sa;
    if (ts <= 160) { const k = ts / 160; bv = 5600 * Math.pow(k, 1.55); ba = 67 * Math.pow(k, 1.9); sv = bv; sa = ba; }
    else {
      const k = (ts - 160) / 340;
      bv = Math.max(0, 5600 - 5600 * Math.sin(Math.min(1, k * 1.6) * Math.PI / 2) * 0.92);
      ba = 67 + 28 * Math.sin(Math.min(1, k * 1.3) * Math.PI) ;
      sv = 5600 + 21000 * Math.pow(k, 1.25); sa = 67 + 83 * Math.pow(k, 0.8);
    }
    setGauge(gB, bv, ba, 9000, 160);
    setGauge(gS, sv, sa, 27000, 160);
    // callouts
    let c = null;
    for (const cc of callouts) if (p >= cc[0] && p < cc[1]) c = cc;
    let key = c ? (c[2] || 'cd') : '';
    if (c && !c[2]) { cTxtEl.textContent = 'T-' + String(Math.ceil(-t)).padStart(2, '0'); cSub.textContent = c[3]; }
    if (key !== lastCall) {
      lastCall = key;
      if (c) {
        if (c[2]) { cTxtEl.textContent = c[2]; cSub.textContent = c[3]; }
        gsap.fromTo(callout, { opacity: 0, y: 30, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'expo.out', overwrite: true });
      } else gsap.to(callout, { opacity: 0, y: -20, duration: 0.4, overwrite: true });
    }
    if (c && !c[2] && p < 0.02) callout.style.opacity = clamp(p / 0.02);
  }

  /* ---------- Bandeau défilant (accélère avec la vitesse de scroll) ---------- */
  const mq = $('#marquee');
  mq.innerHTML += mq.innerHTML;
  let mqX = 0;
  gsap.ticker.add(() => {
    const w = mq.scrollWidth / 2;
    mqX -= (reduce ? 0.3 : 0.8) + Math.min(30, Math.abs(SS.vel || 0) * 0.6);
    if (mqX <= -w) mqX += w;
    mq.style.transform = `translate3d(${mqX}px,0,0)`;
  });

  /* ---------- Raptor : 33 moteurs ---------- */
  const engG = $('#engG');
  const rings = [[3, 13, 0, 'Central'], [10, 42, 18, 'Anneau intérieur'], [20, 82, 9, 'Anneau extérieur']];
  let svg = '', idx = 0;
  rings.forEach(([n, r, rot, name], ri) => {
    for (let i = 0; i < n; i++) {
      const a = ((i / n) * 360 + rot) * Math.PI / 180;
      const x = (Math.cos(a) * r).toFixed(2), y = (Math.sin(a) * r).toFixed(2);
      const br = ri === 2 ? 11.5 : 11.5;
      idx++;
      svg += `<g class="eng" data-n="${idx}" data-ring="${name}" data-gimbal="${ri < 2 ? 'Orientable' : 'Fixe'}" transform="translate(${x} ${y})">
        <circle r="${br + 6}" class="fire" fill="url(#gFire)"/>
        <circle r="${br}" fill="url(#gBell)"/><circle r="${br}" class="ring"/>
        <circle r="${(br * 0.32).toFixed(1)}" fill="#050505"/></g>`;
    }
  });
  engG.innerHTML = svg;
  const engs = $$('.eng', engG);
  const engCount = $('#engCount'), engThrust = $('#engThrust');
  let litN = -1;
  ScrollTrigger.create({
    trigger: '#raptor', start: 'top 65%', end: 'center 40%',
    onUpdate: (s) => {
      const n = Math.round(s.progress * 33);
      if (n === litN) return; litN = n;
      engs.forEach((e, i) => e.classList.toggle('lit', i < n));
      engCount.textContent = n;
      engThrust.textContent = fmt(n * 280);
    },
  });
  const tip = $('#engTip'), engWrap = $('.eng-wrap');
  engs.forEach((e) => {
    e.addEventListener('pointerenter', () => {
      tip.innerHTML = `<b>Raptor ${e.dataset.n.padStart(2, '0')}</b><br>${e.dataset.ring} · ${e.dataset.gimbal}<br>${e.classList.contains('lit') ? 'Allumé · ≈ 280 tf' : 'Éteint'}`;
      tip.style.opacity = 1;
    });
    e.addEventListener('pointermove', (ev) => {
      const r = engWrap.getBoundingClientRect();
      tip.style.transform = `translate(${ev.clientX - r.left + 14}px, ${ev.clientY - r.top + 14}px)`;
    });
    e.addEventListener('pointerleave', () => (tip.style.opacity = 0));
  });
  gsap.from('.gen-bar i', { scaleX: 0, duration: 1.4, stagger: 0.15, ease: 'expo.out', scrollTrigger: { trigger: '#gens', start: 'top 85%', toggleActions: 'play none none reverse' } });
  gsap.from('.raptor-copy > *', { y: 40, opacity: 0, duration: 1, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: '#raptor', start: 'top 70%', toggleActions: 'play none none reverse' } });
  // rotation lente de la vue des moteurs
  gsap.to('#engG', { rotation: 30, svgOrigin: '0 0', ease: 'none', scrollTrigger: { trigger: '#raptor', start: 'top bottom', end: 'bottom top', scrub: 1 } });

  /* ---------- Mission : défilement horizontal ---------- */
  const track = $('#track'), mission = $('#mission'), trajPath = $('#trajPath');
  const tLen = trajPath.getTotalLength();
  function sizeMission() {
    const extra = Math.max(0, track.scrollWidth - innerWidth);
    mission.style.height = innerHeight + extra + 'px';
    SS.missionExtra = extra;
  }
  sizeMission();
  trajPath.style.strokeDasharray = `${tLen}`;
  ScrollTrigger.create({
    trigger: '#mission', start: 'top top', end: 'bottom bottom', invalidateOnRefresh: true,
    onRefreshInit: sizeMission,
    onUpdate: (s) => {
      const x = -s.progress * (SS.missionExtra || 0);
      track.style.transform = `translate3d(${x}px,0,0)`;
      trajPath.style.strokeDashoffset = tLen * (1 - s.progress);
      $('#missionBar').style.transform = `scaleX(${s.progress})`;
      $$('.mcard', track).forEach((c) => {
        const r = c.getBoundingClientRect();
        const d = (r.left + r.width / 2 - innerWidth / 2) / innerWidth;
        c.style.opacity = clamp(1.25 - Math.abs(d) * 1.1, 0.35, 1);
      });
    },
  });

  /* ---------- Échelle ---------- */
  const figs = [
    ['Starship V3', 124.4, 'rocket3', true, 14],
    ['Saturn V', 110.6, 'saturn', false, 14],
    ['SLS Block 1', 98.3, 'sls', false, 16],
    ['Statue de la Liberté', 93, 'liberty', false, 19],
    ['Falcon Heavy', 70, 'falcon', false, 12.2],
    ['Ariane 6', 62, 'ariane', false, 13],
    ['Humain', 1.8, 'human', false, 0.6],
  ];
  const shapes = {
    rocket3: 'M50 0 C58 6 62 14 62 28 L62 140 L72 152 L72 166 L62 162 L62 1000 L38 1000 L38 162 L28 166 L28 152 L38 140 L38 28 C38 14 42 6 50 0 Z',
    saturn: 'M50 0 L52 40 L57 60 L57 140 L62 160 L62 380 L68 400 L68 1000 L32 1000 L32 400 L38 380 L38 160 L43 140 L43 60 L48 40 Z',
    sls: 'M50 0 L53 40 L56 70 L56 160 L60 200 L60 1000 L40 1000 L40 200 L44 160 L44 70 L47 40 Z M28 200 C30 180 34 180 36 200 L36 960 L28 960 Z M64 200 C66 180 70 180 72 200 L72 960 L64 960 Z',
    liberty: 'M47 0 L50 -6 L53 0 L54 60 L58 70 L60 120 L58 300 L62 420 L56 480 L64 520 L66 1000 L34 1000 L36 520 L44 480 L38 420 L42 300 L40 120 L44 60 Z',
    falcon: 'M50 0 C54 10 55 30 55 60 L55 1000 L45 1000 L45 60 C45 30 46 10 50 0 Z M33 260 C35 230 39 230 41 260 L41 1000 L33 1000 Z M59 260 C61 230 65 230 67 260 L67 1000 L59 1000 Z',
    ariane: 'M50 0 C56 12 58 40 58 90 L58 1000 L42 1000 L42 90 C42 40 44 12 50 0 Z M30 560 C32 530 36 530 38 560 L38 1000 L30 1000 Z M62 560 C64 530 68 530 70 560 L70 1000 L62 1000 Z',
    human: 'M50 0 a10 10 0 1 1 0.1 0 Z M40 24 L60 24 L62 60 L56 60 L56 100 L44 100 L44 60 L38 60 Z',
  };
  const chart = $('#scaleChart'), grid = $('.sc-grid', chart);
  [0, 25, 50, 75, 100, 125].forEach((m) => {
    const s = document.createElement('span');
    s.style.bottom = `calc(${(m / 130) * 100}% * var(--h, 1))`;
    s.textContent = m + ' m';
    grid.appendChild(s);
  });
  figs.forEach(([name, h, key, hero, wm]) => {
    const col = document.createElement('div');
    col.className = 'sc-col' + (hero ? ' hero-col' : '');
    const pct = (h / 130) * 100;
    const diff = hero ? 'Référence' : (h < 124.4 ? `${fmt(124.4 - h, 1)} m de moins` : '');
    col.innerHTML = `<div class="sc-fig" style="height:calc((100% - 34px) * ${pct / 100})"><svg viewBox="${key === 'human' ? '30 -2 40 104' : '20 -8 60 1010'}" preserveAspectRatio="none" style="aspect-ratio:${wm} / ${h}"><path d="${shapes[key]}"/></svg></div>
      <span class="sc-val" style="bottom:calc(34px + (100% - 34px) * ${pct / 100})">${fmt(h, h % 1 ? 1 : 0)} m</span>
      <div class="sc-lab"><b>${name}</b></div><span class="sc-diff">${diff}</span>`;
    chart.appendChild(col);
  });
  // la grille utilise la même échelle que les silhouettes
  $$('span', grid).forEach((s, i) => (s.style.bottom = `${([0, 25, 50, 75, 100, 125][i] / 130) * 100}%`));
  gsap.from('.sc-fig', { scaleY: 0, duration: 1.6, stagger: 0.09, ease: 'expo.out', scrollTrigger: { trigger: '#scaleChart', start: 'top 75%', toggleActions: 'play none none reverse' } });
  gsap.from('.sc-val', { opacity: 0, y: 20, duration: 0.8, stagger: 0.09, delay: 0.6, ease: 'expo.out', scrollTrigger: { trigger: '#scaleChart', start: 'top 75%', toggleActions: 'play none none reverse' } });

  /* ---------- Versions ---------- */
  const vData = [
    ['Hauteur totale', 'm', [121.3, 123.1, 124.4], 1],
    ['Poussée par moteur', 'tf', [230, 230, 280], 0],
    ['Poussée du booster', 'tf', [7590, 7590, 9240], 0],
    ['Moteurs', '', [39, 39, 39], 0],
    ['Grid fins', '', [4, 4, 3], 0],
    ['Premier vol', '', [2023, 2025, 2026], 0],
  ];
  const vLabels = ['Raptor 2', 'Raptor 2', 'Raptor 3'];
  const vGrid = $('#vGrid');
  vGrid.innerHTML = vData.map((d, i) => `<dl class="vcell"><dt>${d[0]}${i === 3 ? ' · <span class="vEng">Raptor 3</span>' : ''}</dt><dd><span class="vnum">0</span>${d[1] ? `<small>${d[1]}</small>` : ''}</dd><div class="vbar"><i></i></div></dl>`).join('');
  const cells = $$('.vcell', vGrid);
  const tabs = $$('#vTabs button'), ink = $('#tabInk');
  let curV = 2;
  const vState = vData.map((d) => ({ v: d[2][2] }));
  function setV(v, instant) {
    curV = v;
    tabs.forEach((t, i) => t.setAttribute('aria-selected', i === v));
    const b = tabs[v];
    ink.style.width = b.offsetWidth + 'px';
    ink.style.transform = `translateX(${b.offsetLeft - 4}px)`;
    $('.vEng', vGrid).textContent = vLabels[v];
    vData.forEach((d, i) => {
      const target = d[2][v], max = Math.max(...d[2]);
      const el = $('.vnum', cells[i]);
      const isYear = i === 5;
      const out = () => (el.textContent = isYear ? Math.round(vState[i].v) + (v === 2 ? ' →' : '') : fmt(vState[i].v, d[3]));
      if (instant) { vState[i].v = target; out(); }
      else gsap.to(vState[i], { v: target, duration: 1, ease: 'expo.out', onUpdate: out });
      $('.vbar i', cells[i]).style.transform = `scaleX(${isYear ? (target - 2022) / 4 : target / max})`;
      cells[i].classList.toggle('up', v > 0 && target > d[2][v - 1] && !isYear);
    });
  }
  tabs.forEach((t) => t.addEventListener('click', () => setV(+t.dataset.v)));
  setV(2, true);
  addEventListener('resize', () => setV(curV, true));
  ScrollTrigger.create({ trigger: '#versions', start: 'top 70%', once: true, onEnter: () => { setV(0, true); setTimeout(() => setV(1), 300); setTimeout(() => setV(2), 1300); } });

  /* ---------- Révélations génériques ---------- */
  $$('#echelle h2, #versions h2, .mission-head').forEach((h) => {
    gsap.from(h, { yPercent: 30, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: h, start: 'top 85%', toggleActions: 'play none none reverse' } });
  });
  gsap.from('.final-title span', { backgroundPosition: '200% 0', duration: 2, ease: 'expo.out', scrollTrigger: { trigger: '#final', start: 'top 60%' } });
  $('#toTop').addEventListener('click', () => scrollTo(0));

  /* ---------- Mars (sphère texturée procédurale, 2D) ---------- */
  const mc = $('#mars');
  const mctx = mc.getContext('2d');
  const TW = 512, TH = 256;
  const tex = new Float32Array(TW * TH * 3);
  (function buildMars() {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const G = 64, gr = Array.from({ length: (G + 1) * (G / 2 + 1) }, rnd);
    const vn = (x, y, s) => {
      const gx = (x * s) % G, gy = Math.min(G / 2 - 0.001, y * s * 0.5);
      const ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
      const at = (a, b) => gr[(b % (G / 2 + 1)) * (G + 1) + (a % G)];
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy;
    };
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const u = x / TW * G, v = y / TH * G / 2;
      let n = 0, a = 0.5, f = 0.25;
      for (let o = 0; o < 6; o++) { n += vn(u * f * 4, v * f * 4, 1) * a; a *= 0.5; f *= 2; }
      const lat = Math.abs(y / TH - 0.5) * 2;
      const sm = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
      const dark = 1 - sm(0.42, 0.62, n) * 0.42 - (n - 0.4) * 0.25;
      let r = 0.78 * dark, g = 0.36 * dark, b = 0.2 * dark;
      const vall = Math.abs(y / TH - 0.53) < 0.012 && x > TW * 0.3 && x < TW * 0.55 ? 0.6 : 1; // Valles Marineris
      r *= vall; g *= vall; b *= vall;
      if (lat > 0.88) { const k = clamp((lat - 0.88) / 0.06); r += (0.95 - r) * k; g += (0.9 - g) * k; b += (0.88 - b) * k; }
      const i3 = (y * TW + x) * 3; tex[i3] = r; tex[i3 + 1] = g; tex[i3 + 2] = b;
    }
  })();
  const S = 400; mc.width = mc.height = S;
  const img = mctx.createImageData(S, S);
  let marsVisible = false, rotM = 0;
  new IntersectionObserver((e) => (marsVisible = e[0].isIntersecting)).observe(mc);
  const L = [-0.55, -0.35, 0.76];
  function drawMars() {
    const d = img.data, R = S / 2 - 8;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const i = (py * S + px) * 4;
      const nx = (px - S / 2) / R, ny = (py - S / 2) / R, rr = nx * nx + ny * ny;
      if (rr > 1.06) { d[i + 3] = 0; continue; }
      if (rr > 1) { // atmosphère
        const k = 1 - (rr - 1) / 0.06; d[i] = 255; d[i + 1] = 150; d[i + 2] = 100; d[i + 3] = 70 * k * k; continue;
      }
      const nz = Math.sqrt(1 - rr);
      // inclinaison de l'axe
      const tilt = 0.44, cy = Math.cos(tilt), sy = Math.sin(tilt);
      const yy = ny * cy - nz * sy, zz = ny * sy + nz * cy;
      const lon = Math.atan2(nx, zz) + rotM, lat = Math.asin(clamp(yy, -1, 1));
      let u = ((lon / (2 * Math.PI)) % 1 + 1) % 1, v = lat / Math.PI + 0.5;
      const fx = u * TW, fy = Math.min(TH - 1.001, v * TH);
      const x0 = Math.floor(fx) % TW, x1 = (x0 + 1) % TW, y0 = Math.floor(fy), y1 = Math.min(TH - 1, y0 + 1), ax = fx - Math.floor(fx), ay = fy - y0;
      const s00 = (y0 * TW + x0) * 3, s10 = (y0 * TW + x1) * 3, s01 = (y1 * TW + x0) * 3, s11 = (y1 * TW + x1) * 3;
      const smp = (o) => (tex[s00 + o] * (1 - ax) + tex[s10 + o] * ax) * (1 - ay) + (tex[s01 + o] * (1 - ax) + tex[s11 + o] * ax) * ay;
      const cr = smp(0), cg = smp(1), cb = smp(2);
      let lam = nx * L[0] + ny * L[1] + nz * L[2];
      lam = clamp(lam * 1.15 + 0.06);
      const lim = Math.pow(1 - nz, 3) * 0.5;
      d[i] = clamp(cr * lam + lim * 0.9 * lam) * 255;
      d[i + 1] = clamp(cg * lam + lim * 0.45 * lam) * 255;
      d[i + 2] = clamp(cb * lam + lim * 0.3 * lam) * 255;
      d[i + 3] = 255;
    }
    mctx.putImageData(img, 0, 0);
  }
  drawMars();
  gsap.ticker.add(() => { if (!marsVisible) return; rotM += reduce ? 0 : 0.0025; drawMars(); });
  gsap.fromTo('#mars', { yPercent: -35, scale: 0.85 }, { yPercent: -60, scale: 1.05, ease: 'none', scrollTrigger: { trigger: '#final', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  addEventListener('resize', () => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());
})();
