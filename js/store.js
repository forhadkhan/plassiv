/* Plassiv store: catalogue, cart, coupons, shipping and orders.
   The only module that does money math. All amounts are integer cents. */

const KEY = { cart: 'plassiv.cart', coupon: 'plassiv.coupon', orders: 'plassiv.orders' };
export const MAX_QTY = 10;
const SHIPPING = 500;
const FREE_SHIPPING_FROM = 15000;
const MAX_ORDERS = 20;
const ORDER_ID = /^PL-[A-Z0-9]{6}$/;

const COUPONS = {
  WELCOME10: { type: 'percent', value: 10, min: 0, label: '10% off' },
  PLASSIV20: { type: 'percent', value: 20, min: 20000, label: '20% off' },
  FLAT15: { type: 'flat', value: 1500, min: 10000, label: '$15 off' },
  FREESHIP: { type: 'shipping', value: 0, min: 0, label: 'free shipping' },
};

export const money = (cents) => `${cents < 0 ? '-' : ''}$${Math.floor(Math.abs(cents) / 100).toLocaleString('en-US')}.${String(Math.abs(cents) % 100).padStart(2, '0')}`;

/* localStorage can throw (blocked, private mode, quota); memory keeps the page working */
const memory = new Map();
let persistent = true;
try { localStorage.setItem('plassiv.probe', '1'); localStorage.removeItem('plassiv.probe'); } catch { persistent = false; }

function readJSON(key) {
  let raw = memory.has(key) ? memory.get(key) : null;
  if (persistent) {
    try { raw = localStorage.getItem(key); } catch { persistent = false; }
  }
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function writeJSON(key, value) {
  const raw = value == null ? null : JSON.stringify(value);
  if (raw == null) memory.delete(key); else memory.set(key, raw);
  if (raw == null) {
    /* removals are always attempted: after a quota error on another key the saved cart must still be cleared */
    try { localStorage.removeItem(key); } catch { /* storage blocked: memory already updated */ }
    return persistent;
  }
  if (!persistent) return false;
  try {
    localStorage.setItem(key, raw);
    return true;
  } catch {
    persistent = false;
    return false;
  }
}

export const variant = (src, w) => src.replace(/\.jpg$/, `-${w}.jpg`);

let products = new Map();
export const ready = fetch('data/products.json')
  .then((r) => { if (!r.ok) throw new Error(`data/products.json: HTTP ${r.status}`); return r.json(); })
  .then((list) => { products = new Map(list.map((p) => [p.id, { ...p, small: variant(p.image, 640), thumb: variant(p.image, 320) }])); return products; });
/* every page waits on `ready`, so a failed catalogue load would leave it on its loading state: say so instead */
ready.catch(() => {
  const note = document.createElement('p');
  note.setAttribute('role', 'alert');
  note.className = 'container-x my-10 rounded-xl border border-line p-4 text-center text-sm';
  note.textContent = 'We could not load the shop right now. Check your connection and reload the page.';
  (document.querySelector('main') ?? document.body).prepend(note);
});
export const getProduct = (id) => products.get(id) ?? null;
export const allProducts = () => [...products.values()];

const lineKey = (l) => [l.id, l.size, l.color, l.fit].join('|');

const toQty = (q) => {
  const n = Math.floor(Number(q));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_QTY) : 0;
};

/* stored data is untrusted: keep only lines that name a real, purchasable variant */
function cleanLine(r) {
  if (!r || typeof r !== 'object') return null;
  const p = products.get(r.id);
  if (!p) return null;
  if (!p.sizes.includes(r.size) || p.soldOut.includes(r.size)) return null;
  if (!p.colors.some((c) => c.name === r.color)) return null;
  const fit = p.fits.length ? r.fit : '';
  if (p.fits.length && !p.fits.includes(fit)) return null;
  const qty = toQty(r.qty);
  return qty ? { id: p.id, size: r.size, color: r.color, fit, qty } : null;
}

