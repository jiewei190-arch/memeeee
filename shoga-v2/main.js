/* SHOGA v2 — Ritual Club
   Built for an older audience: one obvious action everywhere ("Buy now", which
   becomes "Checkout" once the cart has something in it), large type, little clutter. */
(() => {
  "use strict";

  // ---- Store config ----
  const CONFIG = {
    name: "White Peach Collagen",
    image: "assets/product-peach.jpg",
    price: 58.0,         // one box
    clubDiscount: 0.15,  // monthly delivery saving
    currency: "USD",
    shipDay: 1,          // monthly boxes ship on this day of each month
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: CONFIG.currency }).format(n);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const subPrice = +(CONFIG.price * (1 - CONFIG.clubDiscount)).toFixed(2);
  const priceFor = (plan) => (plan === "sub" ? subPrice : CONFIG.price);

  // ---------- Prices ----------
  $$("[data-price-sub]").forEach((el) => (el.textContent = fmt(subPrice)));
  $$("[data-price-once]").forEach((el) => (el.textContent = fmt(CONFIG.price)));
  $$(".opt [data-price-sub]").forEach((el) => (el.innerHTML = `<s>${fmt(CONFIG.price)}</s> ${fmt(subPrice)}`));

  // ---------- Next delivery date (plain date, no ticking clock) ----------
  const now = new Date();
  let ship = new Date(now.getFullYear(), now.getMonth(), CONFIG.shipDay);
  if (ship <= now) ship = new Date(now.getFullYear(), now.getMonth() + 1, CONFIG.shipDay);
  $("#nextShip").textContent = ship.toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric" });

  // ---------- Backdrop veil: clear over the hero, deepening as you scroll ----------
  const heroEl = $(".hero");
  let veilQueued = false;
  const setVeil = () => {
    veilQueued = false;
    const p = clamp(scrollY / (heroEl.offsetHeight * 0.75), 0, 1);
    document.documentElement.style.setProperty("--veil", (p * 0.82).toFixed(3));
  };
  addEventListener("scroll", () => { if (!veilQueued) { veilQueued = true; requestAnimationFrame(setVeil); } }, { passive: true });
  addEventListener("resize", setVeil);
  setVeil();

  // ---------- Mobile bar height (sticky labels sit under it) ----------
  const side = $(".side");
  const setBar = () => document.documentElement.style.setProperty("--bar-h", `${side.offsetHeight}px`);
  setBar();
  new ResizeObserver(setBar).observe(side);

  // ---------- Menu (mobile) ----------
  const menuBtn = $(".menu-btn"), sheet = $(".sheet-menu");
  const setMenu = (open) => { menuBtn.setAttribute("aria-expanded", String(open)); sheet.hidden = !open; };
  menuBtn.addEventListener("click", () => setMenu(sheet.hidden));
  $$("a", sheet).forEach((a) => a.addEventListener("click", () => setMenu(false)));

  // ---------- Active section in the sidebar ----------
  const navLinks = $$(".side__nav a");
  const sio = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${e.target.id}`));
  }), { rootMargin: "-40% 0px -55% 0px" });
  ["how", "film", "formula", "story", "faq"].forEach((id) => sio.observe(document.getElementById(id)));

  // ---------- Film ----------
  const film = $(".film__video"), play = $(".film__play");
  new IntersectionObserver(([e]) => { if (e.isIntersecting) film.play().catch(() => {}); else film.pause(); }, { threshold: 0.4 }).observe(film);
  play.addEventListener("click", () => {
    const turnOn = film.muted;
    film.muted = !turnOn;
    if (turnOn) { film.currentTime = 0; film.play().catch(() => {}); }
    play.setAttribute("aria-pressed", String(turnOn));
    play.innerHTML = turnOn ? "■ <span>Sound off</span>" : "▶ <span>Play with sound</span>";
  });

  // ---------- Overlays ----------
  const scrim = $(".scrim"), join = $(".join"), cartEl = $(".cart");
  let openEl = null, lastFocus = null;
  const open = (el) => {
    if (openEl) close(true);
    lastFocus = document.activeElement;
    scrim.hidden = false; el.hidden = false;
    requestAnimationFrame(() => { scrim.classList.add("is-on"); el.classList.add("is-on"); });
    document.body.classList.add("lock");
    openEl = el;
    setTimeout(() => (el === cartEl && cart.length ? $("#checkout") : $("button, input", el))?.focus(), 60);
  };
  const close = (instant) => {
    if (!openEl) return;
    const el = openEl; openEl = null;
    scrim.classList.remove("is-on"); el.classList.remove("is-on");
    document.body.classList.remove("lock");
    const hide = () => { el.hidden = true; if (!openEl) scrim.hidden = true; };
    instant === true ? hide() : setTimeout(hide, 400);
    if (instant !== true) lastFocus?.focus?.();
  };
  scrim.addEventListener("click", close);
  $$(".join__close").forEach((b) => b.addEventListener("click", close));
  $(".cart__keep").addEventListener("click", close);
  addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); setMenu(false); } });
  $(".cart-toggle").addEventListener("click", () => open(cartEl));

  // Every main button: "Buy now" until something is in the cart, then "Checkout"
  $$("[data-primary]").forEach((b) => b.addEventListener("click", () => open(cart.length ? cartEl : join)));

  // ---------- Buy sheet ----------
  let qty = 1;
  const plan = () => $("input[name=plan]:checked").value;
  const updateTotal = () => { $("#qty").textContent = qty; $("[data-total]").textContent = fmt(priceFor(plan()) * qty); };
  $$(".join [data-q]").forEach((b) => b.addEventListener("click", () => { qty = clamp(qty + +b.dataset.q, 1, 10); updateTotal(); }));
  $$("input[name=plan]").forEach((r) => r.addEventListener("change", updateTotal));
  updateTotal();

  // ---------- Cart ----------
  const KEY = "shoga-v2-cart";
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch { cart = []; }
  cart.forEach((i) => (i.price = priceFor(i.plan)));
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch {} };
  const list = $(".cart__items");

  const render = () => {
    const n = cart.reduce((s, i) => s + i.qty, 0);
    $(".cart-count").textContent = n;
    $(".cart-label").textContent = n ? "Checkout" : "Cart";
    $(".cart-toggle").classList.toggle("is-full", n > 0);
    $(".cart-toggle").setAttribute("aria-label", n ? `Checkout, ${n} ${n === 1 ? "box" : "boxes"} in cart` : "Cart, empty");
    $$("[data-primary]").forEach((b) => {
      b.textContent = n ? `Checkout (${n})` : "Buy now";
      b.classList.toggle("is-checkout", n > 0);
    });
    list.innerHTML = cart.length ? cart.map((i, idx) => `
      <div class="citem">
        <img src="${CONFIG.image}" alt="" />
        <div><b>${CONFIG.name}</b><small>${i.plan === "sub" ? "Monthly delivery" : "One box"}</small>
          <div class="qty"><button data-i="${idx}" data-d="-1" aria-label="One fewer box">−</button><output>${i.qty}</output><button data-i="${idx}" data-d="1" aria-label="One more box">+</button></div></div>
        <div class="citem__price"><span>${fmt(i.price * i.qty)}</span><button class="citem__rm" data-rm="${idx}">Remove</button></div>
      </div>
      ${i.plan === "once" ? `<button class="upsell" data-up="${idx}">Switch to monthly delivery and save ${fmt((CONFIG.price - subPrice) * i.qty)}</button>` : ""}`).join("")
      : `<p class="cart__empty">Your cart is empty.</p>`;
    $("[data-subtotal]").textContent = fmt(cart.reduce((s, i) => s + i.price * i.qty, 0));
    $("#checkout").hidden = !cart.length;
    save();
  };
  list.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.rm != null) cart.splice(+b.dataset.rm, 1);
    else if (b.dataset.up != null) {
      const it = cart.splice(+b.dataset.up, 1)[0];
      const sub = cart.find((i) => i.plan === "sub");
      if (sub) sub.qty = clamp(sub.qty + it.qty, 1, 10); else cart.push({ plan: "sub", qty: it.qty, price: subPrice });
      toast("Switched to monthly delivery. You're saving 15%.");
    } else { const it = cart[+b.dataset.i]; it.qty = clamp(it.qty + +b.dataset.d, 0, 10); if (!it.qty) cart.splice(+b.dataset.i, 1); }
    render();
  });
  $("#addToCart").addEventListener("click", () => {
    const p = plan();
    const ex = cart.find((i) => i.plan === p);
    if (ex) ex.qty = clamp(ex.qty + qty, 1, 10); else cart.push({ plan: p, qty, price: priceFor(p) });
    render();
    open(cartEl);
  });
  $("#checkout").addEventListener("click", () => toast("Checkout is almost ready. Connect your payment provider to go live."));
  render();

  function toast(msg) {
    const t = $(".toast"); t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("is-on"), 4000);
  }
  $("#year").textContent = new Date().getFullYear();
})();
