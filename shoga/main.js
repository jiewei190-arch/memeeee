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
      if (lenis) lenis.start();
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
    lockScroll(open);
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

  // ---------- Reveal on scroll ----------
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  $$(".reveal, .formula, .final").forEach((el) => io.observe(el));

  // ---------- Film: video frames scrubbed by scroll ----------
  const FILM = { count: 120, fps: 12, path: (i) => `assets/seq/f${String(i + 1).padStart(3, "0")}.jpg` };
  const film = $(".film"), canvas = $(".film__canvas"), ctx = canvas.getContext("2d");
  const filmCaps = $$(".film__cap"), filmTime = $(".film__time"), filmBar = $(".film__bar i");
  const frames = new Array(FILM.count);
  let drawn = -1, filmFrame = 0, filmLoading = false;

  const loadFrames = () => {
    if (filmLoading) return; filmLoading = true;
    // Load a coarse pass first (every 8th frame) so scrubbing works immediately, then fill the gaps.
    const order = [];
    for (let step = 8; step >= 1; step = step === 1 ? 0 : step / 2)
      for (let i = 0; i < FILM.count; i += step) if (!order.includes(i)) order.push(i);
    let next = 0;
    const worker = () => {
      if (next >= order.length) return;
      const i = order[next++], img = new Image();
      img.decoding = "async";
      img.onload = () => { frames[i] = img; if (Math.abs(i - filmFrame) < 8) drawn = -1; worker(); };
      img.onerror = worker;
      img.src = FILM.path(i);
    };
    for (let k = 0; k < 6; k++) worker(); // 6 parallel requests
  };
  new IntersectionObserver(([e]) => { if (e.isIntersecting) loadFrames(); }, { rootMargin: "1500px 0px" }).observe(film);

  const sizeCanvas = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    drawn = -1;
  };
  sizeCanvas();
  addEventListener("resize", sizeCanvas);

  const nearestFrame = (i) => {
    for (let d = 0; d < FILM.count; d++) {
      if (frames[i - d]) return frames[i - d];
      if (frames[i + d]) return frames[i + d];
    }
    return null;
  };
  const drawFilm = (i) => {
    if (i === drawn) return;
    const img = nearestFrame(i);
    if (!img) return;
    const cw = canvas.width, ch = canvas.height;
    const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight); // object-fit: cover
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    if (frames[i]) drawn = i;
  };

  // ---------- Smooth scroll (Lenis) ----------
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ duration: 1.25, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
    lenis.stop(); // released when the loader finishes
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    const hash = a && a.getAttribute("href");
    if (!hash || hash.length < 2) return;
    const target = hash === "#top" ? 0 : $(hash);
    if (target == null) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else if (target === 0) scrollTo({ top: 0, behavior: "smooth" });
    else target.scrollIntoView({ behavior: "smooth" });
  });
  function lockScroll(on) {
    document.body.classList.toggle("lock", on);
    if (lenis) on ? lenis.stop() : lenis.start();
  }

  // ---------- Split headings into characters ----------
  const splitChars = (el) => {
    let i = 0;
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    const walk = (node) => {
      [...node.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.append(" "); return; }
            const w = document.createElement("span"); w.className = "word"; w.setAttribute("aria-hidden", "true");
            [...part].forEach((c) => {
              const ch = document.createElement("span");
              ch.className = "ch"; ch.style.setProperty("--i", i++); ch.textContent = c; w.append(ch);
            });
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== "BR") walk(n);
      });
    };
    walk(el);
    el.classList.add("chars");
  };
  $$(".display, .final__title").forEach((el) => { splitChars(el); io.observe(el); });

  // ---------- Image wipes ----------
  // A fully clipped element never reports as intersecting, so watch its parent instead.
  const wio = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    $$(":scope > .wipe", e.target).forEach((w) => w.classList.add("in"));
    wio.unobserve(e.target);
  }), { threshold: 0.12 });
  $$(".shop__main, .step__img, .about__img").forEach((el) => { el.classList.add("wipe"); wio.observe(el.parentElement); });
  io.observe($(".footer__mark"));

  // ---------- Count-up facts ----------
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

  // ---------- Marquee (reacts to scroll speed & direction) ----------
  const marqRows = $$(".marquee__row").map((row, i) => ({ row, inner: $(".marquee__inner", row), x: 0, dir: i % 2 ? 1 : -1 }));
  if (!reduced) document.body.classList.add("js-marquee");

  // ---------- Scroll-driven scenes ----------
  const manifesto = $(".manifesto");
  const buying = $(".buying"), track = $(".buying__track"), bprog = $(".buying__progress i");
  const feels = $$(".feel");
  const aboutImg = $(".about__img img");
  const heroLetters = $$(".hero__title span"), heroContent = $(".hero__content"), benefits = $(".benefits");
  const unbox = $(".unbox"), unMedia = $(".unbox__media"), unImg = $(".unbox__media img"),
        unShade = $(".unbox__shade"), unLines = $$(".unbox__line"), unCap = $(".unbox__cap");
  const speedEls = $$("[data-speed], .final__bg img");
  const progressBar = $(".progress i");
  const stepsEl = $(".steps");
  const root = document.documentElement;
  const wide = matchMedia("(min-width: 861px)");

  const progressOf = (el) => {
    const r = el.getBoundingClientRect();
    return clamp(-r.top / (r.height - innerHeight), 0, 1);
  };
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;

  let lastScroll = scrollY, vel = 0, skew = 0;
  const update = () => {
    const vh = innerHeight, y = scrollY;
    onNav();

    // scroll velocity in px/frame, smoothed
    const raw = lenis ? lenis.velocity : y - lastScroll;
    lastScroll = y;
    vel += (raw - vel) * 0.15;

    progressBar.style.transform = `scaleX(${clamp(y / (root.scrollHeight - vh), 0, 1)})`;

    // manifesto word reveal
    const mp = progressOf(manifesto);
    const count = Math.round(mp * 1.15 * manifestoWords.length);
    manifestoWords.forEach((w, i) => w.classList.toggle("on", i < count));

    // film: scroll position -> video frame, plus chapter captions and timecode
    const fr = film.getBoundingClientRect();
    if (fr.bottom > -vh && fr.top < vh * 2) {
      const fp = progressOf(film);
      filmFrame = Math.round(fp * (FILM.count - 1));
      drawFilm(filmFrame);
      const secs = Math.floor((filmFrame / FILM.fps));
      filmTime.textContent = `00:${String(secs).padStart(2, "0")}`;
      filmBar.style.transform = `scaleX(${fp})`;
      filmCaps.forEach((c) => {
        const a = +c.dataset.in, b = +c.dataset.out, f = 0.04;
        const o = Math.min(seg(fp, a, a + f), 1 - seg(fp, b - f, b));
        c.style.opacity = String(o);
        c.style.transform = `translateY(${(1 - o) * (fp < a + f ? 30 : -30)}px)`;
      });
    }

    if (!reduced) {
      // hero: letters fly apart, content lifts and fades, video pushes in
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

      // unbox: product grows from a card to full-bleed, then the two lines swap
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

      // parallax via the independent `translate` property (doesn't fight reveal transforms)
      speedEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const sp = el.dataset.speed ? +el.dataset.speed : -0.12;
        el.style.translate = `0 ${(r.top + r.height / 2 - vh / 2) * sp}px`;
      });

      if (aboutImg) {
        const r = aboutImg.parentElement.getBoundingClientRect();
        const p = clamp((vh - r.top) / (vh + r.height), 0, 1);
        aboutImg.style.transform = `translateY(${-p * 20}%)`;
      }

      // ritual steps lean with scroll speed
      skew += (clamp(vel * 0.12, -4, 4) - skew) * 0.2;
      stepsEl.style.setProperty("--skew", `${skew.toFixed(2)}deg`);

      // marquee: constant drift, boosted and reversed by scrolling
      marqRows.forEach((m) => {
        const half = m.inner.scrollWidth / 2 || 1;
        m.x += m.dir * (0.6 + Math.abs(vel) * 0.35) * (vel < -0.5 ? -1 : 1);
        if (m.x <= -half) m.x += half;
        if (m.x > 0) m.x -= half;
        m.inner.style.transform = `translate3d(${m.x}px,0,0)`;
        m.row.style.transform = `skewX(${clamp(-vel * 0.25, -10, 10)}deg)`;
      });
    }

    // horizontal track + per-card depth parallax
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
  };

  const frame = (t) => { if (lenis) lenis.raf(t); update(); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);

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
    lockScroll(true); $(".cart-close").focus();
  };
  const closeCart = () => {
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
