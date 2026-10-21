// Shared helpers for the launch-check specs (lives in a subfolder so the runner doesn't run it as a spec)

// Fresh page: first visit plays the full curtain intro (~2.5s), so wait it out
export async function open(api, device, file, ctxOpts) {
  let ctx, page, log;
  if (ctxOpts) {
    ctx = await api.browser.newContext({ ...api.devices[device], ...ctxOpts, reducedMotion: 'no-preference' });
    page = await ctx.newPage();
    log = { errors: [] };
    page.on('pageerror', (e) => log.errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && log.errors.push(`console: ${m.text().slice(0, 300)}`));
  } else ({ ctx, page, log } = await api.newPage(device));
  await page.goto(api.baseURL + file, { waitUntil: 'networkidle' });
  await api.settle(page, 4000);
  return { ctx, page, log };
}

// Scroll range of the pinned ScrollTrigger whose trigger (or pin) matches the selector
export const pinRange = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const st = window.ScrollTrigger.getAll().find((t) => (t.trigger === el || t.pin === el) && t.pin);
    return st ? { start: Math.round(st.start), end: Math.round(st.end) } : null;
  }, sel);

// Runs an invariant and records it; returns true when it held
export async function hold(api, page, name, inv) {
  const res = await page.evaluate(inv);
  api.check(name, res === true, res);
  if (res !== true) await api.shot(page, name).catch(() => {});
  return res === true;
}

// Lightbox: open via `click`, check the image, close with Escape, page scroll works again
export async function lightbox(api, page, device, name, click, expectSrc) {
  await click();
  await api.settle(page, 1200);
  const st = await page.evaluate(() => {
    const d = document.querySelector('[data-lightbox]');
    return { open: d.open, src: d.querySelector('img').getAttribute('src'), alt: d.querySelector('img').alt };
  });
  const srcOk = typeof expectSrc === 'function' ? expectSrc(st.src) : st.src === expectSrc;
  api.check(`${device} ${name}: lightbox opens with the right photo`, st.open && srcOk && !!st.alt, st);
  await page.keyboard.press('Escape');
  await api.settle(page, 800);
  const y0 = await page.evaluate(() => scrollY);
  if (device === 'phone') await page.evaluate(() => window.scrollBy(0, 300));
  else { await page.mouse.move(400, 400); await page.mouse.wheel(0, 300); }
  await api.settle(page, 1200);
  const after = await page.evaluate(() => ({ open: document.querySelector('[data-lightbox]').open, y: scrollY }));
  api.check(`${device} ${name}: lightbox closes on Escape and the page scrolls again`, !after.open && after.y > y0 + 50, { y0, ...after });
}
