/* SHOGA v3 — one script for the Buy, Ritual and Ingredients pages.
   Rule of the site: there is always one big peach button. It says BUY NOW until
   something is in the cart, then it says CHECKOUT and opens the cart. */
(() => {
  "use strict";

  // ---- Store config ----
  const CONFIG = {
    name: "White Peach Collagen",
    image: "assets/peach-box.jpg",
    price: 58.0,         // one box
    subDiscount: 0.15,   // monthly delivery saving
    currency: "USD",
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: CONFIG.currency }).format(n);
  const subPrice = +(CONFIG.price * (1 - CONFIG.subDiscount)).toFixed(2);
  const priceFor = (plan) => (plan === "sub" ? subPrice : CONFIG.price);
  const page = document.body.dataset.page;

  $$("[data-price-sub]").forEach((el) => (el.textContent = fmt(subPrice)));
  $$("[data-price-once]").forEach((el) => (el.textContent = fmt(CONFIG.price)));
  $$(".year").forEach((el) => (el.textContent = new Date().getFullYear()));

  // Phones: the sidebar becomes a top bar; tabs and section labels stick right under it
  const side = $(".side");
  const setSide = () => document.documentElement.style.setProperty("--side-h", `${side.offsetHeight}px`);
  setSide(); new ResizeObserver(setSide).observe(side);

  // Next monthly delivery: a plain date (boxes ship on the 1st)
  const now = new Date();
  let ship = new Date(now.getFullYear(), now.getMonth(), 1);
  if (ship <= now) ship = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  $$(".next-ship").forEach((el) => (el.textContent = ship.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" })));

  // ---------- Cart state (shared across pages) ----------
  const KEY = "shoga-v3-cart";
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch { cart = []; }
  cart.forEach((i) => (i.price = priceFor(i.plan)));
  const count = () => cart.reduce((s, i) => s + i.qty, 0);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch {} };

  // ---------- Cart drawer ----------
  const scrim = $(".scrim"), drawer = $(".cart"), list = $(".cart__items");
  let lastFocus = null;
  const openCart = () => {
    lastFocus = document.activeElement;
    scrim.hidden = false; drawer.hidden = false;
    requestAnimationFrame(() => { scrim.classList.add("is-on"); drawer.classList.add("is-on"); });
    document.body.classList.add("lock");
    setTimeout(() => (cart.length ? $("#checkout") : $(".cart__close")).focus(), 60);
  };
  const closeCart = () => {
    if (drawer.hidden) return;
    scrim.classList.remove("is-on"); drawer.classList.remove("is-on");
    document.body.classList.remove("lock");
    setTimeout(() => { drawer.hidden = true; scrim.hidden = true; }, 400);
    lastFocus?.focus?.();
  };
  $(".cartbtn").addEventListener("click", openCart);
  $(".cart__close").addEventListener("click", closeCart);
  $(".cart__keep").addEventListener("click", closeCart);
  scrim.addEventListener("click", closeCart);
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeCart(); });

  // ---------- Buy page controls ----------
  const buyNow = $("#buyNow");
  let qty = 1;
  const plan = () => $("input[name=plan]:checked")?.value || "sub";
  const updateTotal = () => {
    if (!buyNow) return;
    $("#qty").textContent = qty;
    $("[data-total]").textContent = `· ${fmt(priceFor(plan()) * qty)}`;
  };
  const addSelection = () => {
    const p = plan();
    const ex = cart.find((i) => i.plan === p);
    if (ex) ex.qty = clamp(ex.qty + qty, 1, 10); else cart.push({ plan: p, qty, price: priceFor(p) });
    render();
    openCart();
  };
  if (buyNow) {
    $$("[data-q]").forEach((b) => b.addEventListener("click", () => { qty = clamp(qty + +b.dataset.q, 1, 10); updateTotal(); }));
    $$("input[name=plan]").forEach((r) => r.addEventListener("change", updateTotal));
    buyNow.addEventListener("click", addSelection);
    updateTotal();
  }

  // ---------- The big peach buttons everywhere else ----------
  // Buy bar and "Buy now" bands: add to cart on the Buy page, go to the Buy page elsewhere,
  // and once the cart has something in it, they all become CHECKOUT.
  const bigButtons = [...$$("[data-buy]"), ...$$(".buyband .btn--buy")];
  bigButtons.forEach((b) => b.addEventListener("click", (e) => {
    if (count()) { e.preventDefault(); openCart(); return; }
    if (buyNow) { e.preventDefault(); addSelection(); return; }
    if (b.tagName === "BUTTON") location.href = "index.html";
  }));

  // Buy bar: always shown on content pages; on the Buy page once its own button scrolls away
  const buybar = $(".buybar");
  const phone = matchMedia("(max-width: 760px)");
  if (buyNow) {
    // Desktop: show the bar once the page's own BUY button scrolls away. Phones: always.
    let past = false;
    const sync = () => buybar.classList.toggle("is-on", phone.matches || past);
    new IntersectionObserver(([e]) => { past = !e.isIntersecting && e.boundingClientRect.top < 0; sync(); }, { threshold: 0 }).observe(buyNow);
    phone.addEventListener("change", sync); sync();
  } else {
    buybar.classList.add("is-on");
  }
  buybar.removeAttribute("aria-hidden");
  $("[data-buy]", buybar).removeAttribute("tabindex");

  // ---------- Render ----------
  function render() {
    const n = count();
    const cb = $(".cartbtn");
    cb.classList.toggle("is-full", n > 0);
    $(".cartbtn__label").textContent = n ? "Checkout" : "Cart";
    $(".cartbtn__n").textContent = n;
    cb.setAttribute("aria-label", n ? `Checkout: ${n} ${n === 1 ? "box" : "boxes"} in your cart` : "Cart: empty");
    bigButtons.forEach((b) => (b.textContent = n ? `Checkout (${n})` : "Buy now"));

    list.innerHTML = cart.length ? cart.map((i, idx) => `
      <div class="citem">
        <img src="${CONFIG.image}" alt="" />
        <div>
          <b>${CONFIG.name}</b>
          <small>${i.plan === "sub" ? "Monthly delivery · free shipping" : "One box"}</small>
          <div class="citem__row">
            <div class="qty" role="group" aria-label="Number of boxes"><button data-i="${idx}" data-d="-1" aria-label="One fewer box">−</button><output>${i.qty}</output><button data-i="${idx}" data-d="1" aria-label="One more box">+</button></div>
            <span class="citem__price">${fmt(i.price * i.qty)}</span>
          </div>
          <button class="citem__rm" data-rm="${idx}">Remove</button>
        </div>
      </div>
      ${i.plan === "once" ? `<button class="upsell" data-up="${idx}">Switch to monthly delivery and save ${fmt((CONFIG.price - subPrice) * i.qty)}</button>` : ""}`).join("")
      : `<p class="cart__empty">Your cart is empty.</p>`;
    $("[data-subtotal]").textContent = fmt(cart.reduce((s, i) => s + i.price * i.qty, 0));
    $("#checkout").hidden = !cart.length;
    save();
  }
  list.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.rm != null) cart.splice(+b.dataset.rm, 1);
    else if (b.dataset.up != null) {
      const it = cart.splice(+b.dataset.up, 1)[0];
      const sub = cart.find((i) => i.plan === "sub");
      if (sub) sub.qty = clamp(sub.qty + it.qty, 1, 10); else cart.push({ plan: "sub", qty: it.qty, price: subPrice });
      toast("Switched to monthly delivery. You save 15%.");
    } else { const it = cart[+b.dataset.i]; it.qty = clamp(it.qty + +b.dataset.d, 0, 10); if (!it.qty) cart.splice(+b.dataset.i, 1); }
    render();
  });
  $("#checkout").addEventListener("click", () => toast("Checkout is almost ready. Connect your payment provider to go live."));
  render();

  // ---------- Ritual film ----------
  const film = $(".film video");
  if (film) {
    new IntersectionObserver(([e]) => { if (e.isIntersecting) film.play().catch(() => {}); else film.pause(); }, { threshold: 0.4 }).observe(film);
    const snd = $(".film__sound");
    snd.addEventListener("click", () => {
      const on = film.muted;
      film.muted = !on;
      if (on) { film.currentTime = 0; film.play().catch(() => {}); }
      snd.setAttribute("aria-pressed", String(on));
      snd.textContent = on ? "Turn sound off" : "Turn sound on";
    });
  }

  function toast(msg) {
    const t = $(".toast"); t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("is-on"), 4000);
  }
})();
