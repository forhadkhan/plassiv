#!/usr/bin/env python3
"""Assemble the root HTML pages from src/*.template.html, the shared partials and data/products.json."""
import json
import os
import re
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
PRODUCTS = json.loads((ROOT / "data/products.json").read_text())
SITE = os.environ.get("SITE_URL", "https://forhadkhan.github.io/plassiv/").rstrip("/") + "/"


def money(cents):
    return f"${cents // 100:,}.{cents % 100:02d}"


BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
LAZY_IMG = re.compile(r'<img loading="lazy" decoding="async" src="([^"]+)"(?: srcset="([^"]+)")?')


def defer_images(html):
    """Swap each lazy image's real source into data-src / data-srcset; js/lazy.js loads them nearest-first, a few at a time."""
    def swap(m):
        src, srcset = m.groups()
        return f'<img decoding="async" src="{BLANK}" data-src="{src}"' + (f' data-srcset="{srcset}"' if srcset else "")
    return LAZY_IMG.sub(swap, html)


def card(i, p):
    name = escape(p["name"])
    small = escape(p["image"].replace(".webp", "-640.webp"))
    no = p["id"].lstrip("p").zfill(2)
    # the name link stretches over the whole card; the wishlist button sits above it (z-10) so it stays separate
    return f'''    <li class="reveal snap-start" style="--d:{(i % 3) * 80}ms">
      <article class="group relative">
        <span class="mat mat-sm"><span class="relative">
          <img loading="lazy" decoding="async" src="{small}" srcset="{small} 640w, {escape(p["image"])} {p["width"]}w" sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 82vw" width="{p["width"]}" height="{p["height"]}" alt="{escape(p["alt"])}" class="aspect-[3/4] w-full object-cover transition duration-[1600ms] ease-out group-hover:scale-[1.04]">
          <span class="absolute left-3 top-3 border border-gold-light/70 bg-ink/40 px-2.5 py-1.5 text-[0.5625rem] font-semibold uppercase leading-none tracking-[.3em] text-gold-light backdrop-blur-sm">New</span>
          <button type="button" class="wish absolute right-3 top-3 z-10 grid size-9 place-items-center border border-gold-light/70 bg-ink/40 text-white backdrop-blur-sm transition hover:border-gold-light hover:text-gold-light" aria-pressed="false" aria-label="Add {name} to wishlist"><svg class="icon size-[1.0625rem] transition"><use href="#i-heart"/></svg></button>
          <span class="edit-cue" aria-hidden="true">View piece <span class="mx-1.5 text-gold">·</span> {money(p["priceCents"])}</span>
        </span></span>
        <p class="mt-7 text-[0.625rem] font-semibold uppercase tracking-[.3em] text-brand">{escape(p["category"])} <span class="mx-1 text-gold">·</span> No. {no}</p>
        <h3 class="mt-2 font-serif text-[1.625rem] font-medium leading-tight"><a href="product.html?p={escape(p["id"])}" class="after:absolute after:inset-0 transition hover:text-brand">{name}</a></h3>
        <span class="mt-3 block h-px w-10 bg-gold/70 transition-all duration-700 group-hover:w-16" aria-hidden="true"></span>
        <p class="mt-3 text-xs uppercase tracking-[.2em] text-muted [@media(hover:hover)]:sr-only">{money(p["priceCents"])}</p>
      </article>
    </li>'''


# page -> (link base for other-page anchors, home link, nav attribute: the home bar is see-through over the hero)
PAGES = {
    "index": ("", "#top", "data-clear-top"),
    "product": ("index.html", "index.html", ""),
    "checkout": ("index.html", "index.html", ""),
    "order": ("index.html", "index.html", ""),
}

JSONLD = json.dumps({
    "@context": "https://schema.org",
    "@graph": [
        {"@type": "Organization", "name": "Plassiv", "url": SITE, "logo": SITE + "assets/brand/icon-512.png"},
        {"@type": "WebSite", "name": "Plassiv", "url": SITE},
    ],
}, indent=2)


def meta(text, pattern):
    return re.search(pattern, text).group(1)

partial = {name: (SRC / f"partials/{name}.html").read_text() for name in ("head", "nav", "footer", "cart", "search", "login")}
HEAD = partial.pop("head")

for page, (base, home, navtop) in PAGES.items():
    out = (SRC / f"{page}.template.html").read_text()
    head = HEAD.replace("%TITLE%", meta(out, r"<title>(.*?)</title>")) \
               .replace("%DESC%", meta(out, r'name="description" content="(.*?)"')) \
               .replace("%URL%", SITE if page == "index" else f"{SITE}{page}.html") \
               .replace("%SITE%", SITE) \
               .replace("%JSONLD%", f'\n  <script type="application/ld+json">{JSONLD}</script>' if page == "index" else "")
    out = out.replace("<!--HEAD-->", head.rstrip("\n"))
    for name, text in partial.items():
        out = out.replace(f"<!--{name.upper()}-->", text.rstrip("\n"))
    out = out.replace("<!--SPRITE-->", (SRC / "sprite.html").read_text()) \
             .replace("    <!--PRODUCTS-->", "\n".join(card(i, p) for i, p in enumerate(PRODUCTS))) \
             .replace("%BASE%", base).replace("%HOME%", home).replace("%NAVTOP%", navtop)
    (ROOT / f"{page}.html").write_text(defer_images(out))
    print(f"{page}.html written", len(out), "bytes")

(ROOT / "robots.txt").write_text("User-agent: *\nDisallow: /\n")
