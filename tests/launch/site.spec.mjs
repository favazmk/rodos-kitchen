// Site-wide: mobile menu, page-transition curtain, contact form → WhatsApp, about process line
import { open, hold } from './lib/site.mjs';

// hit-test, not pointer-events: a fully clipped curtain lets clicks through even while pointer-events is auto
const curtainClear = () => {
  const l = document.querySelector('.loader');
  const hits = [[0.5, 0.5], [0.1, 0.9], [0.9, 0.1]].filter(([x, y]) => l?.contains(document.elementFromPoint(innerWidth * x, innerHeight * y)));
  return hits.length ? { curtain: 'still blocking clicks', at: hits, clip: getComputedStyle(l).clipPath } : true;
};

// process steps light up once their top passes 65% of the screen, and only then
function processInvariant() {
  const items = [...document.querySelectorAll('[data-process] li')];
  const wrong = items.map((li, i) => {
    const passed = li.getBoundingClientRect().top <= innerHeight * 0.65;
    const on = li.classList.contains('is-on');
    return Math.abs(li.getBoundingClientRect().top - innerHeight * 0.65) > 20 && passed !== on ? { i, passed, on } : null;
  }).filter(Boolean);
  return wrong.length ? { y: Math.round(scrollY), wrong } : true;
}

