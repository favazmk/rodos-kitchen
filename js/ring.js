/* RODOS — projects shown on a tilted 3D ring you can drag, scroll and click */
import * as THREE from 'three';

const VERT = /* glsl */ `
  uniform float uVel;
  uniform float uHover;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    // cards flex like thin steel sheets when the ring moves fast
    p.y += sin(uv.x * 3.14159) * uVel * 0.22;
    p += normal * uHover * 0.14;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uImgAspect;
  uniform float uPlaneAspect;
  uniform float uLoaded;
  uniform float uDim;
  uniform float uHover;
  uniform float uVel;
  varying vec2 vUv;

  float roundedBox(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    // rounded corners
    vec2 pp = (vUv - 0.5) * vec2(uPlaneAspect, 1.0);
    if (roundedBox(pp, vec2(uPlaneAspect, 1.0) * 0.5, 0.045) > 0.0) discard;

    // object-fit: cover
    vec2 uv = vUv;
    float r = uPlaneAspect / uImgAspect;
    if (r < 1.0) uv.x = (uv.x - 0.5) * r + 0.5;
    else uv.y = (uv.y - 0.5) / r + 0.5;
    uv = (uv - 0.5) * (1.0 - uHover * 0.08) + 0.5;

    // chromatic split with speed
    float s = uVel * 0.014;
    vec3 c = vec3(
      texture2D(uMap, uv + vec2(s, 0.0)).r,
      texture2D(uMap, uv).g,
      texture2D(uMap, uv - vec2(s, 0.0)).b
    );
    c = mix(vec3(0.08, 0.1, 0.075), c, uLoaded);

    if (!gl_FrontFacing) c *= 0.22;            // back of the ring reads as depth
    float g = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(c, vec3(g), uDim) * (1.0 - uDim * 0.65);
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

const CAT = { full: 'Full kitchen', islands: 'Island & bar', steel: 'All-steel', details: 'Detail' };
const TAU = Math.PI * 2;
const wrap = (a) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

export function initRing(section, { gsap, ScrollTrigger }) {
  const stage = section.querySelector('[data-ring]');
  const canvas = stage.querySelector('canvas');
  const $ = (s) => stage.querySelector(s);
  const ui = { num: $('[data-ring-num]'), title: $('[data-ring-title]'), cat: $('[data-ring-cat]'), count: $('[data-ring-count]') };

  const cells = [...section.querySelectorAll('.pcell')];
  const items = cells.map((cell, i) => ({
    cell, i,
    src: cell.dataset.full,
    cat: cell.dataset.cat,
    title: cell.querySelector('.shot__cap').textContent.trim(),
  }));
  const N = items.length;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const ring = new THREE.Group();
  ring.rotation.z = -0.035;
  scene.add(ring);

  // card = a slice of a cylinder, so every photo is curved like the ring
  const W = 1.6, H = 1.2;
  const R = (N * W) / (TAU * 0.86);
  const geo = new THREE.CylinderGeometry(R, R, H, 40, 1, true, -W / R / 2, W / R);
  const loader = new THREE.TextureLoader();

  items.forEach((it) => {
    const uniforms = {
      uMap: { value: null }, uImgAspect: { value: 4 / 3 }, uPlaneAspect: { value: W / H },
      uLoaded: { value: 0 }, uDim: { value: 0 }, uHover: { value: 0 }, uVel: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.item = it;
    const pivot = new THREE.Group();
    pivot.add(mesh);
    ring.add(pivot);
    Object.assign(it, { mesh, pivot, uniforms });
    loader.load(it.src, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      uniforms.uMap.value = t;
      uniforms.uImgAspect.value = t.image.width / t.image.height;
      gsap.to(uniforms.uLoaded, { value: 1, duration: 1.2, ease: 'power2.out' });
    });
  });

  /* ---------- Layout (re-spaces the ring when a filter is applied) ---------- */
  let visible = items;
  let step = TAU / N;
  const view = { dist: R + 7, radius: R };
  function layout(filter, animate = true) {
    visible = items.filter((it) => filter === 'all' || it.cat === filter);
    const M = visible.length;
    step = TAU / M;
    const R2 = Math.max((M * W) / (TAU * 0.86), 2.3);
    const d = animate ? 1.1 : 0;
    gsap.to(view, { radius: R2, dist: R2 + 7, duration: d, ease: 'expo.inOut' });
    items.forEach((it) => {
      const k = visible.indexOf(it);
      const on = k >= 0;
      if (on) gsap.to(it.pivot.rotation, { y: k * step, duration: d, ease: 'expo.inOut', delay: animate ? k * 0.02 : 0 });
      gsap.to(it.mesh.position, { z: R2 - R, duration: d, ease: 'expo.inOut' });
      gsap.to(it.mesh.scale, { x: on ? 1 : 0.001, y: on ? 1 : 0.001, z: on ? 1 : 0.001, duration: d * 0.8, ease: on ? 'expo.out' : 'expo.in' });
      gsap.to(it.uniforms.uDim, { value: on ? 0 : 1, duration: d });
    });
    target = 0; scrollOffset = 0; scrollBase = st ? st.progress : 0;
    front = -1;
  }

  /* ---------- Motion state ---------- */
  let target = 0, current = 0, scrollOffset = 0, scrollBase = 0;
  let dragging = false, lastX = 0, moved = 0, flick = 0;
  let hovered = null, front = -1;

  const snap = () => { const goal = target + scrollOffset; target = Math.round(goal / step) * step - scrollOffset; };

  // page scroll keeps the ring turning slowly in the scroll's direction; a faster scroll nudges it a little faster
  let dir = 1, boost = 0;
  const st = ScrollTrigger.create({
    trigger: stage, start: 'top bottom', end: 'bottom top',
    onUpdate: (s) => {
      dir = s.direction;
      boost = Math.min(Math.abs(s.getVelocity()) / 2500, 1);
    },
  });

  /* ---------- Pointer: drag to turn, click to open ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(visible.map((v) => v.mesh))[0];
    return hit && hit.face && hit.face.normal ? hit.object.userData.item : null;
  }
  function setHover(it) {
    if (it === hovered) return;
    if (hovered) gsap.to(hovered.uniforms.uHover, { value: 0, duration: 0.5, ease: 'power3.out' });
    hovered = it;
    if (it) gsap.to(it.uniforms.uHover, { value: 1, duration: 0.6, ease: 'power3.out' });
    canvas.style.cursor = dragging ? 'grabbing' : it ? 'pointer' : 'grab';
  }
  const open = (it) => it && it.cell.click();

  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0; flick = 0; lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragging) {
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      moved += Math.abs(dx);
      flick = dx;
      target -= dx * 0.0055;
    } else if (e.pointerType === 'mouse') setHover(pick(e));
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    if (moved < 6) open(pick(e));
    else { target -= flick * 0.04; snap(); }
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', () => { dragging = false; snap(); });
  canvas.addEventListener('pointerleave', () => !dragging && setHover(null));

  const go = (d) => { snap(); target += d * step; };
  $('[data-ring-prev]').addEventListener('click', () => go(-1));
  $('[data-ring-next]').addEventListener('click', () => go(1));
  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(visible[front]); }
  });

  /* Filters + view toggle come from the page */
  section.addEventListener('rodos:filter', (e) => layout(e.detail));

  /* ---------- Caption for the photo at the front ---------- */
  function setFront(k) {
    if (k === front) return;
    front = k;
    const it = visible[k];
    if (!it) return;
    const pad = (n) => String(n).padStart(2, '0');
    gsap.to([ui.num, ui.title, ui.cat], {
      yPercent: -60, opacity: 0, duration: 0.18, ease: 'power2.in', stagger: 0.03, overwrite: true,
      onComplete: () => {
        ui.num.textContent = pad(it.i + 1);
        ui.title.textContent = it.title;
        ui.cat.textContent = CAT[it.cat] || '';
        ui.count.textContent = `${pad(k + 1)} / ${pad(visible.length)}`;
        gsap.fromTo([ui.num, ui.title, ui.cat], { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'expo.out', stagger: 0.04 });
      },
    });
  }

  /* ---------- Size + render ---------- */
  let w = 1, h = 1, fit = 1;
  function resize() {
    w = stage.clientWidth; h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    fit = camera.aspect < 0.8 ? 1.15 : 1;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  let onScreen = false;
  new IntersectionObserver(([e]) => (onScreen = e.isIntersecting)).observe(stage);

  gsap.ticker.add((time) => {
    if (!onScreen || section.classList.contains('is-grid')) return;
    // slow drift, paused while a card is hovered or dragged so it stays easy to pick
    if (!dragging && !hovered) target += dir * (0.0011 + boost * 0.009) * gsap.ticker.deltaRatio();
    boost *= 0.94;
    const goal = target + scrollOffset;
    const prev = current;
    current += (goal - current) * 0.075;
    const vel = gsap.utils.clamp(-1, 1, (current - prev) * 14);
    ring.rotation.y = -current;
    ring.position.y = Math.sin(time * 0.6) * 0.03;

    // aim at the front of the ring so the nearest photos sit mid-frame, the far side above
    camera.position.set(0, 1.35, view.dist * fit);
    camera.lookAt(0, -0.42, view.radius * 0.62);

    // which card is at the front?
    let best = 0, bestA = Infinity;
    visible.forEach((it, k) => {
      it.uniforms.uVel.value += (vel - it.uniforms.uVel.value) * 0.2;
      const a = Math.abs(wrap(it.pivot.rotation.y - current));
      if (a < bestA) { bestA = a; best = k; }
    });
    setFront(best);
    renderer.render(scene, camera);
  });

  layout('all', false);
  ScrollTrigger.refresh();
}
