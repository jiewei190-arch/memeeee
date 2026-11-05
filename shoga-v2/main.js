/* SHOGA v2 — Ritual Club */
(() => {
  "use strict";

  // ---- Store config ----
  const CONFIG = {
    name: "White Peach Collagen",
    image: "assets/product-peach.jpg",
    price: 58.0,         // one box
    clubDiscount: 0.15,  // Ritual Club saving
    currency: "USD",
    shipDay: 1,          // club boxes ship on this day of each month…
    shipHour: 10,        // …at this local hour
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: CONFIG.currency }).format(n);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clubPrice = +(CONFIG.price * (1 - CONFIG.clubDiscount)).toFixed(2);
  const priceFor = (plan) => (plan === "sub" ? clubPrice : CONFIG.price);

  // ---------- Prices ----------
  $$("[data-price-sub]").forEach((el) => (el.textContent = fmt(clubPrice)));
  $$("[data-price-once]").forEach((el) => (el.textContent = fmt(CONFIG.price)));
  $$(".opt [data-price-sub]").forEach((el) => (el.innerHTML = `<s>${fmt(CONFIG.price)}</s>${fmt(clubPrice)}`));

  // ---------- Countdown to the next club shipment ----------
  const cd = $("#countdown");
  const nextShip = () => {
    const now = new Date();
    let t = new Date(now.getFullYear(), now.getMonth(), CONFIG.shipDay, CONFIG.shipHour);
    if (t <= now) t = new Date(now.getFullYear(), now.getMonth() + 1, CONFIG.shipDay, CONFIG.shipHour);
    return t;
  };
  let target = nextShip();
  const tick = () => {
    let s = Math.max(0, Math.floor((target - Date.now()) / 1000));
    if (s === 0) { target = nextShip(); s = Math.floor((target - Date.now()) / 1000); }
    const d = Math.floor(s / 86400), h = Math.floor(s / 3600) % 24, m = Math.floor(s / 60) % 60, sec = s % 60;
    cd.textContent = `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  };
  tick(); setInterval(tick, 1000);

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
  ["how", "film", "white-peach", "formula", "story", "faq"].forEach((id) => { const el = document.getElementById(id); if (el) sio.observe(el); });

  // ---------- Gentle reveals (content is visible without JS) ----------
  if (!reduced) {
    const rio = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in"); rio.unobserve(e.target); }
    }), { threshold: 0.12 });
    $$(".block > :not(.label), .hero__card").forEach((el) => {
      if (el.getBoundingClientRect().top < innerHeight) return; // already on screen: leave it be
      el.classList.add("rv"); rio.observe(el);
    });
  }

  // ---------- Film ----------
  const film = $(".film__video"), play = $(".film__play"), ftime = $(".film__time");
  new IntersectionObserver(([e]) => { if (e.isIntersecting) film.play().catch(() => {}); else film.pause(); }, { threshold: 0.4 }).observe(film);
  film.addEventListener("timeupdate", () => {
    ftime.textContent = `00:${String(Math.floor(film.currentTime)).padStart(2, "0")} / 00:${String(Math.round(film.duration || 10)).padStart(2, "0")}`;
  });
  play.addEventListener("click", () => {
    const on = film.muted;
    film.muted = !on;
    if (on) { film.currentTime = 0; film.play().catch(() => {}); }
    play.setAttribute("aria-pressed", String(on));
    play.innerHTML = on ? "❚❚ <span>Sound on</span>" : "▶ <span>Watch with sound</span>";
  });

  // ---------- Carousel ----------
  const words = [
    "I walked in first.",
    "No filter tonight.",
    "Took the photo. Kept it.",
    "Bare-faced Sunday, and the plans stayed.",
    "Shoulders back. Seen up close.",
  ];
  const quote = $(".carousel__quote"), count = $(".carousel__count");
  let wi = 0, wTimer;
  const show = (i) => {
    wi = (i + words.length) % words.length;
    quote.classList.add("fade");
    setTimeout(() => { quote.textContent = `“${words[wi]}”`; count.textContent = `${wi + 1}/${words.length}`; quote.classList.remove("fade"); }, reduced ? 0 : 300);
  };
  const auto = () => { clearInterval(wTimer); if (!reduced) wTimer = setInterval(() => show(wi + 1), 6000); };
  $$(".carousel__nav").forEach((b) => b.addEventListener("click", () => { show(wi + +b.dataset.dir); auto(); }));
  quote.textContent = `“${words[0]}”`; count.textContent = `1/${words.length}`; auto();

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
    setTimeout(() => $("button, input", el)?.focus(), 50);
  };
  const close = (instant) => {
    if (!openEl) return;
    const el = openEl; openEl = null;
    scrim.classList.remove("is-on"); el.classList.remove("is-on");
    document.body.classList.remove("lock");
    const hide = () => { el.hidden = true; if (!openEl) scrim.hidden = true; };
    instant === true ? hide() : setTimeout(hide, 450);
    lastFocus?.focus?.();
  };
  scrim.addEventListener("click", close);
  $$(".join__close").forEach((b) => b.addEventListener("click", close));
  addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); setMenu(false); } });
  $$("[data-join]").forEach((b) => b.addEventListener("click", () => open(join)));
  $(".cart-toggle").addEventListener("click", () => open(cartEl));

  // ---------- Join card ----------
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
    $(".cart-count").textContent = cart.reduce((s, i) => s + i.qty, 0);
    list.innerHTML = cart.length ? cart.map((i, idx) => `
      <div class="citem">
        <img src="${CONFIG.image}" alt="" />
        <div><b>${CONFIG.name}</b><small>${i.plan === "sub" ? "Ritual Club · every 30 days" : "One box"}</small>
          <div class="qty"><button data-i="${idx}" data-d="-1" aria-label="Fewer">−</button><output>${i.qty}</output><button data-i="${idx}" data-d="1" aria-label="More">+</button></div></div>
        <div class="citem__price"><span>${fmt(i.price * i.qty)}</span><button class="citem__rm" data-rm="${idx}">Remove</button></div>
      </div>
      ${i.plan === "once" ? `<button class="upsell" data-up="${idx}">Join the Ritual Club instead and save ${fmt((CONFIG.price - clubPrice) * i.qty)}, with free shipping →</button>` : ""}`).join("")
      : `<p class="cart__empty">Your ritual starts with one box.</p>`;
    $("[data-subtotal]").textContent = fmt(cart.reduce((s, i) => s + i.price * i.qty, 0));
    save();
  };
  list.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.rm != null) cart.splice(+b.dataset.rm, 1);
    else if (b.dataset.up != null) {
      const it = cart.splice(+b.dataset.up, 1)[0];
      const sub = cart.find((i) => i.plan === "sub");
      if (sub) sub.qty = clamp(sub.qty + it.qty, 1, 10); else cart.push({ plan: "sub", qty: it.qty, price: clubPrice });
      toast("Welcome to the Ritual Club. You're saving 15%.");
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
  $("#checkout").addEventListener("click", () => toast(cart.length ? "Checkout is almost ready. Connect your payment provider to go live." : "Your cart is empty."));
  render();

  // ---------- Misc ----------
  function toast(msg) {
    const t = $(".toast"); t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("is-on"), 3200);
  }
  $(".newsletter").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#email"), msg = $(".newsletter__msg");
    if (!input.value || !input.checkValidity()) { msg.textContent = "Please enter a valid email."; return; }
    msg.textContent = "You're on the list. First letter arrives with the next batch.";
    input.value = "";
  });
  $("#year").textContent = new Date().getFullYear();
})();
