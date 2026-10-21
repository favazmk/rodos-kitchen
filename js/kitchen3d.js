/* RODOS — scroll-driven 3D "anatomy" of a stainless steel kitchen island */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

/* ---------- Procedural textures ---------- */
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const brushed = () =>
  canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#bfc2c4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const y = Math.random() * h;
      const v = 150 + Math.random() * 105;
      g.strokeStyle = `rgba(${v},${v},${v},${0.05 + Math.random() * 0.14})`;
      g.lineWidth = Math.random() * 1.2;
      const x = Math.random() * w;
      g.beginPath(); g.moveTo(x - 300, y); g.lineTo(x + 300, y); g.stroke();
    }
  }, [2, 2]);

const wood = () =>
  canvasTex(1024, 256, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#b47c45'); grd.addColorStop(1, '#9a6534');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const y0 = Math.random() * h, amp = 2 + Math.random() * 6, f = 0.004 + Math.random() * 0.01;
      g.strokeStyle = `rgba(${70 + Math.random() * 30},${40 + Math.random() * 20},20,${0.08 + Math.random() * 0.22})`;
      g.lineWidth = 0.5 + Math.random() * 2;
      g.beginPath();
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y0 + Math.sin(x * f + i) * amp);
      g.stroke();
    }
  }, [1, 1]);

const quartz = () =>
  canvasTex(2048, 1024, (g, w, h) => {
    g.fillStyle = '#f3f0ea'; g.fillRect(0, 0, w, h);
    const vein = (color, width, alpha, blur) => {
      g.save(); g.filter = `blur(${blur}px)`;
      g.strokeStyle = color; g.globalAlpha = alpha; g.lineWidth = width;
      g.beginPath();
      let x = Math.random() * w, y = -20;
      g.moveTo(x, y);
      while (y < h + 20) {
        const nx = x + (Math.random() - 0.4) * 260, ny = y + 60 + Math.random() * 140;
        g.quadraticCurveTo(x + (Math.random() - 0.5) * 200, (y + ny) / 2, nx, ny);
        x = nx; y = ny;
      }
      g.stroke(); g.restore();
    };
    for (let i = 0; i < 9; i++) vein('#8d8a86', 10 + Math.random() * 18, 0.12, 12);
    for (let i = 0; i < 14; i++) vein('#6f6b66', 1 + Math.random() * 2.5, 0.35, 0.6);
    for (let i = 0; i < 5; i++) vein('#b9853f', 1.5 + Math.random() * 2, 0.55, 0.4);
  }, [1, 1]);

