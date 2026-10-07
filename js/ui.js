/* Shared UI pieces for the shop pages. Text always goes in through text nodes, never as HTML. */
import { money, totals, getCoupon, applyCoupon, removeCoupon } from './store.js';

export const $ = (s, r = document) => r.querySelector(s);

/** el('a', { class, href, text }, ...children): attributes set via setAttribute, children as nodes or text */
export function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  n.append(...children.flat().filter((c) => c != null && c !== false));
  return n;
}

export function icon(id, cls = 'icon') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}

export const optionText = (l) => [l.color, l.size && `Size ${l.size}`, l.fit && `${l.fit} fit`].filter(Boolean).join(' · ');

/** Subtotal / discount / shipping / total rows for a <dl>. */
export function renderTotals(dl, t, totalLabel = 'Total') {
  const row = (label, value, cls = '') => el('div', { class: `flex justify-between gap-4 ${cls}` }, el('dt', {}, label), el('dd', { class: 'tabular-nums' }, value));
  dl.replaceChildren(...[
    row('Subtotal', money(t.subtotal)),
    t.discount > 0 && row(`Discount (${t.coupon})`, `−${money(t.discount)}`, 'text-brand font-medium'),
    row('Shipping', t.shipping ? money(t.shipping) : 'Free'),
    t.freeShippingGap > 0 && el('div', {}, el('dt', { class: 'sr-only' }, 'Free shipping'), el('dd', { class: 'text-xs text-muted' }, `Add ${money(t.freeShippingGap)} more for free shipping.`)),
    row(totalLabel, money(t.total), 'border-t border-line pt-3 text-base font-bold'),
  ].filter(Boolean));
}

let couponSeq = 0;

/** Coupon field + applied chip + message, mounted into `root`. Returns a refresh(note) function. */
export function mountCoupon(root) {
  const id = `coupon-${++couponSeq}`;
  const input = el('input', {
    id, type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '32',
    class: 'h-11 min-w-0 flex-1 rounded-full border border-ink/50 bg-white px-4 text-sm uppercase placeholder:normal-case placeholder:text-muted focus-visible:border-ink',
    placeholder: 'Enter code', 'aria-describedby': `${id}-msg`,
  });
  const apply = el('button', { type: 'button', class: 'h-11 rounded-full border border-ink px-5 text-sm font-semibold transition hover:bg-ink hover:text-white' }, 'Apply');
  const form = el('div', { class: 'mt-1.5 flex gap-2' }, input, apply);
  const chipCode = el('span', { class: 'font-semibold' });
  const chipLabel = el('span', { class: 'text-muted' });
  const remove = el('button', { type: 'button', class: 'ml-auto text-xs font-semibold underline underline-offset-2 hover:no-underline' }, 'Remove');
  const chip = el('div', { class: 'mt-1.5 hidden items-center gap-2 rounded-full bg-brand/10 py-2 pl-3 pr-4 text-sm' }, icon('i-tag', 'icon size-4 text-brand'), chipCode, chipLabel, remove);
  const msg = el('p', { id: `${id}-msg`, role: 'status', class: 'mt-1.5 text-xs empty:hidden' });

  const say = (text, ok = true) => {
    msg.textContent = text;
    msg.className = `mt-1.5 text-xs empty:hidden ${ok ? 'text-brand' : 'text-danger'}`;
  };
  const doApply = () => {
    const r = applyCoupon(input.value);
    say(r.message, r.ok);
    input.setAttribute('aria-invalid', String(!r.ok));
    if (r.ok) { input.value = ''; remove.focus(); }
  };
  apply.addEventListener('click', doApply);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doApply(); } });
  input.addEventListener('input', () => input.removeAttribute('aria-invalid'));
  remove.addEventListener('click', () => { say(removeCoupon()); input.focus(); });

  root.replaceChildren(el('label', { for: id, class: 'text-xs font-semibold' }, 'Coupon code'), form, chip, msg);

  return function refresh(note = '') {
    const code = getCoupon();
    const t = totals();
    form.classList.toggle('hidden', !!code);
    form.classList.toggle('flex', !code);
    chip.classList.toggle('hidden', !code);
    chip.classList.toggle('flex', !!code);
    chipCode.textContent = code ?? '';
    chipLabel.textContent = code ? t.couponLabel : '';
    if (note) say(note, false);
  };
}
