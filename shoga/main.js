/* SHOGA — The Confidence Ritual
   One script for every page; each feature runs only if its markup is present. */
(() => {
  "use strict";

  // ---- Store config: edit prices/currency here ----
  const PRODUCT = {
    id: "white-peach",
    name: "White Peach Collagen",
    image: "assets/product-peach.jpg",
    price: 58.0,          // one-time price
    subDiscount: 0.15,    // Ritual Club saving
    currency: "USD",
  };

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const fmt = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: PRODUCT.currency }).format(n);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const store = {
    get(k, s = localStorage) { try { return s.getItem(k); } catch { return null; } },
    set(k, v, s = localStorage) { try { s.setItem(k, v); } catch {} },
  };
  const subPrice = +(PRODUCT.price * (1 - PRODUCT.subDiscount)).toFixed(2);

  // ---------- Smooth scroll (Lenis) ----------
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ duration: 1.25, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
  }
  function lockScroll(on) {
    document.body.classList.toggle("lock", on);
    if (lenis) on ? lenis.stop() : lenis.start();
  }

  // ---------- Loader (home page, first visit per session) ----------
  const loader = $(".loader");
  const ready = () => {
    document.body.classList.remove("is-loading");
    if (lenis) lenis.start();
    requestAnimationFrame(() => document.body.classList.add("is-ready"));
  };
  let sessionStore = null;
  try { sessionStore = sessionStorage; } catch {}
  if (!loader) ready();
  else if (sessionStore && store.get("shoga-seen", sessionStore)) { loader.remove(); ready(); }
  else {
    store.set("shoga-seen", "1", sessionStore || undefined);
    if (lenis) lenis.stop();
    const bar = $(".loader__line i");
    const media = [...$$("img:not([loading=lazy])"), $(".hero__video")].filter(Boolean);
    let loaded = 0, finished = false;
    const bump = () => { loaded++; bar.style.transform = `scaleX(${clamp(loaded / media.length, 0, 1)})`; };
    media.forEach((m) => {
      const done = m.tagName === "VIDEO" ? m.readyState >= 2 : m.complete;
      if (done) bump();
      else { m.addEventListener(m.tagName === "VIDEO" ? "loadeddata" : "load", bump, { once: true }); m.addEventListener("error", bump, { once: true }); }
    });
    const t0 = performance.now();
    const finish = () => {
      if (finished) return; finished = true;
      bar.style.transform = "scaleX(1)";
      setTimeout(() => {
        loader.classList.add("is-done");
        setTimeout(ready, 250);
        setTimeout(() => loader.remove(), 1400);
      }, Math.max(0, 1200 - (performance.now() - t0)));
    };
    const poll = setInterval(() => { if (loaded >= media.length) { clearInterval(poll); finish(); } }, 100);
    setTimeout(() => { clearInterval(poll); finish(); }, 3500);
  }

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
    if (open === (menuBtn.getAttribute("aria-expanded") === "true")) return;
    menuBtn.setAttribute("aria-expanded", open);
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", !open);
    lockScroll(open);
  };
  menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));

  // In-page anchors glide; links to other pages navigate normally.
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !url.hash) return;
    const target = url.hash === "#top" ? 0 : $(url.hash);
    if (target == null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else if (target === 0) scrollTo({ top: 0, behavior: "smooth" });
    else target.scrollIntoView({ behavior: "smooth" });
  });

  // ---------- Hero light ----------
  const hero = $(".hero");
  if (hero && finePointer) {
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--mx", `${e.clientX - r.left}px`);
      hero.style.setProperty("--my", `${e.clientY - r.top}px`);
    });
  }

  // ---------- Reveal on scroll ----------
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal, .formula, .final, .footer__mark").forEach((el) => io.observe(el));

  // Manifesto: wrap words so they can light up with scroll
  const manifestoText = $("[data-words]");
  const manifestoWords = [];
  if (manifestoText) {
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(" "); return; }
          const s = document.createElement("span"); s.className = "w"; s.textContent = part; frag.append(s); manifestoWords.push(s);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
    walk(manifestoText);
  }

  // Headings: split into characters for the staggered rise
  $$(".display, .final__title").forEach((el) => {
    let i = 0;
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(" "); return; }
          const w = document.createElement("span"); w.className = "word"; w.setAttribute("aria-hidden", "true");
          [...part].forEach((c) => { const ch = document.createElement("span"); ch.className = "ch"; ch.style.setProperty("--i", i++); ch.textContent = c; w.append(ch); });
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
    });
    walk(el);
    el.classList.add("chars");
    io.observe(el);
  });

  // Image wipes. A fully clipped element never reports as intersecting, so watch its parent.
  const wio = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    $$(":scope > .wipe", e.target).forEach((w) => w.classList.add("in"));
    wio.unobserve(e.target);
  }), { threshold: 0.12 });
  $$(".shop__main, .step__img, .about__img, .club-teaser__img").forEach((el) => { el.classList.add("wipe"); wio.observe(el.parentElement); });

  // Count-up facts
  const cio = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    cio.unobserve(e.target);
    const el = e.target, to = +el.dataset.count, suf = el.dataset.suffix || "", t0 = performance.now();
    (function tick(now) {
      const p = clamp((now - t0) / 1600, 0, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suf;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }), { threshold: 0.6 });
  if (!reduced) $$("[data-count]").forEach((el) => { el.textContent = "0" + (el.dataset.suffix || ""); cio.observe(el); });

  // ---------- Film: plays by itself while on screen ----------
  const film = $(".film");
  if (film) {
    const v = $(".film__video", film), caps = $$(".film__cap", film), time = $(".film__time", film),
          bar = $(".film__bar i", film), sound = $(".film__sound", film);
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.35 }).observe(film);
    const tick = () => {
      const t = v.currentTime || 0, d = v.duration || 10;
      time.textContent = `00:${String(Math.floor(t)).padStart(2, "0")}`;
      bar.style.transform = `scaleX(${t / d})`;
      caps.forEach((c) => c.classList.toggle("is-on", t >= +c.dataset.in && t < +c.dataset.out));
      if (!v.paused) requestAnimationFrame(tick);
    };
    v.addEventListener("play", () => requestAnimationFrame(tick));
    sound.addEventListener("click", () => {
      v.muted = !v.muted;
      if (!v.muted) v.play().catch(() => {});
      sound.setAttribute("aria-pressed", String(!v.muted));
      $("span", sound).textContent = v.muted ? "Sound off" : "Sound on";
    });
  }

  // ---------- Marquee ----------
  const marqRows = $$(".marquee__row").map((row, i) => ({ row, inner: $(".marquee__inner", row), x: 0, dir: i % 2 ? 1 : -1 }));
  if (marqRows.length && !reduced) document.body.classList.add("js-marquee");

  // ---------- Scroll-driven scenes ----------
  const manifesto = $(".manifesto");
  const buying = $(".buying"), track = $(".buying__track"), bprog = $(".buying__progress i");
  const feels = $$(".feel");
  const aboutImg = $(".about__img img");
  const heroVideo = $(".hero__video");
  const heroLetters = $$(".hero__title span"), heroContent = $(".hero__content"), benefits = $(".benefits");
  const unbox = $(".unbox");
  const unMedia = $(".unbox__media"), unImg = $(".unbox__media img"), unShade = $(".unbox__shade"),
        unLines = $$(".unbox__line"), unCap = $(".unbox__cap");
  const speedEls = $$("[data-speed], .final__bg img");
  const progressBar = $(".progress i");
  const stepsEl = $(".steps");
  const buybar = $(".buybar"), buyAnchor = $("#buy");
  const root = document.documentElement;
  const wide = matchMedia("(min-width: 861px)");
  const progressOf = (el) => {
    const r = el.getBoundingClientRect();
    return clamp(-r.top / (r.height - innerHeight), 0, 1);
  };

  let lastScroll = scrollY, vel = 0, skew = 0;
  const update = () => {
    const vh = innerHeight, y = scrollY;
    onNav();
    const raw = lenis ? lenis.velocity : y - lastScroll;
    lastScroll = y;
    vel += (raw - vel) * 0.15;

    progressBar.style.transform = `scaleX(${clamp(y / Math.max(1, root.scrollHeight - vh), 0, 1)})`;

    if (manifesto) {
      const count = Math.round(progressOf(manifesto) * 1.15 * manifestoWords.length);
      manifestoWords.forEach((w, i) => w.classList.toggle("on", i < count));
    }

    if (buybar && buyAnchor) buybar.classList.toggle("is-on", buyAnchor.getBoundingClientRect().bottom < 0);

    if (!reduced) {
      if (hero) {
        const hp = clamp(y / vh, 0, 1);
        if (hp < 1 || heroContent.style.opacity !== "0") {
          heroVideo.style.transform = `scale(${1.08 + hp * 0.18}) translateY(${hp * 10}%)`;
          heroLetters.forEach((l, i) => {
            const off = i - (heroLetters.length - 1) / 2;
            l.style.transform = `translate3d(${off * hp * 14}vw, ${Math.abs(off) * hp * -6}vh, 0) rotate(${off * hp * 6}deg)`;
          });
          heroContent.style.transform = `translateY(${hp * -18}vh)`;
          heroContent.style.opacity = String(clamp(1 - hp * 1.5, 0, 1));
          benefits.style.opacity = String(clamp(1 - hp * 2.5, 0, 1));
        }
      }

      if (unbox) {
        const up = progressOf(unbox);
        const g = 1 - Math.pow(1 - seg(up, 0, 0.55), 3);
        const ins = wide.matches ? [24, 30] : [28, 12];
        unMedia.style.clipPath = `inset(${lerp(ins[0], 0, g)}% ${lerp(ins[1], 0, g)}% round ${lerp(12, 0, g)}px)`;
        unImg.style.transform = `scale(${lerp(1.35, 1, g)})`;
        unShade.style.opacity = String(seg(up, 0.3, 0.6));
        const in1 = seg(up, 0.05, 0.25), out1 = seg(up, 0.45, 0.58), a2 = seg(up, 0.6, 0.78);
        unLines[0].style.opacity = String(in1 * (1 - out1));
        unLines[0].style.transform = `translateY(${(1 - in1) * 40 - out1 * 40}px)`;
        unLines[1].style.opacity = String(a2);
        unLines[1].style.transform = `translateY(${(1 - a2) * 40}px) scale(${lerp(0.94, 1, a2)})`;
        unCap.style.opacity = String(seg(up, 0.78, 0.92));
      }

      // parallax via the independent `translate` property (doesn't fight reveal transforms)
      speedEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const sp = el.dataset.speed ? +el.dataset.speed : -0.12;
        el.style.translate = `0 ${(r.top + r.height / 2 - vh / 2) * sp}px`;
      });

      if (aboutImg) {
        const r = aboutImg.parentElement.getBoundingClientRect();
        aboutImg.style.transform = `translateY(${-clamp((vh - r.top) / (vh + r.height), 0, 1) * 20}%)`;
      }

      if (stepsEl) {
        skew += (clamp(vel * 0.12, -4, 4) - skew) * 0.2;
        stepsEl.style.setProperty("--skew", `${skew.toFixed(2)}deg`);
      }

      marqRows.forEach((m) => {
        const half = m.inner.scrollWidth / 2 || 1;
        m.x += m.dir * (0.6 + Math.abs(vel) * 0.35) * (vel < -0.5 ? -1 : 1);
        if (m.x <= -half) m.x += half;
        if (m.x > 0) m.x -= half;
        m.inner.style.transform = `translate3d(${m.x}px,0,0)`;
        m.row.style.transform = `skewX(${clamp(-vel * 0.25, -10, 10)}deg)`;
      });
    }

    if (buying) {
      if (wide.matches) {
        const bp = progressOf(buying);
        track.style.transform = `translate3d(${-(track.scrollWidth - innerWidth) * bp}px,0,0)`;
        bprog.style.transform = `scaleX(${bp})`;
        if (!reduced) feels.forEach((f) => {
          const r = f.getBoundingClientRect();
          f.firstElementChild.firstElementChild.style.translate = `${(r.left - innerWidth / 2) * -0.06}px 0`;
          f.lastElementChild.style.translate = `${(r.left - innerWidth / 3) * 0.08}px 0`;
        });
      } else track.style.transform = "";
    }
  };
  const frame = (t) => { if (lenis) lenis.raf(t); update(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);

  // ---------- Magnetic + tilt ----------
  if (finePointer && !reduced) {
    $$(".magnetic").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
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

  // ---------- Prices shown anywhere ----------
  $$("[data-price-sub]").forEach((el) => (el.innerHTML = `<s>${fmt(PRODUCT.price)}</s>${fmt(subPrice)}`));
  $$("[data-price-sub-only]").forEach((el) => (el.textContent = fmt(subPrice)));
  $$("[data-price-once]").forEach((el) => (el.textContent = fmt(PRODUCT.price)));

  // ---------- Gallery ----------
  const mainImg = $("#shopMain");
  $$(".shop__thumbs button").forEach((b) => b.addEventListener("click", () => {
    if (b.classList.contains("is-active")) return;
    $$(".shop__thumbs button").forEach((x) => x.classList.remove("is-active"));
    b.classList.add("is-active");
    mainImg.classList.add("swap");
    setTimeout(() => { mainImg.onload = () => mainImg.classList.remove("swap"); mainImg.src = b.dataset.src; mainImg.alt = b.dataset.alt; }, 300);
  }));

  // ---------- Cart (shared across pages via localStorage) ----------
  const KEY = "shoga-cart";
  let cart = [];
  try { cart = JSON.parse(store.get(KEY)) || []; } catch { cart = []; }
  const priceFor = (plan) => (plan === "sub" ? subPrice : PRODUCT.price);
  cart.forEach((i) => (i.price = priceFor(i.plan))); // keep stored prices in sync with config

  const drawer = $(".cart"), scrim = $(".scrim"), list = $(".cart__items"), countEl = $(".cart-count");
  const openCart = () => {
    scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add("is-on"));
    drawer.classList.add("is-open"); drawer.setAttribute("aria-hidden", "false");
    lockScroll(true); $(".cart-close").focus();
  };
  const closeCart = () => {
    if (!drawer.classList.contains("is-open")) return;
    scrim.classList.remove("is-on"); setTimeout(() => (scrim.hidden = true), 500);
    drawer.classList.remove("is-open"); drawer.setAttribute("aria-hidden", "true");
    lockScroll(false);
  };
  $(".cart-toggle").addEventListener("click", openCart);
  $(".cart-close").addEventListener("click", closeCart);
  scrim.addEventListener("click", closeCart);
  addEventListener("keydown", (e) => { if (e.key === "Escape") { closeCart(); setMenu(false); } });

  const render = () => {
    const n = cart.reduce((s, i) => s + i.qty, 0);
    countEl.textContent = n; countEl.dataset.count = n;
    if (!cart.length) {
      list.innerHTML = `<div class="cart__empty"><p>Your ritual awaits.</p><span>Nothing here yet.</span>
        <a class="btn btn--outline" href="shop.html"><span>Shop White Peach</span></a></div>`;
    } else {
      list.innerHTML = cart.map((i, idx) => `
        <div class="citem">
          <img src="${PRODUCT.image}" alt="" />
          <div>
            <h4>${PRODUCT.name}</h4>
            <small>${i.plan === "sub" ? "Ritual Club · every 30 days" : "One-time purchase"}</small>
            <div class="qty"><button data-i="${idx}" data-d="-1" aria-label="Decrease">−</button><output>${i.qty}</output><button data-i="${idx}" data-d="1" aria-label="Increase">+</button></div>
          </div>
          <div class="citem__right"><span>${fmt(i.price * i.qty)}</span><button class="citem__remove" data-rm="${idx}">Remove</button></div>
        </div>
        ${i.plan === "once" ? `<button class="upsell" data-upgrade="${idx}">
          <b>Switch to the Ritual Club and save ${fmt((PRODUCT.price - subPrice) * i.qty)}</b>
          <span>Free shipping, cancel anytime</span></button>` : ""}`).join("");
    }
    $("[data-subtotal]").textContent = fmt(cart.reduce((s, i) => s + i.price * i.qty, 0));
    store.set(KEY, JSON.stringify(cart));
  };
  list.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.rm != null) cart.splice(+b.dataset.rm, 1);
    else if (b.dataset.upgrade != null) {
      const it = cart.splice(+b.dataset.upgrade, 1)[0];
      const sub = cart.find((i) => i.plan === "sub");
      if (sub) sub.qty = clamp(sub.qty + it.qty, 1, 10); else cart.push({ plan: "sub", qty: it.qty, price: subPrice });
      toast("Welcome to the Ritual Club. You're saving 15%.");
    } else { const it = cart[+b.dataset.i]; it.qty = clamp(it.qty + +b.dataset.d, 0, 10); if (!it.qty) cart.splice(+b.dataset.i, 1); }
    render();
  });

  // Product purchase controls (shop page)
  const addBtn = $("#addToCart");
  if (addBtn) {
    let qty = 1;
    const plan = () => $("input[name=plan]:checked").value;
    const updateTotal = () => {
      $("#qty").textContent = qty;
      $$("[data-total]").forEach((el) => (el.textContent = fmt(priceFor(plan()) * qty)));
      const bp = $(".buybar__plan"); if (bp) bp.textContent = plan() === "sub" ? "Ritual Club" : "One-time";
    };
    $$(".buy [data-qty]").forEach((b) => b.addEventListener("click", () => { qty = clamp(qty + +b.dataset.qty, 1, 10); updateTotal(); }));
    $$("input[name=plan]").forEach((r) => r.addEventListener("change", updateTotal));
    updateTotal();
    const add = () => {
      const p = plan();
      const existing = cart.find((i) => i.plan === p);
      if (existing) existing.qty = clamp(existing.qty + qty, 1, 10);
      else cart.push({ plan: p, qty, price: priceFor(p) });
      render();
      countEl.classList.remove("bump"); void countEl.offsetWidth; countEl.classList.add("bump");
      openCart();
    };
    addBtn.addEventListener("click", add);
    $$("[data-add]").forEach((b) => b.addEventListener("click", add));
  }

  const toast = (msg) => {
    const t = $(".toast"); t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("is-on"), 3200);
  };
  $("#checkout").addEventListener("click", () => {
    if (!cart.length) return toast("Your cart is empty. Start with one box.");
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