export default async function (api) {
  const { settle, scrollToY, check, randomWalk, shot } = api;

  // mobile menu on every page
  for (const file of ['', 'kitchens.html', 'projects.html', 'about.html', 'contact.html']) {
    const { ctx, page, log } = await open(api, 'phone', file);
    const name = file || 'home';
    await page.click('.nav__burger'); await settle(page, 1000);
    const o = await page.evaluate(() => ({ exp: document.querySelector('.nav__burger').getAttribute('aria-expanded'), hidden: document.querySelector('#menu').hidden, cls: document.body.classList.contains('menu-open'), links: [...document.querySelectorAll('#menu nav a')].filter((a) => +getComputedStyle(a).opacity > 0.9).length }));
    check(`phone ${name} menu opens`, o.exp === 'true' && !o.hidden && o.cls && o.links >= 4, o);
    await page.keyboard.press('Escape'); await settle(page, 900);
    const c = await page.evaluate(() => ({ exp: document.querySelector('.nav__burger').getAttribute('aria-expanded'), hidden: document.querySelector('#menu').hidden, cls: document.body.classList.contains('menu-open') }));
    check(`phone ${name} menu closes on Escape`, c.exp === 'false' && c.hidden && !c.cls, c);
    await page.evaluate(() => window.scrollBy(0, 500)); await settle(page, 800);
    check(`phone ${name} page scrolls after menu closes`, (await page.evaluate(() => scrollY)) > 300);
    // menu link navigates (behind the curtain) and the next page uncovers
    await page.evaluate(() => window.scrollTo(0, 0)); await settle(page, 600);
    await page.click('.nav__burger'); await settle(page, 1000);
    const target = file === 'contact.html' ? 'about.html' : 'contact.html';
    await Promise.all([page.waitForURL(`**/${target}`, { timeout: 8000 }).catch(() => {}), page.click(`#menu nav a[href="${target}"]`)]);
    await settle(page, 2500);
    check(`phone ${name} menu link goes to ${target}`, page.url().endsWith(target), page.url());
    await hold(api, page, `phone ${name} → ${target} curtain clears`, curtainClear);
    check(`phone ${name} no runtime errors`, log.errors.length === 0, log.errors);
    await ctx.close();
  }

  // desktop page-to-page: curtain covers, next page uncovers; Back restores an uncovered page
  {
    const { ctx, page, log } = await open(api, 'desktop', '');
    await Promise.all([page.waitForURL('**/projects.html', { timeout: 8000 }).catch(() => {}), page.click('.nav a[href="projects.html"]')]);
    await settle(page, 2500);
    check('desktop nav link reaches projects', page.url().endsWith('projects.html'), page.url());
    await hold(api, page, 'desktop next page uncovers', curtainClear);
    await page.goBack({ waitUntil: 'networkidle' }); await settle(page, 2500);
    await hold(api, page, 'desktop Back shows an uncovered page', curtainClear);
    check('desktop no runtime errors (navigation)', log.errors.length === 0, log.errors);
    await ctx.close();
  }

  // contact form → WhatsApp (window.open stubbed: nothing is sent)
  for (const device of ['desktop', 'phone']) {
    const { ctx, page, log } = await open(api, device, 'contact.html');
    await page.evaluate(() => { window.__opened = []; window.open = (...a) => { window.__opened.push(a); return null; }; });
    const form = page.locator('[data-form]');
    await form.scrollIntoViewIfNeeded(); await settle(page, 1200);
    const submit = () => page.evaluate(() => document.querySelector('[data-form]').requestSubmit());

    await submit(); await settle(page, 500);
    let s = await page.evaluate(() => ({ opened: window.__opened.length, name: document.querySelector('#f-name').getAttribute('aria-invalid'), status: document.querySelector('.form__status').textContent, focus: document.activeElement?.id }));
    check(`${device} empty form is blocked`, s.opened === 0 && s.name === 'true' && /name/i.test(s.status) && s.focus === 'f-name', s);

    await page.fill('#f-name', 'Test Visitor');
    await page.fill('#f-phone', 'abc');
    await submit(); await settle(page, 500);
    s = await page.evaluate(() => ({ opened: window.__opened.length, phone: document.querySelector('#f-phone').getAttribute('aria-invalid'), focus: document.activeElement?.id }));
    check(`${device} bad phone is blocked`, s.opened === 0 && s.phone === 'true' && s.focus === 'f-phone', s);

    await page.fill('#f-phone', '+971 50 123 4567');
    await page.check('input[name="home"][value="Apartment"]', { force: true });
    const area = await page.$eval('#f-area', (el) => el.options[1]?.value || el.value);
    await page.selectOption('#f-area', area);
    await page.fill('#f-msg', 'Island with a steel worktop');
    await submit(); await settle(page, 500);
    s = await page.evaluate(() => ({ opened: window.__opened, status: document.querySelector('.form__status').textContent }));
    const url = s.opened[0]?.[0] || '';
    const text = decodeURIComponent(url.split('text=')[1] || '');
    check(`${device} valid form opens one WhatsApp chat`, s.opened.length === 1 && url.startsWith('https://wa.me/971559497047?text=') && s.opened[0][1] === '_blank', s.opened);
    check(`${device} WhatsApp message carries every field`,
      ['Name: Test Visitor', 'Phone: +971 50 123 4567', 'Home: Apartment', `Location: ${area}`, 'Notes: Island with a steel worktop'].every((l) => text.includes(l)), text);
    check(`${device} form confirms to the visitor`, /WhatsApp/.test(s.status), s.status);
    check(`${device} contact no runtime errors`, log.errors.length === 0, log.errors);
    await ctx.close();
  }

  // about: process line
  for (const device of ['desktop', 'phone']) {
    const { ctx, page } = await open(api, device, 'about.html');
    const top = await page.evaluate(() => document.querySelector('[data-process]').getBoundingClientRect().top + scrollY);
    for (const dy of [-400, 0, 300, 700, 1200]) {
      await scrollToY(page, device, Math.max(0, Math.round(top + dy - 400))); await settle(page, 1800);
      await hold(api, page, `${device} about process at ${dy}`, processInvariant);
    }
    await page.reload({ waitUntil: 'networkidle' }); await settle(page, 3500);
    await hold(api, page, `${device} about process after reload`, processInvariant);
    await scrollToY(page, device, 0); await settle(page, 2000);
    await hold(api, page, `${device} about process reload then top`, processInvariant);
    const bad = await randomWalk(page, device, { invariant: (p) => p.evaluate(processInvariant), seed: 13, moves: 12, onBad: (p, m) => shot(p, `about-walk-${device}-${m}`) });
    check(`${device} about random walk`, bad.length === 0, bad.slice(0, 3));
    await ctx.close();
  }
}