/* ---------- Scene ---------- */
export function initKitchen(section, { reduced, gsap, ScrollTrigger }) {
  const stage = section.querySelector('.anatomy__stage');
  const canvas = section.querySelector('canvas');
  const steps = [...section.querySelectorAll('.anatomy__steps li')];
  const stepNum = section.querySelector('[data-step-num]');
  const bar = section.querySelector('[data-anatomy-bar]');
  const pin = section.querySelector('.anatomy__pin-label');
  const pinText = pin.querySelector('span');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 1.15;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);

  const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
  key.position.set(3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 15 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key, new THREE.HemisphereLight(0xffffff, 0x2a3026, 0.6));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  /* Materials */
  const brushTex = brushed();
  const woodTex = wood();
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xe2e5e7, metalness: 1, roughness: 0.4, map: brushTex, roughnessMap: brushTex });
  const darkSteel = new THREE.MeshPhysicalMaterial({ color: 0x55595b, metalness: 1, roughness: 0.4, map: brushTex });
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xe8eaeb, metalness: 1, roughness: 0.12 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b0c0d, metalness: 0.2, roughness: 0.06, clearcoat: 1 });
  const stone = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: quartz(), roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const frontMat = new THREE.MeshPhysicalMaterial({ color: 0xe2e5e7, metalness: 1, roughness: 0.4, map: brushTex, roughnessMap: brushTex, clearcoat: 0 });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x2a1a12 });
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x2b2b2b });
  const shadeMat = new THREE.MeshPhysicalMaterial({ color: 0x1f2220, metalness: 0.6, roughness: 0.35 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0x333333 });

  const mesh = (geo, mat, parent, pos = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  /* Model (metres) */
  const W = 2.4, Dc = 0.8, kick = 0.1, carcH = 0.76;
  const model = new THREE.Group();
  scene.add(model);

  // Carcass: an open-fronted steel box with column dividers, so pulled drawers show real bays behind them
  const carcass = new THREE.Group();
  model.add(carcass);
  const t = 0.018, cy = kick + carcH / 2, inner = W - 0.02 - t * 2;
  mesh(new THREE.BoxGeometry(t, carcH, Dc), steel, carcass, [-(W - 0.02) / 2 + t / 2, cy, 0]);
  mesh(new THREE.BoxGeometry(t, carcH, Dc), steel, carcass, [(W - 0.02) / 2 - t / 2, cy, 0]);
  mesh(new THREE.BoxGeometry(inner, t, Dc), steel, carcass, [0, kick + t / 2, 0]);
  mesh(new THREE.BoxGeometry(inner, t, Dc), steel, carcass, [0, kick + carcH - t / 2, 0]);
  mesh(new THREE.BoxGeometry(inner, carcH - t * 2, t), darkSteel, carcass, [0, cy, -Dc / 2 + t / 2]);
  for (let i = 1; i < 4; i++) mesh(new THREE.BoxGeometry(t * 0.6, carcH - t * 2, Dc - t), steel, carcass, [-(W - 0.02) / 2 + i * (W - 0.02) / 4, cy, t / 2]);
  const toe = mesh(new THREE.BoxGeometry(W - 0.1, kick, Dc - 0.08), darkSteel, model, [0, kick / 2, -0.04]);

  // Drawers: 4 columns
  const cols = [[0.16, 0.29, 0.29], [0.37, 0.37], [0.37, 0.37], [0.16, 0.29, 0.29]];
  const gap = 0.006;
  const cw = (W - 0.02 - gap * 5) / 4;
  const drawers = [];
  cols.forEach((col, ci) => {
    let top = kick + carcH - gap;
    col.forEach((hh, ri) => {
      const h = hh - gap;
      const g = new THREE.Group();
      const x = -W / 2 + 0.01 + gap + cw / 2 + ci * (cw + gap);
      g.position.set(x, top - h / 2, Dc / 2 + 0.011);
      model.add(g);
      const front = mesh(new RoundedBoxGeometry(cw, h, 0.022, 3, 0.004), frontMat, g);
      // gola-style finger channel on the top drawer of each column
      if (ri === 0) mesh(new THREE.BoxGeometry(cw * 0.94, 0.008, 0.004), darkSteel, g, [0, h / 2 - 0.012, 0.012]);
      // drawer box: base, sides and back — open on top
      const bx = cw - 0.07, by = h - 0.06, bz = 0.56;
      mesh(new THREE.BoxGeometry(bx, 0.01, bz), steel, g, [0, -by / 2, -bz / 2 - 0.011]);
      mesh(new THREE.BoxGeometry(0.01, by, bz), steel, g, [-bx / 2, 0, -bz / 2 - 0.011]);
      mesh(new THREE.BoxGeometry(0.01, by, bz), steel, g, [bx / 2, 0, -bz / 2 - 0.011]);
      mesh(new THREE.BoxGeometry(bx, by, 0.01), steel, g, [0, 0, -bz - 0.011]);
      drawers.push({ g, front, ci, ri, home: g.position.clone() });
      top -= hh;
    });
  });

  // Worktop + appliances
  const topY = kick + carcH + 0.02;
  const worktop = new THREE.Group();
  model.add(worktop);
  mesh(new RoundedBoxGeometry(W + 0.06, 0.04, 0.96, 3, 0.006), stone, worktop, [0, topY, 0.01]);

  const hob = new THREE.Group();
  model.add(hob);
  mesh(new RoundedBoxGeometry(0.62, 0.008, 0.5, 2, 0.003), glass, hob, [0.55, topY + 0.024, 0.04]);
  const rings = [];
  [[-0.14, -0.11, 0.075], [0.14, -0.11, 0.06], [-0.14, 0.12, 0.06], [0.14, 0.12, 0.085]].forEach(([dx, dz, r]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0028, 8, 64), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0.55 + dx, topY + 0.029, 0.04 + dz);
    hob.add(ring); rings.push(ring);
  });

  const sink = new THREE.Group();
  model.add(sink);
  mesh(new RoundedBoxGeometry(0.56, 0.006, 0.42, 2, 0.02), darkSteel, sink, [-0.62, topY + 0.019, 0.04]);
  const tap = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.62, topY, -0.24), new THREE.Vector3(-0.62, topY + 0.3, -0.24),
    new THREE.Vector3(-0.62, topY + 0.38, -0.14), new THREE.Vector3(-0.62, topY + 0.32, -0.04),
  ]);
  mesh(new THREE.TubeGeometry(tap, 40, 0.012, 12), chrome, sink);
  mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.03, 24), chrome, sink, [-0.62, topY + 0.035, -0.24]);

  // LED strip under the front overhang + its light wash on the fronts
  const led = mesh(new THREE.BoxGeometry(W - 0.12, 0.008, 0.012), ledMat, model, [0, topY - 0.026, 0.45]);
  led.castShadow = false;
  const wash = new THREE.RectAreaLight(0xffb469, 0, W - 0.12, 0.05);
  wash.position.set(0, topY - 0.03, 0.47);
  wash.lookAt(0, 0, 0.47);
  model.add(wash);
  // soft light spill on the fronts (additive gradient card just in front of them)
  const spill = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.1, 0.22),
    new THREE.MeshBasicMaterial({
      map: canvasTex(8, 128, (g, w, h) => {
        const grd = g.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, 'rgba(255,180,105,1)'); grd.addColorStop(0.25, 'rgba(255,170,90,0.35)'); grd.addColorStop(1, 'rgba(255,160,80,0)');
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
      }),
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  spill.position.set(0, topY - 0.14, Dc / 2 + 0.024);
  model.add(spill);

  // Pendants (drop in for the last step)
  const pendants = new THREE.Group();
  model.add(pendants);
  const pendantLights = [];
  [-0.62, 0.62].forEach((x) => {
    const p = new THREE.Group();
    p.position.set(x, 1.78, 0);
    mesh(new THREE.CylinderGeometry(0.06, 0.15, 0.2, 40, 1, true), shadeMat, p, [0, 0, 0]).material.side = THREE.DoubleSide;
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(0.145, 40), bulbMat);
    bulb.rotation.x = Math.PI / 2; bulb.position.y = -0.099; p.add(bulb);
    mesh(new THREE.CylinderGeometry(0.003, 0.003, 3, 6), shadeMat, p, [0, 1.6, 0]).castShadow = false;
    const pl = new THREE.PointLight(0xffb469, 0, 2.4, 1.6);
    pl.position.y = -0.18; p.add(pl); pendantLights.push(pl);
    pendants.add(p);
  });
  pendants.position.y = 4.2;

  /* Exploded starting state */
  const drawersFrom = drawers.map((d, i) => ({ z: d.home.z + 0.55 + d.ri * 0.16, y: d.home.y + 0.18 + d.ri * 0.05, r: (d.ci - 1.5) * 0.12 }));
  drawers.forEach((d, i) => { d.g.position.z = drawersFrom[i].z; d.g.position.y = drawersFrom[i].y; d.g.rotation.y = drawersFrom[i].r; });
  worktop.position.y = 1.0;
  hob.position.y = 1.5;
  sink.position.y = 1.7;
  toe.position.y = -0.4;
  toe.scale.setScalar(0.001);

  /* Camera rig (spherical around a target) */
  const rig = { theta: 0.62, phi: 1.12, r: 7.6, ty: 1.0, ox: 0 };
  const target = new THREE.Vector3();
  let fit = 1;

  /* ---------- Scroll timeline ---------- */
  const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.inOut' } });
  // 1 · carcass  (0 → 2)
  tl.to(rig, { theta: 0.42, phi: 1.18, r: 7.0, ty: 0.85, duration: 2 }, 0)
    .to(toe.position, { y: kick / 2, duration: 1.2 }, 0.4)
    .to(toe.scale, { x: 1, y: 1, z: 1, duration: 1.2 }, 0.4);
  // 2 · fronts (2 → 4)
  drawers.forEach((d, i) => {
    tl.to(d.g.position, { z: d.home.z, y: d.home.y, duration: 1.4 }, 2 + i * 0.05)
      .to(d.g.rotation, { y: 0, duration: 1.4 }, 2 + i * 0.05);
  });
  tl.to(rig, { theta: 0.2, phi: 1.22, r: 6.4, ty: 0.6, duration: 2 }, 2);
  // 3 · worktop (4 → 6)
  tl.to(worktop.position, { y: 0, duration: 1.2, ease: 'power4.inOut' }, 4)
    .to(hob.position, { y: 0, duration: 1.1 }, 4.6)
    .to(sink.position, { y: 0, duration: 1.1 }, 4.75)
    .to(rig, { theta: 0.62, phi: 0.95, r: 6.2, ty: 0.55, duration: 2 }, 4);
  // 4 · drawers glide open (6 → 8)
  const openers = drawers; // every drawer opens — none left looking shut
  openers.forEach((d, i) => tl.to(d.g.position, { z: d.home.z + 0.24 + d.ri * 0.08, duration: 0.9, ease: 'power2.out' }, 6 + i * 0.06));
  tl.to(rig, { theta: -0.28, phi: 1.22, r: 5.8, ty: 0.5, duration: 2 }, 6);
  // 5 · the light (8 → 10)
  openers.forEach((d, i) => tl.to(d.g.position, { z: d.home.z, duration: 0.8, ease: 'power2.inOut' }, 8 + i * 0.04));
  tl.to(ledMat.color, { r: 1, g: 0.78, b: 0.5, duration: 0.6 }, 8.3)
    .to(wash, { intensity: 30, duration: 0.8 }, 8.3)
    .to(spill.material, { opacity: 0.9, duration: 0.8 }, 8.3)
    .to(ringMat.color, { r: 0.95, g: 0.35, b: 0.08, duration: 0.8, stagger: 0 }, 8.6)
    .to(pendants.position, { y: 0, duration: 1.3, ease: 'power3.out' }, 8.2)
    .to(bulbMat.color, { r: 1, g: 0.86, b: 0.66, duration: 0.6 }, 9)
    .to(pendantLights, { intensity: 2.2, duration: 0.6 }, 9)
    .to(key, { intensity: 1.4, duration: 1.6 }, 8.3)
    .to(rig, { theta: -0.68, phi: 1.12, r: 7.2, ty: 0.85, duration: 2 }, 8);

  /* Annotation anchors per step */
  const anchors = [
    { p: new THREE.Vector3(-W / 2 + 0.02, kick + carcH, Dc / 2), t: 'Stainless steel carcass' },
    { p: new THREE.Vector3(drawers[4].home.x, drawers[4].home.y, Dc / 2 + 0.03), t: 'Touch-open front' },
    { p: new THREE.Vector3(-0.1, topY + 0.02, 0.32), t: 'Quartz worktop' },
    { p: new THREE.Vector3(drawers[1].home.x + cw / 2 - 0.02, drawers[1].home.y, Dc / 2 + 0.32), t: 'Soft-close runners' },
    { p: new THREE.Vector3(0.3, topY - 0.03, 0.46), t: 'Integrated LED' },
  ];

  let step = -1;
  function setStep(i) {
    if (i === step) return;
    step = i;
    steps.forEach((li, j) => li.classList.toggle('is-active', j === i));
    stepNum.textContent = String(i + 1).padStart(2, '0');
    pinText.textContent = anchors[i].t;
    gsap.fromTo(pin, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)', overwrite: true });
  }
  setStep(0);

  ScrollTrigger.create({
    trigger: section,
    refreshPriority: 1,
    start: 'top top',
    end: () => '+=' + innerHeight * 4,
    pin: true,
    scrub: reduced ? false : 0.8,
    onUpdate(self) {
      const p = self.progress;
      const i = Math.min(4, Math.floor(p * 5));
      setStep(i);
      bar.style.transform = `scaleX(${p})`;
      if (reduced) tl.progress((i + 1) / 5);
      else tl.progress(p);
      invalidate();
    },
  });
  if (reduced) tl.progress(0.2);

  /* ---------- Finish switcher ---------- */
  const finishes = {
    steel: { c: 0xe2e5e7, m: 1, r: 0.4, cc: 0, map: brushTex },
    oak: { c: 0xffffff, m: 0, r: 0.55, cc: 0.25, map: woodTex },
    graphite: { c: 0x303432, m: 0.25, r: 0.36, cc: 0.7, map: null },
    sand: { c: 0xe4d7c1, m: 0, r: 0.42, cc: 0.45, map: null },
  };
  const buttons = [...section.querySelectorAll('[data-finish]')];
  buttons.forEach((b) =>
    b.addEventListener('click', () => {
      const f = finishes[b.dataset.finish];
      buttons.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      const col = new THREE.Color(f.c);
      const dur = reduced ? 0 : 0.7;
      gsap.to(frontMat.color, { r: col.r, g: col.g, b: col.b, duration: dur, onUpdate: invalidate });
      gsap.to(frontMat, { metalness: f.m, roughness: f.r, clearcoat: f.cc, duration: dur });
      gsap.delayedCall(dur / 2, () => {
        frontMat.map = f.map;
        frontMat.roughnessMap = f.map === brushTex ? brushTex : null;
        frontMat.needsUpdate = true;
      });
      if (!reduced)
        drawers.forEach((d, i) =>
          gsap.fromTo(d.front.rotation, { x: 0 }, { x: 0.35, duration: 0.25, yoyo: true, repeat: 1, ease: 'power2.inOut', delay: i * 0.03 })
        );
      invalidate(1.2);
    })
  );
  // Keyboard: arrow keys move between radio options
  section.querySelector('.finishes').addEventListener('keydown', (e) => {
    const i = buttons.findIndex((b) => b.getAttribute('aria-checked') === 'true');
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = buttons[(i + d + buttons.length) % buttons.length];
    n.focus(); n.click();
  });

  /* ---------- Pointer parallax ---------- */
  const tilt = { x: 0, y: 0 };
  const tx = gsap.quickTo(tilt, 'x', { duration: 1.2, ease: 'power3' });
  const ty = gsap.quickTo(tilt, 'y', { duration: 1.2, ease: 'power3' });
  if (!reduced && matchMedia('(pointer: fine)').matches) {
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      tx((e.clientX - r.left) / r.width - 0.5);
      ty((e.clientY - r.top) / r.height - 0.5);
      invalidate(1.3);
    });
  }

  /* ---------- Sizing ---------- */
  let w = 1, h = 1;
  function resize() {
    w = stage.clientWidth; h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const narrow = w < 900;
    fit = camera.aspect < 0.8 ? 1.75 : camera.aspect < 1.3 ? 1.3 : 1;
    // push the model right of the text panel on desktop, above the card on mobile
    camera.setViewOffset(w, h, narrow ? 0 : -w * 0.17, narrow ? h * 0.2 : 0, w, h);
    camera.updateProjectionMatrix();
    invalidate();
  }
  new ResizeObserver(resize).observe(stage);

  /* ---------- Render loop (only while visible / changing) ---------- */
  let visible = false;
  let until = 0;
  function invalidate(sec = 0.1) { until = Math.max(until, performance.now() + sec * 1000); }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; invalidate(); }).observe(section);

  const v = new THREE.Vector3();
  function render(time) {
    if (!visible) return;
    const idle = !reduced; // keep a gentle float alive while on screen
    if (!idle && performance.now() > until) return;

    model.rotation.y = tilt.x * 0.22;
    model.position.y = reduced ? 0 : Math.sin(time * 0.8) * 0.012;
    target.set(rig.ox, rig.ty, 0);
    const r = rig.r * fit;
    camera.position.set(
      target.x + r * Math.sin(rig.phi + tilt.y * 0.12) * Math.sin(rig.theta),
      target.y + r * Math.cos(rig.phi + tilt.y * 0.12),
      target.z + r * Math.sin(rig.phi + tilt.y * 0.12) * Math.cos(rig.theta)
    );
    camera.lookAt(target);
    renderer.render(scene, camera);

    // project the annotation dot
    model.updateMatrixWorld();
    v.copy(anchors[step].p).applyMatrix4(model.matrixWorld).project(camera);
    const px = Math.min((v.x * 0.5 + 0.5) * w - 6, w - pin.offsetWidth - 8);
    pin.style.transform = `translate(${Math.max(8, px)}px, ${(-v.y * 0.5 + 0.5) * h - 6}px)`;
  }
  gsap.ticker.add(render);
  resize();
  // compile shaders now, off the scroll path, instead of on the first visible frame
  if (renderer.compileAsync) renderer.compileAsync(scene, camera).then(() => renderer.render(scene, camera)).catch(() => {});
}
