# Plassiv

Plassiv is a menswear storefront built as a static site: plain HTML, CSS and JavaScript, styled with Tailwind CSS v4. There is no framework and no server. It covers the full shopping journey: browse, search, product detail, cart, checkout with Cash on Delivery, and order confirmation.

**Live demo:** https://forhadkhan.github.io/plassiv/

> This is a demo shop. Carts and orders live in the visitor's browser (`localStorage`) and nothing is sent to a server. The sign-in form has no account system behind it and refuses every credential. The site is marked `noindex`.

## Features

- **Hero** with a WebGL satin background, a lit "gel" wordmark, and a model photo that shatters into shards and re-forms as a second photo when you hover (mouse) or tap (touch).
- **Catalogue** of 20 products with a swipeable track, a "View all" grid, responsive image sets and a wishlist toggle.
- **Search** as a full-screen sheet that filters the catalogue as you type, with keyboard navigation.
- **Product pages** with colour, size, fit and quantity selection, related items and a clear "not found" state.
- **Cart drawer** with quantity controls, coupons (`FLAT15` and others in `js/store.js`), free shipping over $150 and a live total. A cart changed in another tab updates the first one.
- **Checkout** with inline validation, an error summary that takes focus, and Cash on Delivery. **Order page** at `order.html?id=PL-XXXXXX`.
- **Accessibility:** skip link, landmarks, one `h1` per page, labelled controls, focus-trapped dialogs, live regions for cart and search status, visible focus rings and 24px-minimum touch targets.
- **Loads well on a slow connection:** see [Loading and performance](#loading-and-performance).
- **Motion** is gated on `prefers-reduced-motion`; WebGL surfaces fall back to CSS gradients when WebGL is unavailable.

## Tech stack

| Area | Choice |
|---|---|
| Markup | Static HTML assembled from templates and partials by `scripts/build-html.py` |
| Styling | Tailwind CSS v4 (`@tailwindcss/cli`), design tokens in `src/input.css` |
| Scripting | Native ES modules, no bundler |
| Graphics | WebGL fragment shaders for the hero, nav, menu, search, about and footer surfaces |
| Data | `data/products.json`; cart, coupons and orders in `localStorage` (`js/store.js`, which holds all the money maths in integer cents) |
| Type | Regione (poster wordmark), Brilega Fadone (section titles), Cormorant, Sora and Inter, all self-hosted in `assets/fonts/` |

## Project structure

```
index.html, product.html,
checkout.html, order.html   generated pages (committed so GitHub Pages can serve them)
src/
  *.template.html           page templates
  partials/                 head, nav, footer, cart drawer, search and login dialogs
  sprite.html               inline SVG icon sprite
  input.css                 Tailwind entry point: fonts, tokens, components
data/products.json          the catalogue
js/                         one module per concern (store, ui, cart-drawer, nav, search, ...)
scripts/
  build-html.py             templates + partials + products.json -> root pages
  bake-gaze.py              one-off: registers the second hero photo onto the first
dist/styles.css             compiled, minified Tailwind output (committed)
assets/                     brand, fonts and images
```

## Getting started

You need Node.js 20+ and Python 3.

```bash
npm install
npm run build        # regenerate the four pages and dist/styles.css
```

Then serve the folder with any static server and open it:

```bash
python3 -m http.server 5180
```

`npm run dev` watches `src/input.css` and the HTML and rebuilds the CSS only. After editing a template, a partial or `data/products.json`, run `npm run build` so the root pages are regenerated.

### Editing content

- **Products:** edit `data/products.json`. Each product needs `image` (`pN.webp`) plus `pN-640.webp` and `pN-320.webp` beside it; the home page cards and the cart use those sizes.
- **Site URL** (canonical, Open Graph, JSON-LD): set `SITE_URL` when building, for example `SITE_URL=https://example.com/shop/ npm run build`.
- **Hero second photo:** `python3 scripts/bake-gaze.py <photo.png>` needs `numpy`, `opencv-python-headless` and `pillow`.

## Loading and performance

The page is built to show its first screen quickly on a slow link and then fill in the rest one piece at a time.

- **First paint:** CSS, the hero photo and the two fonts used above the fold (Regione, Inter) are the only things hinted early. The other fonts are found through the CSS.
- **Images:** all photos are WebP (about half the size of the JPEGs they replaced). Product photos come in three sizes, `pN.webp`, `pN-640.webp` and `pN-320.webp`; the testimonials have `-112` and `-500` sizes. The existing ones are WebP at quality 78, resized to 640 and 320 px wide.
- **Lazy and in order:** images below the first screen start as a blank pixel with `data-src` (the build script does the swap). `js/lazy.js` loads them as they come near the viewport, nearest first, one or two at a time. It watches how long each one takes and goes down to one at a time when the link is slow. Images inside the swipeable product track load a few cards ahead of the swipe. Failed images are retried twice.
- **Scripts:** `js/boot.js` starts the modules that draw the first screen (`data-now`), then loads the others (`data-later`) one at a time, when the browser is idle, after the page has loaded. A tap on search or sign-in before its module arrives loads it and repeats the tap.
- **Saving data:** with Data Saver on, or on a 2G link, the hero hover photo (`js/gaze.js`) is skipped and the lazy queue loads one image at a time.
- **No JavaScript:** the below-the-fold photos do not appear, because they are swapped in by script.
- **Original JPEGs and fonts** are only in git history now. The fonts are `.woff2` files made from the original `.ttf` and `.otf`.

## Deployment

The site is plain files, so any static host works. GitHub Pages serves the repository root from `main`. Run `npm run build` and commit the generated pages and `dist/styles.css` with your change.

## Credits

Photographs, fonts and licences are listed in [CREDITS.md](CREDITS.md). The hero model photo and the two Edit-section photos (cream blazer, denim jacket) were supplied by the site owner. Check the licences of the two display fonts, Regione and Brilega Fadone, before using the site commercially.

Designed and developed by [Forhad Khan](https://forhadkhan.com).
