/* Order confirmation: order.html?id=PL-XXXXXX. renderOrder is also used by checkout when storage is blocked. */
import { ready, getOrder, getProduct, money } from './store.js';
import { $, el, icon, optionText, renderTotals } from './ui.js';

const day = (d) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

function deliveryWindow(createdAt) {
  const placed = new Date(createdAt);
  if (Number.isNaN(placed.getTime())) return '3–5 days';
  const plus = (n) => new Date(placed.getTime() + n * 864e5);
  return `${day(plus(3))} – ${day(plus(5))}`;
}

const fact = (iconId, label, value) => el('div', { class: 'border border-gold/30 bg-paper-deep p-4' },
  el('p', { class: 'flex items-center gap-2 text-xs font-medium text-muted' }, icon(iconId, 'icon size-4 text-brand'), label),
  el('p', { class: 'mt-1.5 text-base font-bold' }, value));

export function renderOrder(root, order, { persisted = true } = {}) {
  const c = order.customer;
  const placed = new Date(order.createdAt);
  const firstName = c.name.split(/\s+/)[0];
  const totalsList = el('dl', { class: 'mt-5 space-y-2 text-sm' });
  renderTotals(totalsList, { ...order.totals, coupon: order.coupon, freeShippingGap: 0 }, 'Pay on delivery');

  root.append(el('div', { class: 'mx-auto max-w-3xl pb-4' },
    el('div', { class: 'text-center' },
      el('span', { class: 'mx-auto grid size-16 place-items-center rounded-full border border-gold bg-wine text-gold-light' }, icon('i-circle-check', 'icon size-8')),
      el('h1', { class: 'title mt-6 text-[clamp(2.25rem,4vw,3.5rem)]', tabindex: '-1' }, firstName ? `Thank you, ${firstName}. Your order is placed.` : 'Your order is placed.'),
      el('p', { class: 'mt-3 text-sm text-muted' }, 'Order number ', el('strong', { class: 'font-bold text-ink' }, order.id),
        Number.isNaN(placed.getTime()) ? '' : `, placed ${day(placed)}`)),

    el('div', { class: 'mt-10 grid gap-3 sm:grid-cols-3' },
      fact('i-banknote', 'Amount to pay on delivery', money(order.totals.total)),
      fact('i-truck', 'Estimated delivery', deliveryWindow(order.createdAt)),
      fact('i-shield-check', 'Payment method', order.payment)),

    el('section', { class: 'mt-10 border border-line bg-white/40 p-5 lg:p-6', 'aria-labelledby': 'items-title' },
      el('h2', { id: 'items-title', class: 'font-serif text-2xl font-medium' }, 'Items'),
      el('ul', { class: 'mt-4 divide-y divide-line' }, order.lines.map((l) => {
        const p = getProduct(l.id);
        return el('li', { class: 'flex gap-3.5 py-3.5 first:pt-0' },
          p && el('img', { src: p.thumb, alt: '', width: '56', height: '72', class: 'h-[4.5rem] w-14 shrink-0 object-cover' }),
          el('div', { class: 'min-w-0 flex-1 text-sm' },
            el('p', { class: 'font-semibold leading-snug' }, l.name),
            el('p', { class: 'mt-0.5 text-xs text-muted' }, optionText(l)),
            el('p', { class: 'mt-0.5 text-xs text-muted' }, `${l.qty} × ${money(l.unit)}`)),
          el('p', { class: 'text-sm font-bold tabular-nums' }, money(l.total)));
      })),
      order.coupon && el('p', { class: 'mt-4 flex items-center gap-2 text-sm' }, icon('i-tag', 'icon size-4 text-brand'), 'Coupon used: ', el('strong', {}, order.coupon)),
      totalsList),

    el('section', { class: 'mt-6 border border-line bg-white/40 p-5 lg:p-6', 'aria-labelledby': 'address-title' },
      el('h2', { id: 'address-title', class: 'font-serif text-2xl font-medium' }, 'Delivery address'),
      el('address', { class: 'mt-3 space-y-0.5 text-sm not-italic leading-relaxed' },
        el('p', { class: 'font-semibold' }, c.name),
        el('p', {}, c.address),
        el('p', {}, [c.area, c.city, c.postal].filter(Boolean).join(', ')),
        el('p', { class: 'pt-2 text-muted' }, c.phone),
        c.email && el('p', { class: 'text-muted' }, c.email)),
      c.notes && el('p', { class: 'mt-3 text-sm' }, el('span', { class: 'font-semibold' }, 'Notes: '), c.notes)),

    el('p', { class: 'mt-6 flex gap-2.5 bg-paper-deep p-4 text-xs leading-relaxed text-muted' }, icon('i-circle-alert', 'icon size-4 shrink-0'),
      persisted
        ? 'This is a demo shop. Your order is stored in this browser only; nothing was sent to a server and no one will deliver it.'
        : 'This is a demo shop. Your browser blocks storage, so this order exists only on this page and is gone when you leave it. Nothing was sent to a server.'),

    el('div', { class: 'mt-8 text-center' },
      el('a', { href: 'index.html#shop', class: 'btn btn-ink' }, 'Continue shopping', icon('i-chevron-right', 'icon size-4')))));
}

const root = $('[data-order-root]');
if (root) {
  ready.then(() => {
    const order = getOrder(new URLSearchParams(location.search).get('id'));
    $('[data-order-loading]').remove();
    if (!order) {
      document.title = 'Order not found — Plassiv';
      $('[data-order-missing]').classList.remove('hidden');
      return;
    }
    document.title = `Order ${order.id} confirmed — Plassiv`;
    renderOrder(root, order);
  });
}
