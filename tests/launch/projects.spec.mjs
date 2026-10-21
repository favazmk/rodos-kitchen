// Projects: filter bar drives the 3D ring and the grid; ring caption, counts and grid must agree
import { open, hold, lightbox } from './lib/site.mjs';

function projectsInvariant() {
  const bad = [];
  const g = document.querySelector('[data-pgallery]');
  const on = [...g.querySelectorAll('[data-filter]')].filter((b) => b.getAttribute('aria-pressed') === 'true');
  if (on.length !== 1 || !on[0].classList.contains('is-on')) bad.push({ filters: 'pressed state', pressed: on.map((b) => b.dataset.filter) });
  const f = on[0]?.dataset.filter || 'all';
  const cells = [...g.querySelectorAll('.pcell')];
  const shown = cells.filter((c) => c.style.display !== 'none');
  const wrong = shown.filter((c) => f !== 'all' && c.dataset.cat !== f).length;
  const sup = +on[0]?.querySelector('sup')?.textContent;
  const gc = g.querySelector('[data-grid-count]')?.textContent.trim();
  if (wrong || shown.length !== sup || gc !== `${shown.length} photos`) bad.push({ grid: 'counts disagree', filter: f, shown: shown.length, sup, gc, wrong });
  const stage = g.querySelector('[data-ring]');
  const r = stage.getBoundingClientRect();
  if (!g.classList.contains('is-grid') && r.bottom > 0 && r.top < innerHeight) {
    const num = +g.querySelector('[data-ring-num]').textContent;
    const title = g.querySelector('[data-ring-title]').textContent.trim();
    const count = g.querySelector('[data-ring-count]').textContent.trim();
    const cell = cells[num - 1];
    const cap = cell?.querySelector('.shot__cap')?.textContent.trim();
    if (!title || title !== cap || (f !== 'all' && cell.dataset.cat !== f) || !count.endsWith('/ ' + String(shown.length).padStart(2, '0')))
      bad.push({ ring: 'caption disagrees', filter: f, num, title, cap, cat: cell?.dataset.cat, count });
  }
  return bad.length ? { y: Math.round(scrollY), bad } : true;
}

export default async function (api) {
  const { settle, randomWalk, check, shot } = api;
  for (const device of ['desktop', 'phone']) {
    const { ctx, page, log } = await open(api, device, 'projects.html');
    const ringOn = await page.evaluate(() => !document.documentElement.classList.contains('no-ring'));
    if (!ringOn) api.warn(`${device} ring`, 'ring did not start (no WebGL?) — grid only');
    await page.evaluate(() => document.querySelector('[data-filters]').scrollIntoView({ block: 'start' }));
    await settle(page, 2500);
    await hold(api, page, `${device} gallery in view`, projectsInvariant);

    for (const f of ['full', 'islands', 'steel', 'details', 'all']) {
      await page.click(`[data-filter="${f}"]`); await settle(page, 2600);
      await hold(api, page, `${device} filter ${f}`, projectsInvariant);
      if (ringOn && f !== 'all') {
        await page.click('[data-pgallery] [data-ring-next]'); await settle(page, 1800);
        await hold(api, page, `${device} filter ${f} then next`, projectsInvariant);
      }
    }

    // keyboard: filters are buttons, Enter activates
    if (device === 'desktop') {
      await page.focus('[data-filter="steel"]'); await page.keyboard.press('Enter'); await settle(page, 2600);
      await hold(api, page, 'desktop filter by keyboard', projectsInvariant);
      await page.click('[data-filter="all"]'); await settle(page, 2000);
    }

    // grid photo opens the lightbox with its own image
    const cell = page.locator('[data-pgrid] .pcell').nth(3);
    await cell.scrollIntoViewIfNeeded(); await settle(page, 1800);
    const src = await cell.getAttribute('data-full');
    await lightbox(api, page, device, 'grid photo', () => cell.click(), src);

    // reload after filtering — state resets cleanly
    await page.click('[data-filter="islands"]').catch(() => {});
    await settle(page, 1500);
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 3500);
    await hold(api, page, `${device} reload after filtering`, projectsInvariant);

    for (const seed of [5, 23]) {
      await page.goto(api.baseURL + 'projects.html', { waitUntil: 'networkidle' }); await settle(page, 3000);
      await page.evaluate(() => document.querySelector('[data-filters]').scrollIntoView({ block: 'start' }));
      await settle(page, 1500);
      const bad = await randomWalk(page, device, {
        invariant: (p) => p.evaluate(projectsInvariant), seed, moves: 14,
        clicks: ['[data-filter="all"]', '[data-filter="full"]', '[data-filter="steel"]', '[data-filter="details"]', '[data-pgallery] [data-ring-next]', '[data-pgallery] [data-ring-prev]'],
        onBad: (p, m) => shot(p, `projects-walk-${device}-${seed}-${m}`),
      });
      check(`${device} random walk seed ${seed}`, bad.length === 0, bad.slice(0, 3));
    }
    check(`${device} no runtime errors`, log.errors.length === 0, log.errors);
    await ctx.close();
  }
}
