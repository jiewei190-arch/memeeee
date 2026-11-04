# SHOGA — The Confidence Ritual

Static storefront for SHOGA White Peach Collagen. No build step — open `index.html`
or serve the folder:

```bash
cd shoga && python3 -m http.server 8000
```

## Pages
- `index.html` — Home: hero, manifesto, unboxing, ritual film, Ritual Club pitch
- `shop.html` — product, Ritual Club subscription (default) and one-time purchase
- `ritual.html` — the three steps, four benefits, formula
- `about.html` — story and FAQ

`index.html` holds the shared header, footer and cart. The other pages are
generated from it plus their content in `src/`:

```bash
python3 build_pages.py   # after editing index.html's shell or anything in src/
```

## Files
- `styles.css` — design system (colour tokens at the top)
- `main.js` — loader, cursor, scroll scenes, gallery, cart. **Prices live in `PRODUCT` at the top.**
- `assets/` — images at native resolution and the ritual video (with audio for the film's sound toggle)
- `vendor/lenis.min.js` — Lenis 1.1.13 smooth-scroll (MIT), bundled locally

## Before going live
- Set real prices in `main.js` (placeholders: $58 one-time, 15% off subscription).
- Check the ingredient list, "30 sachets" and "free-from" badges against the actual label.
- Wire the **Checkout** button and newsletter form to your store/email provider
  (e.g. Shopify Buy Button / Storefront API, Klaviyo).