function getCart() {
  const raw = readJSON(KEY.cart);
  const lines = new Map();
  for (const r of Array.isArray(raw) ? raw : []) {
    const line = cleanLine(r);
    if (!line) continue;
    const prev = lines.get(lineKey(line));
    if (prev) prev.qty = Math.min(MAX_QTY, prev.qty + line.qty); else lines.set(lineKey(line), line);
  }
  return [...lines.values()];
}

/* lines joined with catalogue data; price always comes from the catalogue, never from storage */
const cartItems = (lines = getCart()) => lines.map((l) => {
  const p = products.get(l.id);
  return { ...l, key: lineKey(l), product: p, unit: p.priceCents, total: p.priceCents * l.qty };
});

const emit = (note = '') => dispatchEvent(new CustomEvent('plassiv:cart', { detail: { note } }));

function saveCart(lines) {
  writeJSON(KEY.cart, lines.length ? lines : null);
  emit(revalidateCoupon(lines));
}

/** Adds a variant; returns the line's new qty and whether it hit MAX_QTY. */
export function addItem({ id, size, color, fit = '', qty = 1 }) {
  const line = cleanLine({ id, size, color, fit, qty });
  if (!line) throw new Error(`addItem: not a purchasable variant (${id} ${size} ${color} ${fit})`);
  const lines = getCart();
  const prev = lines.find((l) => lineKey(l) === lineKey(line));
  const wanted = (prev?.qty ?? 0) + line.qty;
  if (prev) prev.qty = Math.min(MAX_QTY, wanted); else lines.push(line);
  saveCart(lines);
  return { qty: Math.min(MAX_QTY, wanted), capped: wanted > MAX_QTY };
}

export function setQty(key, qty) {
  const n = toQty(qty);
  if (!n) return removeLine(key);
  saveCart(getCart().map((l) => (lineKey(l) === key ? { ...l, qty: n } : l)));
}

export const removeLine = (key) => saveCart(getCart().filter((l) => lineKey(l) !== key));

export function getCoupon() {
  const code = readJSON(KEY.coupon);
  return typeof code === 'string' && Object.hasOwn(COUPONS, code) ? code : null;
}

const subtotalOf = (lines) => cartItems(lines).reduce((sum, i) => sum + i.total, 0);

/* runs after every cart change: a coupon that is no longer eligible is dropped, with a note for the shopper */
function revalidateCoupon(lines) {
  const code = getCoupon();
  if (!code) return '';
  if (!lines.length) {
    writeJSON(KEY.coupon, null);
    return `${code} was removed because your cart is empty.`;
  }
  const { min } = COUPONS[code];
  if (subtotalOf(lines) < min) {
    writeJSON(KEY.coupon, null);
    return `${code} was removed: it needs a subtotal of ${money(min)}.`;
  }
  return '';
}

/** Validates and stores a code typed by the shopper. Returns { ok, message }. */
export function applyCoupon(input) {
  const code = String(input ?? '').trim().toUpperCase();
  if (!code) return { ok: false, message: 'Enter a coupon code.' };
  if (!Object.hasOwn(COUPONS, code)) return { ok: false, message: `“${code.slice(0, 24)}” is not a valid coupon code.` };
  const lines = getCart();
  if (!lines.length) return { ok: false, message: 'Add an item to your cart before using a coupon.' };
  const c = COUPONS[code];
  const sub = subtotalOf(lines);
  if (sub < c.min) {
    return { ok: false, message: `${code} needs a subtotal of ${money(c.min)}. Add ${money(c.min - sub)} more to use it.` };
  }
  const previous = getCoupon();
  writeJSON(KEY.coupon, code);
  emit();
  const replaced = previous && previous !== code ? ` It replaces ${previous}.` : '';
  return { ok: true, message: `${code} applied: ${c.label}.${replaced}` };
}

export function removeCoupon() {
  const code = getCoupon();
  writeJSON(KEY.coupon, null);
  emit();
  return code ? `${code} removed.` : '';
}

