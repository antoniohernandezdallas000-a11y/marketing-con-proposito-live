// Visor de la presentación + encuesta en vivo en la diapositiva 24.
(function () {
  const stage = document.getElementById("stage");
  const slides = Array.from(stage.querySelectorAll(":scope > section"));
  const counter = document.getElementById("counter");
  let i = 0;

  /* ---------- Íconos (<x-icon> del formato de diapositivas) ---------- */
  const P = {
    Play: '<polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/>',
    Search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    Chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    Users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    Warning: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    CheckCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    Lightbulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z"/>',
    Verified: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
    Trust: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/>',
    Clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    Star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    Book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    Tool: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    ThumbsUp: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
    Chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    Check: '<polyline points="20 6 9 17 4 12"/>',
    Activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    Lightning: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  };
  document.querySelectorAll("x-icon").forEach((el) => {
    const s = el.getAttribute("style") || "";
    const w = (s.match(/width:\s*(\d+)px/) || [])[1] || 48;
    const h = (s.match(/height:\s*(\d+)px/) || [])[1] || w;
    const c = (s.match(/(?:^|;)\s*color:\s*([^;]+)/) || [])[1] || "currentColor";
    const svg = `<svg viewBox="-6 -6 36 36" width="${w}" height="${h}" fill="none" stroke="${c}" color="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">${P[el.getAttribute("name")] || ""}</svg>`;
    el.outerHTML = svg;
  });

  /* ---------- Navegación ---------- */
  function fit() {
    const s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  function go(n) {
    i = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach((s, k) => s.classList.toggle("on", k === i));
    counter.textContent = `${i + 1} / ${slides.length}`;
    history.replaceState(null, "", "#" + (i + 1));
    if (slides[i].id === "encuesta") poll.connect();
  }
  window.addEventListener("resize", fit);
  window.addEventListener("hashchange", () => { const n = parseInt(location.hash.slice(1), 10); if (!isNaN(n) && n - 1 !== i) go(n - 1); });
  document.addEventListener("keydown", (e) => {
    if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); go(i + 1); }
    else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); go(i - 1); }
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(slides.length - 1);
    else if (e.key === "f" || e.key === "F") {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.();
    }
  });
  document.addEventListener("click", (e) => { if (e.target.closest("a,button,.poll-row")) return; go(e.clientX > window.innerWidth / 2 ? i + 1 : i - 1); });
  let tx = null;
  document.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener("touchend", (e) => { if (tx === null) return; const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 40) go(d < 0 ? i + 1 : i - 1); tx = null; });

  /* ---------- Encuesta en vivo (diapositiva 24) ---------- */
  const poll = (function () {
    const sec = document.getElementById("encuesta");
    let socket = null, timer = null;
    if (!sec) return { connect() {} };
    const ps = Array.from(sec.querySelectorAll("p"));
    const pcts = ps.filter((p) => /^\d+%$/.test(p.textContent.trim()));
    const totalEl = ps.find((p) => /^VOTOS REGISTRADOS/i.test(p.textContent.trim()));
    const hint = ps.find((p) => /Toca una opción/i.test(p.textContent));
    const keys = ["A", "B", "C"];
    const fills = pcts.map((p) => {
      const row = p.parentElement;
      row.classList.add("poll-row");
      row.style.position = "relative";
      row.style.overflow = "hidden";
      Array.from(row.children).forEach((c) => { c.style.position = c.style.position || "relative"; c.style.zIndex = 1; });
      const f = document.createElement("div");
      f.className = "poll-fill";
      row.prepend(f);
      return f;
    });
    fetch("/api/info").then((r) => r.json()).then(({ url }) => {
      if (hint) hint.textContent = "Vota desde tu teléfono: " + url.replace(/^https?:\/\//, "") + "/votar · Los resultados se actualizan en vivo.";
    }).catch(() => {});

    const shown = { A: 0, B: 0, C: 0, total: 0 };
    function animate(el, from, to, fmt) {
      const t0 = performance.now(), dur = 700;
      (function step(t) {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmt(Math.round(from + (to - from) * e));
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }
    function paint(r) {
      keys.forEach((k, n) => {
        if (!pcts[n]) return;
        const v = r.porcentaje[k] || 0;
        animate(pcts[n], shown[k], v, (x) => x + "%");
        fills[n].style.width = v + "%";
        shown[k] = v;
      });
      if (totalEl && r.total !== shown.total) {
        animate(totalEl, shown.total, r.total, (x) => "VOTOS REGISTRADOS: " + x);
        totalEl.classList.remove("bump"); void totalEl.offsetWidth; totalEl.classList.add("bump");
        shown.total = r.total;
      }
    }
    return {
      connect() {
        if (socket || timer) return;
        if (window.io) {
          socket = io({ transports: ["websocket", "polling"] });
          socket.on("resultados", paint);
        }
        // Respaldo por polling ligero (cada 4 s) si el socket no está conectado
        timer = setInterval(() => {
          if (socket && socket.connected) return;
          fetch("/api/resultados").then((r) => r.json()).then(paint).catch(() => {});
        }, 4000);
        fetch("/api/resultados").then((r) => r.json()).then(paint).catch(() => {});
      },
    };
  })();

  fit();
  /* ---------- QR dinámico (diapositiva 5) ---------- */
  const qrImg = document.getElementById("qr-proposito-img") || document.querySelector("#qr-proposito img");
  const qrUrlText = document.getElementById("qr-proposito-url");
  if (qrImg) {
    qrImg.src = "/qr.svg?t=" + Date.now();
  }
  fetch("/api/info")
    .then((r) => r.json())
    .then(({ url }) => {
      if (qrUrlText && url) {
        qrUrlText.textContent = url.replace(/^https?:\/\//, "");
      }
    })
    .catch(() => {});

  const start = parseInt((location.hash || "").slice(1), 10);
  go(isNaN(start) ? 0 : start - 1);
  // Conectar desde el inicio para que la diapositiva 24 ya tenga datos al llegar
  poll.connect();
})();
