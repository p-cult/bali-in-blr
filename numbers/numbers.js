/* "in Numbers" slide show: scale the 1920 x 1080 stage to the window and move
   between slides with the buttons, arrow keys, space, Home/End or a swipe.
   The address keeps the slide number (#5), so a link opens on that slide. */
(function () {
  const deck = document.querySelector(".deck");
  const stage = document.querySelector(".stage");
  const slides = Array.from(stage.querySelectorAll(".slide"));
  const current = document.querySelector("[data-current]");
  const prev = document.querySelector('[data-go="prev"]');
  const next = document.querySelector('[data-go="next"]');
  const full = document.querySelector('[data-go="full"]');
  let at = 0;

  function fit() {
    const s = Math.min(deck.clientWidth / 1920, deck.clientHeight / 1080);
    stage.style.transform = "scale(" + s + ") translate(-50%, -50%)";
  }

  function show(i, push) {
    at = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach(function (el, k) {
      const on = k === at;
      el.classList.toggle("is-current", on);
      el.toggleAttribute("inert", !on);
      el.setAttribute("aria-hidden", on ? "false" : "true");
    });
    current.textContent = at + 1;
    prev.disabled = at === 0;
    next.disabled = at === slides.length - 1;
    const hash = "#" + (at + 1);
    if (push && location.hash !== hash) history.replaceState(null, "", hash);
  }

  function fromHash() {
    const n = parseInt(location.hash.slice(1), 10);
    show(isNaN(n) ? 0 : n - 1, false);
  }

  prev.addEventListener("click", function () { show(at - 1, true); });
  next.addEventListener("click", function () { show(at + 1, true); });
  full.addEventListener("click", function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  });
  if (!document.documentElement.requestFullscreen) full.hidden = true;

  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (k === "ArrowRight" || k === "ArrowDown" || k === "PageDown" || k === " ") show(at + 1, true);
    else if (k === "ArrowLeft" || k === "ArrowUp" || k === "PageUp") show(at - 1, true);
    else if (k === "Home") show(0, true);
    else if (k === "End") show(slides.length - 1, true);
    else if (k === "f") full.click();
    else return;
    e.preventDefault();
  });

  let x0 = null, y0 = null;
  deck.addEventListener("touchstart", function (e) {
    if (e.touches.length !== 1) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  deck.addEventListener("touchend", function (e) {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(at + (dx < 0 ? 1 : -1), true);
    x0 = null;
  });

  window.addEventListener("resize", fit);
  window.addEventListener("hashchange", fromHash);
  fit();
  fromHash();
  requestAnimationFrame(function () { requestAnimationFrame(function () { deck.classList.add("is-ready"); }); });
})();
