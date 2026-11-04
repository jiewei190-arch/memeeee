/* SHOGA — The Confidence Ritual */
(() => {
  "use strict";

  // ---- Store config: edit prices/currency here ----
  const PRODUCT = {
    id: "white-peach",
    name: "White Peach Collagen",
    image: "assets/product-peach.jpg",
    price: 58.0,          // one-time price
    subDiscount: 0.15,    // subscription saving
    currency: "USD",
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: PRODUCT.currency }).format(n);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---------- Loader ----------
  const loader = $(".loader");
  const bar = $(".loader__line i");
  const media = [...$$("img:not([loading=lazy])"), $(".hero__video")].filter(Boolean);
  let loaded = 0;
  const bump = () => { loaded++; bar.style.transform = `scaleX(${clamp(loaded / media.length, 0, 1)})`; };
  media.forEach((m) => {
    if (m.tagName === "VIDEO") {
      if (m.readyState >= 2) bump(); else { m.addEventListener("loadeddata", bump, { once: true }); m.addEventListener("error", bump, { once: true }); }
    } else if (m.complete) bump(); else { m.addEventListener("load", bump, { once: true }); m.addEventListener("error", bump, { once: true }); }
  });
  const start = performance.now();
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true;
    bar.style.transform = "scaleX(1)";
    const wait = Math.max(0, 1500 - (performance.now() - start));
    setTimeout(() => {
      loader.classList.add("is-done");
      document.body.classList.remove("is-loading");
      setTimeout(() => document.body.classList.add("is-ready"), 250);
      setTimeout(() => loader.remove(), 1400);
    }, wait);
  };
  const poll = setInterval(() => { if (loaded >= media.length) { clearInterval(poll); finish(); } }, 100);
  setTimeout(() => { clearInterval(poll); finish(); }, 4500); // never block longer than this

  // ---------- Cursor ----------
  if (finePointer && !reduced) {
    document.body.classList.add("has-cursor");
    const cur = $(".cursor"), dot = $(".cursor__dot"), ring = $(".cursor__ring");
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; cur.classList.add("is-live"); dot.style.transform = `translate(${mx}px,${my}px)`; }, { passive: true });
    (function loop() { rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16; ring.style.transform = `translate(${rx}px,${ry}px)`; requestAnimationFrame(loop); })();
    document.addEventListener("pointerover", (e) => {
      const t = e.target;
      cur.classList.toggle("is-view", !!t.closest("[data-cursor=view]"));
      cur.classList.toggle("is-hover", !!t.closest("a, button, summary, label, input"));
    });
    document.documentElement.addEventListener("pointerleave", () => cur.classList.remove("is-live"));
  }

  // ---------- Nav ----------
  const nav = $(".nav");
  let lastY = scrollY;
  const onNav = () => {
    const y = scrollY;
    nav.classList.toggle("is-scrolled", y > 40);
    nav.classList.toggle("is-hidden", y > lastY && y > innerHeight * 0.8 && !document.body.classList.contains("lock"));
    lastY = y;
  };

  const menuBtn = $(".menu-toggle"), menu = $(".mobile-menu");
  const setMenu = (open) => {
    menuBtn.setAttribute("aria-expanded", open);
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", !open);
    document.body.classList.toggle("lock", open);
  };
  menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));

  // ---------- Hero light ----------
  const hero = $(".hero");
  if (finePointer) {
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", `${e.clientX - r.left}px`);
      hero.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  }
  const heroVideo = $(".hero__video");

  // ---------- Split helpers ----------
  const wordify = (el) => {
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) frag.append(" ");
            else { const s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.append(s); }
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    return $$(".w", el);
  };
  const manifestoWords = wordify($("[data-words]"));

  $$("[data-split-lines]").forEach((el) => {
    const lines = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = lines.map((l) => `<span class="line-mask"><span>${l.trim()}</span></span>`).join("");
  });

  // ---------- Reveal on scroll ----------
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal, .formula, .final, .band").forEach((el) => io.observe(el));

  // Lazy band video
  const band = $("[data-lazy-video]");
  if (band) {
    const vio = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        const src = $("source", band);
        if (src.dataset.src) { src.src = src.dataset.src; delete src.dataset.src; band.load(); }
        band.play().catch(() => {});
      } else band.pause();
    }, { rootMargin: "200px" });
    vio.observe(band);
  }

  // ---------- Scroll-driven scenes ----------
  const manifesto = $(".manifesto");
  const buying = $(".buying"), track = $(".buying__track"), bprog = $(".buying__progress i");
  const aboutImg = $(".about__img img");
  const wide = matchMedia("(min-width: 861px)");

  const progressOf = (el) => {
    const r = el.getBoundingClientRect();
    return clamp(-r.top / (r.height - innerHeight), 0, 1);
  };

  let ticking = false;
  const onScroll = () => {
    onNav();
    const vh = innerHeight;

    // hero video subtle zoom/fade
    if (!reduced) {
      const hp = clamp(scrollY / vh, 0, 1);
      heroVideo.style.transform = `scale(${1.08 + hp * 0.12}) translateY(${hp * 8}%)`;
    }

    // manifesto word reveal
    const mp = progressOf(manifesto);
    const count = Math.round(mp * 1.15 * manifestoWords.length);
    manifestoWords.forEach((w, i) => w.classList.toggle("on", i < count));

    // horizontal track
    if (wide.matches) {
      const bp = progressOf(buying);
      const dist = track.scrollWidth - innerWidth;
      track.style.transform = `translate3d(${-dist * bp}px,0,0)`;
      bprog.style.transform = `scaleX(${bp})`;
    }

    // about parallax
    if (!reduced && aboutImg) {
      const r = aboutImg.parentElement.getBoundingClientRect();
      const p = clamp((vh - r.top) / (vh + r.height), 0, 1);
      aboutImg.style.transform = `translateY(${-p * 20}%)`;
    }
    ticking = false;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  // ---------- Magnetic + tilt ----------
  if (finePointer && !reduced) {
    $$(".magnetic").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; el.style.transition = "transform .6s cubic-bezier(.22,1,.36,1)"; });
      el.addEventListener("pointerenter", () => { el.style.transition = "transform .15s linear, color .5s"; });
    });
    $$(".tilt").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(900px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg)`;
      });
      el.addEventListener("pointerleave", () => (el.style.transform = ""));
    });
  }

  // ---------- Gallery ----------
  const mainImg = $("#shopMain");
  $$(".shop__thumbs button").forEach((b) => b.addEventListener("click", () => {
    if (b.classList.contains("is-active")) return;
    $$(".shop__thumbs button").forEach((x) => x.classList.remove("is-active"));
    b.classList.add("is-active");
    mainImg.classList.add("swap");
    setTimeout(() => { mainImg.src = b.dataset.src; mainImg.alt = b.dataset.alt; mainImg.onload = () => mainImg.classList.remove("swap"); }, 300);
  }));

  // ---------- Pricing & quantity ----------
  const subPrice = +(PRODUCT.price * (1 - PRODUCT.subDiscount)).toFixed(2);
  $("[data-price-sub]").innerHTML = `<s>${fmt(PRODUCT.price)}</s>${fmt(subPrice)}`;
  $("[data-price-once]").textContent = fmt(PRODUCT.price);
  let qty = 1;
  const qtyOut = $("#qty");
  const plan = () => $("input[name=plan]:checked").value;
  const unit = () => (plan() === "sub" ? subPrice : PRODUCT.price);
  const updateTotal = () => { qtyOut.textContent = qty; $("[data-total]").textContent = fmt(unit() * qty); };
  $$(".buy [data-qty]").forEach((b) => b.addEventListener("click", () => { qty = clamp(qty + +b.dataset.qty, 1, 10); updateTotal(); }));
  $$("input[name=plan]").forEach((r) => r.addEventListener("change", updateTotal));
  updateTotal();

  // ---------- Cart ----------
  const KEY = "shoga-cart";
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch { cart = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch {} };

  const drawer = $(".cart"), scrim = $(".scrim"), list = $(".cart__items"), countEl = $(".cart-count");
  const openCart = () => {
    scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add("is-on"));
    drawer.classList.add("is-open"); drawer.setAttribute("aria-hidden", "false");
    document.body.classList.add("lock"); $(".cart-close").focus();
  };
  const closeCart = () => {
    scrim.classList.remove("is-on"); setTimeout(() => (scrim.hidden = true), 500);
    drawer.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lock");
  };
  $(".cart-toggle").addEventListener("click", openCart);
  $(".cart-close").addEventListener("click", closeCart);
  scrim.addEventListener("click", closeCart);
  addEventListener("keydown", (e) => { if (e.key === "Escape") { closeCart(); setMenu(false); } });

  const render = () => {
    const n = cart.reduce((s, i) => s + i.qty, 0);
    countEl.textContent = n; countEl.dataset.count = n;
    if (!cart.length) {
      list.innerHTML = `<div class="cart__empty"><p>Your ritual awaits.</p><span>Nothing here yet.</span></div>`;
    } else {
      list.innerHTML = cart.map((i, idx) => `
        <div class="citem">
          <img src="${PRODUCT.image}" alt="" />
          <div>
            <h4>${PRODUCT.name}</h4>
            <small>${i.plan === "sub" ? "Ritual Subscription · every 30 days" : "One-time purchase"}</small>
            <div class="qty"><button data-i="${idx}" data-d="-1" aria-label="Decrease">−</button><output>${i.qty}</output><button data-i="${idx}" data-d="1" aria-label="Increase">+</button></div>
          </div>
          <div class="citem__right"><span>${fmt(i.price * i.qty)}</span><button class="citem__remove" data-rm="${idx}">Remove</button></div>
        </div>`).join("");
    }
    $("[data-subtotal]").textContent = fmt(cart.reduce((s, i) => s + i.price * i.qty, 0));
    save();
  };
  list.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.rm != null) cart.splice(+b.dataset.rm, 1);
    else { const it = cart[+b.dataset.i]; it.qty = clamp(it.qty + +b.dataset.d, 0, 10); if (!it.qty) cart.splice(+b.dataset.i, 1); }
    render();
  });

  $("#addToCart").addEventListener("click", () => {
    const p = plan();
    const existing = cart.find((i) => i.plan === p);
    if (existing) existing.qty = clamp(existing.qty + qty, 1, 10);
    else cart.push({ plan: p, qty, price: unit() });
    render();
    countEl.classList.remove("bump"); void countEl.offsetWidth; countEl.classList.add("bump");
    openCart();
  });

  const toast = (msg) => {
    const t = $(".toast"); t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("is-on"), 3200);
  };
  $("#checkout").addEventListener("click", () => {
    if (!cart.length) return toast("Your cart is empty — start with one box.");
    toast("Checkout is almost ready. Connect your payment provider to go live.");
  });
  render();

  // ---------- Newsletter ----------
  $(".newsletter").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("#email"), msg = $(".newsletter__msg");
    if (!input.checkValidity() || !input.value) { msg.textContent = "Please enter a valid email."; return; }
    msg.textContent = "Welcome to the ritual. Check your inbox.";
    input.value = "";
  });

  $("#year").textContent = new Date().getFullYear();
})();