export function totals(lines = getCart(), code = getCoupon()) {
  const items = cartItems(lines);
  const subtotal = items.reduce((sum, i) => sum + i.total, 0);
  const c = code && items.length && subtotal >= COUPONS[code].min ? COUPONS[code] : null;
  let discount = 0;
  if (c?.type === 'percent') discount = Math.round((subtotal * c.value) / 100);
  if (c?.type === 'flat') discount = c.value;
  discount = Math.min(discount, subtotal);
  const afterDiscount = subtotal - discount;
  const freeShipping = c?.type === 'shipping' || afterDiscount >= FREE_SHIPPING_FROM;
  const shipping = !items.length || freeShipping ? 0 : SHIPPING;
  return {
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    subtotal,
    discount,
    shipping,
    total: afterDiscount + shipping,
    coupon: c ? code : null,
    couponLabel: c ? c.label : '',
    freeShippingGap: freeShipping || !items.length ? 0 : FREE_SHIPPING_FROM - afterDiscount,
  };
}

const str = (v, max = 300) => (typeof v === 'string' ? v.slice(0, max) : '');
const cents = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : null);

/* stored orders are untrusted too: coerce every field to the expected type or reject the order */
function cleanOrder(o) {
  if (!o || typeof o !== 'object' || !ORDER_ID.test(o.id) || !Array.isArray(o.lines)) return null;
  const lines = o.lines.slice(0, 50).map((l) => ({
    id: str(l?.id, 20), name: str(l?.name, 120), size: str(l?.size, 8), color: str(l?.color, 40),
    fit: str(l?.fit, 20), qty: toQty(l?.qty), unit: cents(l?.unit), total: cents(l?.total),
  })).filter((l) => l.name && l.qty && l.unit !== null && l.total !== null);
  const t = o.totals ?? {};
  const sums = ['subtotal', 'discount', 'shipping', 'total'].map((k) => cents(t[k]));
  if (!lines.length || sums.includes(null)) return null;
  const c = o.customer ?? {};
  return {
    id: o.id,
    createdAt: str(o.createdAt, 40),
    lines,
    totals: { subtotal: sums[0], discount: sums[1], shipping: sums[2], total: sums[3] },
    coupon: typeof o.coupon === 'string' && Object.hasOwn(COUPONS, o.coupon) ? o.coupon : null,
    payment: 'Cash on Delivery',
    customer: Object.fromEntries(['name', 'phone', 'email', 'address', 'city', 'area', 'postal', 'notes'].map((k) => [k, str(c[k])])),
  };
}

const getOrders = () => {
  const raw = readJSON(KEY.orders);
  return (Array.isArray(raw) ? raw : []).map(cleanOrder).filter(Boolean);
};

export const getOrder = (id) => (ORDER_ID.test(id ?? '') ? getOrders().find((o) => o.id === id) ?? null : null);

function newOrderId(taken) {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (;;) {
    /* bytes >= 252 are skipped so every character is equally likely (252 = 7 * 36) */
    const bytes = [...crypto.getRandomValues(new Uint8Array(24))].filter((b) => b < 252).slice(0, 6);
    if (bytes.length < 6) continue;
    const id = `PL-${bytes.map((b) => abc[b % abc.length]).join('')}`;
    if (!taken.has(id)) return id;
  }
}

/** Turns the current cart into an order, stores it and empties the cart. Returns { order, saved }. */
export function placeOrder(customer) {
  const t = totals();
  if (!t.items.length) throw new Error('placeOrder: the cart is empty');
  const orders = getOrders();
  const order = cleanOrder({
    id: newOrderId(new Set(orders.map((o) => o.id))),
    createdAt: new Date().toISOString(),
    lines: t.items.map((i) => ({ id: i.id, name: i.product.name, size: i.size, color: i.color, fit: i.fit, qty: i.qty, unit: i.unit, total: i.total })),
    totals: { subtotal: t.subtotal, discount: t.discount, shipping: t.shipping, total: t.total },
    coupon: t.coupon,
    customer,
  });
  const saved = writeJSON(KEY.orders, [...orders, order].slice(-MAX_ORDERS));
  writeJSON(KEY.cart, null);
  writeJSON(KEY.coupon, null);
  emit();
  return { order, saved };
}

/* another tab changed the cart or coupon */
addEventListener('storage', (e) => {
  if (e.key === null || e.key === KEY.cart || e.key === KEY.coupon) emit();
});
