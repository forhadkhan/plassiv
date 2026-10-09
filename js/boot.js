/* Loads the page's modules in order of need, so the first paint (CSS, hero photo, fonts) gets the bandwidth first.
     data-now    shows or drives the page: starts at once, in parallel
     data-later  enhancements: one after another, each when the browser is idle, once the page has loaded
   The now-modules (and the ones they share) are hinted together first, so that graph comes down in one round trip
   instead of one per import level. The later ones are not hinted: they would only compete with the page for bandwidth. */

const me = [...document.scripts].find((s) => s.src === import.meta.url);
const list = (name) => (me.dataset[name] ?? '').split(' ').filter(Boolean);
const now = list('now'), later = list('later');
const SHARED = ['ui.js', 'store.js', 'silk.js'];

const loading = {};
const load = (mod) => loading[mod] ??= import(`./${mod}`)
  .catch(() => new Promise((r) => setTimeout(r, 2000)).then(() => import(`./${mod}?retry`)));

for (const mod of new Set([...now, ...SHARED])) {
  const link = document.createElement('link');
  link.rel = 'modulepreload';
  link.href = new URL(mod, import.meta.url).href;
  document.head.append(link);
}
now.forEach((mod) => load(mod).catch(() => {}));

/* a tap on search or sign-in before their module has arrived loads it, then repeats the tap */
const OPENERS = { '[data-search-open]': 'search.js', '[data-login-open]': 'login.js' };
const ready = new Set();
document.addEventListener('click', (e) => {
  for (const [selector, mod] of Object.entries(OPENERS)) {
    const button = e.target.closest(selector);
    if (!button || ready.has(mod) || !later.includes(mod)) continue;
    e.preventDefault();
    load(mod).then(() => { ready.add(mod); button.click(); }, () => {});
  }
});

const idle = () => new Promise((r) => ('requestIdleCallback' in window ? requestIdleCallback(r, { timeout: 1000 }) : setTimeout(r, 50)));
const loaded = new Promise((r) => {
  if (document.readyState === 'complete') r();
  else { addEventListener('load', r, { once: true }); setTimeout(r, 12000); }   // a stuck image must not hold the rest back for ever
});

loaded.then(async () => {
  for (const mod of later) {
    await idle();
    await load(mod).then(() => ready.add(mod), () => {});
  }
});
