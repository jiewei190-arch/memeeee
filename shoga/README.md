# SHOGA — The Confidence Ritual

Static storefront for SHOGA White Peach Collagen. No build step — open `index.html`
or serve the folder:

```bash
cd shoga && python3 -m http.server 8000
```

## Files
- `index.html` — page structure and copy
- `styles.css` — design system (colour tokens at the top)
- `main.js` — loader, cursor, scroll scenes, gallery, cart. **Prices live in `PRODUCT` at the top.**
- `assets/` — optimized images and the muted hero video
- `vendor/lenis.min.js` — Lenis 1.1.13 smooth-scroll (MIT), bundled locally

## Before going live
- Set real prices in `main.js` (placeholders: $58 one-time, 15% off subscription).
- Check the ingredient list, "30 sachets" and "free-from" badges against the actual label.
- Wire the **Checkout** button and newsletter form to your store/email provider
  (e.g. Shopify Buy Button / Storefront API, Klaviyo).
