/* Product details page: product.html?p=<id> */
import { ready, getProduct, allProducts, addItem, money, MAX_QTY } from './store.js';
import { $, el, icon, optionText } from './ui.js';
import { openCart } from './cart-drawer.js';

const HEX = /^#[0-9a-f]{6}$/i;
const pill = 'grid h-11 min-w-12 cursor-pointer place-items-center rounded-full border border-ink/50 px-4 text-sm font-medium transition hover:border-ink peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink peer-disabled:cursor-not-allowed peer-disabled:border-line peer-disabled:text-muted peer-disabled:line-through';

const radio = (name, value, label, { checked = false, disabled = false, extra = '' } = {}) =>
  el('label', { class: 'relative' },
    el('input', { type: 'radio', name, value, checked, disabled, class: 'peer sr-only' }),
    el('span', { class: pill, 'aria-hidden': 'true' }, label),
    el('span', { class: 'sr-only' }, `${label}${extra}`));

function swatch(c, checked) {
  const dot = el('span', { class: 'block size-9 cursor-pointer rounded-full border border-ink/20 ring-ink ring-offset-2 transition peer-checked:ring-2 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[5px] peer-focus-visible:outline-brand', 'aria-hidden': 'true' });
  if (HEX.test(c.hex)) dot.style.backgroundColor = c.hex;
  return el('label', { class: 'relative', title: c.name },
    el('input', { type: 'radio', name: 'color', value: c.name, checked, class: 'peer sr-only' }),
    dot,
    el('span', { class: 'sr-only' }, c.name));
}

function relatedCard(p) {
  return el('li', {},
    el('article', { class: 'group relative' },
      el('div', { class: 'overflow-hidden rounded-2xl' },
        el('img', { src: p.image, alt: p.alt, width: String(p.width), height: String(p.height), loading: 'lazy', class: 'aspect-[3/4] w-full object-cover transition duration-700 group-hover:scale-105' })),
      el('h3', { class: 'mt-3 text-[0.8125rem] text-muted' },
        el('a', { href: `product.html?p=${encodeURIComponent(p.id)}`, class: 'after:absolute after:inset-0 after:rounded-2xl hover:text-ink' }, p.name)),
      el('p', { class: 'mt-1 text-base font-bold' }, money(p.priceCents))));
}

function showMissing() {
  document.title = 'Product not found — Plassiv';
  $('[data-pdp-missing]').classList.remove('hidden');
}

function render(p) {
  document.title = `${p.name} — Plassiv`;
  $('meta[name="description"]').setAttribute('content', p.description);

  const cat = $('[data-crumb-cat]');
  $('span', cat).textContent = p.category;
  $('span', $('[data-crumb-name]')).textContent = p.name;
  for (const li of [cat, $('[data-crumb-name]')]) li.classList.replace('hidden', 'flex');

  const img = $('[data-pdp-img]');
  Object.assign(img, { src: p.image, alt: p.alt, width: p.width, height: p.height });
  $('[data-pdp-cat]').textContent = p.category;
  $('#pdp-name').textContent = p.name;
  $('[data-pdp-price]').textContent = money(p.priceCents);
  $('[data-pdp-desc]').textContent = p.description;
  $('[data-pdp-sku]').textContent = p.sku;
  $('[data-pdp-details]').replaceChildren(...p.details.map((d) =>
    el('li', { class: 'flex gap-2.5' }, icon('i-check', 'icon mt-0.5 size-4 text-brand'), d)));

  $('[data-colors]').replaceChildren(...p.colors.map((c, i) => swatch(c, i === 0)));
  $('[data-color-name]').textContent = p.colors[0].name;
  $('[data-sizes]').replaceChildren(...p.sizes.map((s) => {
    const out = p.soldOut.includes(s);
    return radio('size', s, s, { disabled: out, extra: out ? ', sold out' : '' });
  }));
  if (p.fits.length) {
    $('[data-fits]').replaceChildren(...p.fits.map((f, i) => radio('fit', f, f, { checked: i === 0 })));
    $('[data-fit-group]').classList.remove('hidden');
  }

  $('[data-related-list]').replaceChildren(...allProducts().filter((o) => o.id !== p.id).map(relatedCard));
  $('[data-related]').classList.remove('hidden');
  $('[data-pdp]').classList.replace('hidden', 'grid');
}

function wire(p) {
  const form = $('[data-pdp-form]');
  const sizeError = $('#size-error');
  const status = $('[data-pdp-status]');
  const qty = $('#qty');
  const [dec, inc] = form.querySelectorAll('[data-qty-step]');

  const clampQty = () => {
    const n = Math.min(MAX_QTY, Math.max(1, Math.floor(Number(qty.value)) || 1));
    qty.value = String(n);
    dec.disabled = n <= 1;
    inc.disabled = n >= MAX_QTY;
    return n;
  };
  for (const b of [dec, inc]) b.addEventListener('click', () => { qty.value = String(Number(qty.value) + Number(b.dataset.qtyStep)); clampQty(); });
  qty.addEventListener('change', clampQty);
  clampQty();

  form.addEventListener('change', (e) => {
    if (e.target.name === 'color') $('[data-color-name]').textContent = e.target.value;
    if (e.target.name === 'size') sizeError.replaceChildren();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const size = data.get('size');
    if (!size) {
      sizeError.replaceChildren(icon('i-circle-alert', 'icon size-4'), 'Please choose a size before adding to cart.');
      form.querySelector('input[name="size"]:not(:disabled)')?.focus();
      return;
    }
    const item = { id: p.id, size, color: data.get('color'), fit: data.get('fit') ?? '', qty: clampQty() };
    const { qty: inCart, capped } = addItem(item);
    status.textContent = capped
      ? `You can have up to ${MAX_QTY} of this item. Your cart now has ${inCart}.`
      : `Added to cart: ${p.name}, ${optionText(item)}, quantity ${item.qty}.`;
    openCart(form.querySelector('[type="submit"]'), status.textContent);
  });
}

ready.then(() => {
  const p = getProduct(new URLSearchParams(location.search).get('p'));
  $('[data-pdp-loading]').remove();
  if (!p) return showMissing();
  render(p);
  wire(p);
});
