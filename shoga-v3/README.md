# SHOGA v3

Buy-first version of the SHOGA site, built for an older audience.

- `index.html` — the Buy page (first page): product, monthly or one box, quantity, one huge BUY NOW button
- `ritual.html` — The Ritual: three steps and the ritual film
- `ingredients.html` — Ingredients: the four ingredients

Rule of the site: there is always one big peach button. It says BUY NOW until
something is in the cart, then every one of them says CHECKOUT and opens the cart.

`ritual.html` and `ingredients.html` are generated from `index.html`'s shared
header, footer and cart plus their content in `src/`:

```bash
python3 build_pages.py
```

Prices are in `CONFIG` at the top of `main.js`. Static, no build step to serve:
`python3 -m http.server` in this folder.
