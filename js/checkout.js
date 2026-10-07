/* Checkout: delivery details, Cash on Delivery, order summary. Nothing leaves the browser. */
import { ready, totals, placeOrder, money } from './store.js';
import { $, el, icon, optionText, renderTotals, mountCoupon } from './ui.js';
import { renderOrder } from './order.js';

const form = $('[data-checkout]');
const empty = $('[data-checkout-empty]');
const summary = $('[data-error-summary]');
const submitBtn = $('[type="submit"]', form);
let submitting = false;
let refreshCoupon = () => {};

const LABELS = { name: 'Full name', phone: 'Phone', email: 'Email', address: 'Street address', city: 'City', area: 'Area / district', postal: 'Postal code' };
const RULES = {
  name: (v) => (!v ? 'Enter your full name.' : v.length < 2 ? 'Enter at least 2 characters.' : ''),
  phone: (v) => {
    if (!v) return 'Enter a phone number so the courier can reach you.';
    if (!/^\+?[\d\s()-]+$/.test(v)) return 'Use only digits, spaces, dashes, brackets and an optional leading +.';
    const digits = v.replace(/\D/g, '').length;
    return digits < 7 || digits > 15 ? `Enter 7 to 15 digits (you entered ${digits}).` : '';
  },
  email: (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Enter an email like name@example.com, or leave it empty.' : ''),
  address: (v) => (!v ? 'Enter your street address.' : v.length < 5 ? 'Add your house number and street.' : ''),
  city: (v) => (v ? '' : 'Enter your city.'),
  area: (v) => (v ? '' : 'Enter your area or district.'),
  postal: (v) => (v && !/^[A-Za-z0-9 -]{3,10}$/.test(v) ? 'Use 3 to 10 letters, digits, spaces or dashes.' : ''),
};

const value = (name) => form.elements[name].value.trim();

/** Shows or clears one field's error; returns true when the field is valid. */
function check(name) {
  const input = form.elements[name];
  const message = RULES[name](value(name));
  const out = $(`#f-${name}-error`);
  input.setAttribute('aria-invalid', String(!!message));
  out.replaceChildren(...(message ? [icon('i-circle-alert', 'icon size-3.5'), message] : []));
  return !message;
}

for (const name of Object.keys(RULES)) {
  const input = form.elements[name];
  input.addEventListener('blur', () => { if (input.value.trim() || input.hasAttribute('aria-invalid')) check(name); });
  input.addEventListener('input', () => { if (input.getAttribute('aria-invalid') === 'true') check(name); });
}

function showSummary(failed) {
  $('span', summary).textContent = failed.length === 1 ? 'There is 1 problem with your details' : `There are ${failed.length} problems with your details`;
  $('ul', summary).replaceChildren(...failed.map((name) =>
    el('li', {}, el('a', {
      href: `#f-${name}`, class: 'underline underline-offset-2 hover:no-underline',
      onclick: (e) => { e.preventDefault(); form.elements[name].focus(); },
    }, `${LABELS[name]}: ${RULES[name](value(name))}`))));
  summary.classList.remove('hidden');
  summary.focus();
}

function summaryLine(i) {
  return el('li', { class: 'flex gap-3.5 py-3.5 first:pt-0' },
    el('img', { src: i.product.image, alt: '', width: '56', height: '72', loading: 'lazy', class: 'h-[4.5rem] w-14 shrink-0 rounded-lg object-cover' }),
    el('div', { class: 'min-w-0 flex-1 text-sm' },
      el('p', { class: 'font-semibold leading-snug' }, i.product.name),
      el('p', { class: 'mt-0.5 text-xs text-muted' }, optionText(i)),
      el('p', { class: 'mt-0.5 text-xs text-muted' }, `${i.qty} × ${money(i.unit)}`)),
    el('p', { class: 'text-sm font-bold tabular-nums' }, money(i.total)));
}

function render(note = '') {
  if (submitting) return;
  const t = totals();
  form.classList.toggle('hidden', !t.items.length);
  form.classList.toggle('grid', !!t.items.length);
  empty.classList.toggle('hidden', !!t.items.length);
  if (!t.items.length) return;
  $('[data-summary-lines]').replaceChildren(...t.items.map(summaryLine));
  renderTotals($('[data-summary-totals]'), t, 'Total payable on delivery');
  refreshCoupon(note);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (submitting) return; // a second click or Enter while the first submit is being handled
  const failed = Object.keys(RULES).filter((name) => !check(name));
  if (failed.length) return showSummary(failed);
  summary.classList.add('hidden');
  submitting = true;
  submitBtn.disabled = true;
  $('[data-submit-label]', submitBtn).textContent = 'Placing order…';
  const customer = Object.fromEntries([...Object.keys(RULES), 'notes'].map((k) => [k, value(k)]));
  const { order, saved } = placeOrder(customer);
  if (saved) {
    location.assign(`order.html?id=${encodeURIComponent(order.id)}`);
    return;
  }
  // storage is blocked, so order.html could not read the order back: confirm it right here instead
  const main = $('#main');
  main.replaceChildren();
  renderOrder(main, order, { persisted: false });
  $('h1', main)?.focus();
});

/* coming back with the Back button restores this page from cache; the cart is empty by then */
addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  submitting = false;
  submitBtn.disabled = false;
  $('[data-submit-label]', submitBtn).textContent = 'Place order';
  render();
});

ready.then(() => {
  refreshCoupon = mountCoupon($('[data-coupon]', form));
  render();
  addEventListener('plassiv:cart', (e) => render(e.detail.note));
});
