/* Search: a full-screen sheet that filters the catalogue as you type. Text goes in through text nodes, never as HTML. */
import { ready, allProducts, money } from './store.js';
import { $, el, icon } from './ui.js';

const dialog = $('#search-dialog');
const form = $('[data-search-form]', dialog);
const input = $('#search-input', dialog);
const out = $('#search-results', dialog);
const status = $('#search-status', dialog);
const openers = [...document.querySelectorAll('[data-search-open]')];
let catalogue = null;   // null until the catalogue has loaded, false if it failed

/* every word must match somewhere; a name hit counts most. "jackets" also finds "Jacket". */
const stem = (w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
function search(query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean).map(stem);
  if (!words.length) return [];
  return catalogue
    .map((p) => {
      const fields = [
        [p.name, 4], [p.category, 3], [p.colors.map((c) => c.name).join(' '), 2],
        [p.fits?.join(' ') ?? '', 1], [`${p.sku} ${p.description} ${p.details.join(' ')}`, 1],
      ].map(([text, w]) => [text.toLowerCase(), w]);
      let score = 0;
      for (const w of words) {
        const hit = Math.max(0, ...fields.map(([text, weight]) => (text.includes(w) ? weight : 0)));
        if (!hit) return null;
        score += hit;
      }
      return { p, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.p);
}

const chip = (label) => el('button', {
  type: 'button', text: label,
  class: 'border border-[#e9cf9c]/30 px-4 py-2 text-xs font-medium uppercase tracking-[.18em] transition hover:border-white hover:bg-white hover:text-black',
  onclick: () => { input.value = label; render(); input.focus(); },
});
const chips = () => {
  const cats = [...new Set(catalogue.map((p) => p.category))];
  return el('div', { class: 'mt-4 flex flex-wrap gap-2.5' }, cats.map(chip));
};

const result = (p) => el('li', {},
  el('a', { href: `product.html?p=${encodeURIComponent(p.id)}`, class: 'group flex items-center gap-4 p-2.5 transition hover:bg-white/10 focus-visible:bg-white/10' },
    el('img', { src: p.thumb, width: p.width, height: p.height, alt: '', loading: 'lazy', class: 'size-20 shrink-0 bg-white/10 object-cover lg:size-24' }),
    el('span', { class: 'min-w-0 flex-1' },
      el('span', { class: 'block text-xs font-semibold uppercase tracking-wider text-white/60', text: p.category }),
      el('span', { class: 'mt-1 block truncate font-serif text-2xl font-medium leading-tight lg:text-[1.75rem]', text: p.name }),
      el('span', { class: 'mt-0.5 block text-base text-white/80', text: money(p.priceCents) })),
    icon('i-chevron-right', 'icon shrink-0 text-white/50 transition group-hover:translate-x-0.5 group-hover:text-white')));

function render() {
  const q = input.value.trim();
  out.replaceChildren();
  if (catalogue === false) {
    out.append(el('p', { class: 'text-white/70', role: 'alert', text: 'We could not load the shop right now. Check your connection and try again.' }));
    return;
  }
  if (!catalogue) { status.textContent = 'Loading'; return; }
  if (!q) {
    status.textContent = '';
    out.append(el('p', { class: 'text-sm font-semibold uppercase tracking-wider text-white/60', text: 'Browse' }), chips());
    return;
  }
  const found = search(q);
  status.textContent = found.length ? `${found.length} ${found.length === 1 ? 'result' : 'results'}` : `No results for ${q}`;
  if (!found.length) {
    out.append(el('p', { class: 'font-serif text-3xl font-medium', text: `No results for “${q}”` }),
      el('p', { class: 'mt-2 text-white/70', text: 'Check the spelling or try one of these.' }), chips());
    return;
  }
  out.append(
    el('p', { class: 'text-sm font-semibold uppercase tracking-wider text-white/60', text: `${found.length} ${found.length === 1 ? 'result' : 'results'}` }),
    el('ul', { class: 'mt-3 grid gap-x-8 gap-y-1 lg:grid-cols-2', 'aria-label': 'Search results' }, found.map(result)));
}

function open() {
  if (dialog.open) return;
  document.documentElement.style.overflow = 'hidden';
  dialog.showModal();
  render();
  input.focus();
  input.select();
  ready.then(() => { catalogue = allProducts(); render(); }, () => { catalogue = false; render(); });
}
const close = () => dialog.close();
dialog.addEventListener('close', () => { document.documentElement.style.overflow = ''; });

openers.forEach((b) => b.addEventListener('click', open));
$('[data-search-close]', dialog).addEventListener('click', close);
input.addEventListener('input', render);

/* Enter opens the best match; arrow keys walk the results */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const first = $('ul a', out);
  if (first) first.click();
});
dialog.addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const links = [...out.querySelectorAll('ul a')];
  if (!links.length) return;
  const i = links.indexOf(document.activeElement);
  const next = e.key === 'ArrowDown' ? links[i + 1] ?? links[0] : i <= 0 ? input : links[i - 1];
  e.preventDefault();
  next.focus();
});
