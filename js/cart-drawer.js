/* Slide-in cart drawer and header cart badge, on every page. */
import { ready, totals, setQty, removeLine, money, MAX_QTY } from './store.js';
import { $, el, icon, optionText, renderTotals, mountCoupon } from './ui.js';

const drawer = $('#cart-drawer');
const list = $('[data-cart-lines]', drawer);
const empty = $('[data-cart-empty]', drawer);
const foot = $('[data-cart-foot]', drawer);
const live = $('#cart-live');
const closeBtn = $('[data-cart-close]', drawer);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let returnTo = null;
let closeTimer = 0;
let refreshCoupon = null;
let pendingFocus = null;

export function openCart(trigger = document.activeElement, message = '') {
  if (message) announce(message);
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = 0; drawer.classList.add('is-open'); return; }
  if (drawer.open) return;
  returnTo = trigger;
  document.documentElement.style.overflow = 'hidden';
  drawer.showModal();
  void drawer.offsetWidth; // commit the off-screen position so the slide-in can transition
  drawer.classList.add('is-open');
}

function closeCart({ restoreFocus = true, instant = false } = {}) {
  if (!drawer.open || closeTimer) return;
  drawer.classList.remove('is-open');
  const finish = () => {
    closeTimer = 0;
    drawer.close();
    document.documentElement.style.overflow = '';
    if (restoreFocus && returnTo?.isConnected) returnTo.focus();
  };
  if (instant || reduceMotion.matches) finish(); else closeTimer = setTimeout(finish, 350);
}

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-cart-open]');
  if (trigger) openCart(trigger);
});
closeBtn.addEventListener('click', () => closeCart());
drawer.addEventListener('cancel', (e) => { e.preventDefault(); closeCart(); });
drawer.addEventListener('click', (e) => {
  if (e.target === drawer) closeCart(); // the backdrop
  else if (e.target.closest('a[href]')) closeCart({ restoreFocus: false, instant: true });
});

/* showModal already makes the page inert; this keeps Tab cycling inside instead of escaping to the browser UI */
drawer.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return;
  const f = [...drawer.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])')].filter((n) => n.getClientRects().length);
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
  else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
});

/* messages raised in the same task (a quantity change and a dropped coupon) are read out together */
let queued = [];
function announce(text) {
  if (!queued.length) {
    live.textContent = '';
    requestAnimationFrame(() => { live.textContent = queued.join(' '); queued = []; });
  }
  queued.push(text);
}

function line(i, index) {
  const name = i.product.name;
  const url = `product.html?p=${encodeURIComponent(i.id)}`;
  const change = (qty, focusKey) => {
    pendingFocus = focusKey;
    setQty(i.key, qty);
    announce(`${name}: quantity ${qty}.`);
  };
  return el('li', { class: 'flex gap-4 py-4' },
    el('a', { href: url, class: 'shrink-0', tabindex: '-1', 'aria-hidden': 'true' },
      el('img', { src: i.product.thumb, alt: '', width: '72', height: '96', loading: 'lazy', class: 'h-24 w-[4.5rem] object-cover' })),
    el('div', { class: 'flex min-w-0 flex-1 flex-col' },
      el('div', { class: 'flex items-start justify-between gap-3' },
        el('a', { href: url, class: 'font-serif text-lg leading-snug hover:text-brand', 'data-focus': `name:${index}` }, name),
        el('p', { class: 'text-sm font-medium tabular-nums' }, money(i.total))),
      el('p', { class: 'mt-1 text-xs text-muted' }, optionText(i)),
      el('p', { class: 'mt-0.5 text-xs text-muted' }, `${money(i.unit)} each`),
      el('div', { class: 'mt-auto flex items-center justify-between gap-3 pt-3' },
        el('div', { class: 'inline-flex h-9 items-center border border-ink/30', role: 'group', 'aria-label': `Quantity of ${name}` },
          el('button', { type: 'button', class: 'grid size-9 place-items-center disabled:opacity-35', 'aria-label': `Decrease quantity of ${name}`, disabled: i.qty <= 1, 'data-focus': `dec:${i.key}`, onclick: () => change(i.qty - 1, `dec:${i.key}`) }, icon('i-minus', 'icon size-4')),
          el('span', { class: 'w-7 text-center text-sm font-semibold tabular-nums' }, String(i.qty)),
          el('button', { type: 'button', class: 'grid size-9 place-items-center disabled:opacity-35', 'aria-label': `Increase quantity of ${name}`, disabled: i.qty >= MAX_QTY, 'data-focus': `inc:${i.key}`, onclick: () => change(i.qty + 1, `inc:${i.key}`) }, icon('i-plus', 'icon size-4'))),
        el('button', {
          type: 'button', class: 'inline-flex items-center gap-1.5 py-1.5 text-xs font-medium text-muted transition hover:text-ink',
          'aria-label': `Remove ${name}, ${optionText(i)}`,
          onclick: () => { pendingFocus = `name:${index}`; removeLine(i.key); announce(`${name} removed from your cart.`); },
        }, icon('i-trash', 'icon size-4'), 'Remove'))));
}

/* re-rendering replaces the buttons, so put focus back on the matching control (or its nearest neighbour) */
function restoreFocus() {
  if (!pendingFocus || !drawer.open) return;
  const want = pendingFocus;
  pendingFocus = null;
  let target = drawer.querySelector(`[data-focus="${CSS.escape(want)}"]`);
  if (target?.disabled) target = target.parentElement.querySelector('button:not([disabled])');
  if (!target && want.startsWith('name:')) {
    const names = drawer.querySelectorAll('[data-focus^="name:"]');
    target = names[Math.min(Number(want.slice(5)), names.length - 1)];
  }
  (target ?? closeBtn).focus();
}

function render(note = '') {
  const t = totals();
  for (const badge of document.querySelectorAll('[data-cart-count]')) {
    badge.textContent = t.count > 99 ? '99+' : String(t.count);
    badge.classList.toggle('hidden', !t.count);
    badge.classList.toggle('grid', !!t.count);
  }
  for (const btn of document.querySelectorAll('[data-cart-open]')) {
    btn.setAttribute('aria-label', t.count ? `Cart, ${t.count} ${t.count === 1 ? 'item' : 'items'}` : 'Cart');
  }
  $('[data-cart-heading-count]', drawer).textContent = t.count ? `(${t.count})` : '';
  list.replaceChildren(...t.items.map(line));
  list.classList.toggle('hidden', !t.items.length);
  foot.classList.toggle('hidden', !t.items.length);
  empty.classList.toggle('hidden', !!t.items.length);
  empty.classList.toggle('flex', !t.items.length);
  renderTotals($('[data-totals]', drawer), t);
  refreshCoupon(note);
  if (note) announce(note);
  restoreFocus();
}

ready.then(() => {
  refreshCoupon = mountCoupon($('[data-coupon]', drawer));
  render();
  addEventListener('plassiv:cart', (e) => render(e.detail.note));
  /* a page restored from the back/forward cache still shows the cart as it was when it was left */
  addEventListener('pageshow', (e) => { if (e.persisted) render(); });
});
