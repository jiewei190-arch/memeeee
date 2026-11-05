/* SHOGA — White Peach Collagen
   Built for older buyers: calm motion, large type, and one obvious action.
   Every big peach button says BUY NOW until something is in the cart,
   then it says CHECKOUT and opens the cart. */
(() => {
  "use strict";

  // ---- Store config: edit prices/currency here ----
  const PRODUCT = {
    name: "White Peach Collagen",
    image: "assets/product-peach.jpg",
    price: 58.0,          // one box
    subDiscount: 0.15,    // monthly delivery saving
    currency: "USD",
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: PRODUCT.currency }).format(n);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const subPrice = +(PRODUCT.price * (1 - PRODUCT.subDiscount)).toFixed(2);
  const priceFor = (plan) => (plan === "sub" ? subPrice : PRODUCT.price);
  const onShop = !!$("#addToCart");

  // ---------- Prices shown anywhere ----------
  $$("[data-price-sub]").forEach((el) => (el.innerHTML = `<s>${fmt(PRODUCT.price)}</s> ${fmt(subPrice)}`));
  $$("[data-price-sub-only]").forEach((el) => (el.textContent = fmt(subPrice)));
  $$("[data-price-once]").forEach((el) => (el.textContent = fmt(PRODUCT.price)));
  $("#year").textContent = new Date().getFullYear();

  // ---------- Header ----------
  const nav = $(".nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 30);
  addEventListener("scroll", onScroll, { passive: true }); onScroll();

  const menuBtn = $(".menu-toggle"), menu = $(".mobile-menu");
  const setMenu = (open) => {
    menuBtn.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("lock", open);
  };
  menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));

  // ---------- Gentle fade-in (content is fully visible without it) ----------
  if (!reduced) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.1 });
    $$(".reveal, .footer__mark, .formula, .final").forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight) el.classList.add("in"); else io.observe(el);
    });
  } else {
    $$(".reveal, .footer__mark, .formula, .final").forEach((el) => el.classList.add("in"));
  }

  // ---------- Film: plays by itself while on screen ----------
  const film = $(".film");
  if (film) {
    const v = $(".film__video", film), caps = $$(".film__cap", film), sound = $(".film__sound", film);
    new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.35 }).observe(film);
    const tick = () => {
      const t = v.currentTime || 0;
      caps.forEach((c) => c.classList.toggle("is-on", t >= +c.dataset.in && t < +c.dataset.out));
      if (!v.paused) requestAnimationFrame(tick);
    };
    v.addEventListener("play", () => requestAnimationFrame(tick));
    sound.addEventListener("click", () => {
      v.muted = !v.muted;
      if (!v.muted) { v.currentTime = 0; v.play().catch(() => {}); }
      sound.setAttribute("aria-pressed", String(!v.muted));
      $("span", sound).textContent = v.muted ? "Turn sound on" : "Turn sound off";
    });
  }

  // ---------- Product gallery (Buy page) ----------
  const mainImg = $("#shopMain");
  $$(".shop__thumbs button").forEach((b) => b.addEventListener("click", () => {
    $$(".shop__thumbs button").forEach((x) => x.classList.toggle("is-active", x === b));
    mainImg.src = b.dataset.src; mainImg.alt = b.dataset.alt;
  }));

  // ---------- Cart (shared across pages) ----------
  const KEY = "shoga-cart";
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch { cart = []; }
  cart.forEach((i) => (i.price = priceFor(i.plan)));
  const count = () => cart.reduce((s, i) => s + i.qty, 0);

  const drawer = $(".cart"), scrim = $(".scrim"), list = $(".cart__items");
  let lastFocus = null;
  const openCart = () => {
    lastFocus = document.activeElement;
    scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add("is-on"));
    drawer.classList.add("is-open"); drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("lock");
    setTimeout(() => (cart.length ? $("#checkout") : $(".cart-close")).focus(), 60);
  };
  const closeCart = () => {
    if (!drawer.classList.contains("is-open")) return;
    scrim.classList.remove("is-on"); setTimeout(() => (scrim.hidden = true), 400);
    drawer.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lock");
    lastFocus?.focus?.();
  };
  $(".cart-toggle").addEventListener("click", openCart);
  $(".cart-close").addEventListener("click", closeCart);
  $(".cart__keep").addEventListener("click", closeCart);
  scrim.addEventListener("click", closeCart);
  addEventListener("keydown", (e) => { if (e.key === "Escape") { closeCart(); setMenu(false); } });

  const add = (plan, qty) => {
    const ex = cart.find((i) => i.plan === plan);
    if (ex) ex.qty = clamp(ex.qty + qty, 1, 10); else cart.push({ plan, qty, price: priceFor(plan) });
    render();
    openCart();
  };

  // Buy page controls
  let qty = 1;
  const plan = () => $("input[name=plan]:checked")?.value || "sub";
  const updateTotal = () => {
    if (!onShop) return;
    $("#qty").textContent = qty;
    $$("[data-total]").forEach((el) => (el.textContent = `· ${fmt(priceFor(plan()) * qty)}`));
  };
  if (onShop) {
    $$("[data-qty]").forEach((b) => b.addEventListener("click", () => { qty = clamp(qty + +b.dataset.qty, 1, 10); updateTotal(); }));
    $$("input[name=plan]").forEach((r) => r.addEventListener("change", updateTotal));
    $("#addToCart").addEventListener("click", () => add(plan(), qty));
    updateTotal();
  }

  // One-tap buy: a single box of monthly delivery
  $$("[data-quick-buy]").forEach((b) => b.addEventListener("click", () => (count() ? openCart() : add(b.dataset.quickBuy, 1))));

  // The big BUY NOW buttons everywhere
  const primaries = $$("[data-primary]");
  primaries.forEach((b) => b.addEventListener("click", () => {
    if (count()) return openCart();
    if (onShop) return add(plan(), qty);
    location.href = "shop.html";
  }));

  function render() {
    const n = count();
    const cb = $(".cart-toggle");
    cb.classList.toggle("is-full", n > 0);
    $(".cartbtn__label").textContent = n ? "Checkout" : "Cart";
    const c = $(".cart-count"); c.textContent = n; c.dataset.count = n;
    cb.setAttribute("aria-label", n ? `Checkout: ${n} ${n === 1 ? "box" : "boxes"} in your cart` : "Cart: empty");
    [...primaries, ...$$("[data-quick-buy]")].forEach((b) => {
      b.textContent = n ? `Checkout (${n})` : "Buy now";
      b.classList.toggle("is-checkout", n > 0);
    });
    if (onShop && n) { const a = $("#addToCart"); a.innerHTML = `Add to cart <small data-total></small>`; updateTotal(); }

    list.innerHTML = cart.length ? cart.map((i, idx) => `
      <div class="citem">
        <img src="${PRODUCT.image}" alt="" />
        <div>
          <h4>${PRODUCT.name}</h4>
          <small>${i.plan === "sub" ? "Monthly delivery · free shipping" : "One box"}</small>
          <div class="citem__row">
            <div class="qty" role="group" aria-label="Number of boxes"><button data-i="${idx}" data-d="-1" aria-label="One fewer box">−</button><output>${i.qty}</output><button data-i="${idx}" data-d="1" aria-label="One more box">+</button></div>
            <span class="citem__price">${fmt(i.price * i.qty)}</span>
          </div>
          <button class="citem__remove" data-rm="${idx}">Remove</button>
        </div>
      </div>
      ${i.plan === "once" ? `<button class="upsell" data-upgrade="${idx}">Switch to monthly delivery and save ${fmt((PRODUCT.price - subPrice) * i.qty)}</button>` : ""}`).join("")
      : `<div class="cart__empty"><p>Your cart is empty.</p></div>`;
    $("[data-subtotal]").textContent = fmt(cart.reduce((s, i) => s + i.price * i.qty, 0));
    $("#checkout").hidden = !cart.length;
    try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch {}
  }
  list.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.rm != null) cart.splice(+b.dataset.rm, 1);
    else if (b.dataset.upgrade != null) {
      const it = cart.splice(+b.dataset.upgrade, 1)[0];
      const sub = cart.find((i) => i.plan === "sub");
      if (sub) sub.qty = clamp(sub.qty + it.qty, 1, 10); else cart.push({ plan: "sub", qty: it.qty, price: subPrice });
      toast("Switched to monthly delivery. You save 15%.");
    } else { const it = cart[+b.dataset.i]; it.qty = clamp(it.qty + +b.dataset.d, 0, 10); if (!it.qty) cart.splice(+b.dataset.i, 1); }
    render();
  });
  $("#checkout").addEventListener("click", () => toast("Checkout is almost ready. Connect your payment provider to go live."));
  render();

  function toast(msg) {
    const t = $(".toast"); t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("is-on"), 4000);
  }
})();
