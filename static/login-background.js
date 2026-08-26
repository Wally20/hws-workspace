(function () {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const saveData = navigator.connection?.saveData === true;
  if (reducedMotion || saveData) {
    document.body.classList.add("login-background-static");
    return;
  }

  const revealRemainingSlides = () => {
    document.body.classList.add("login-background-ready");
  };

  const scheduleReveal = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(revealRemainingSlides, { timeout: 1200 });
      return;
    }
    window.setTimeout(revealRemainingSlides, 250);
  };

  if (document.readyState === "complete") {
    scheduleReveal();
  } else {
    window.addEventListener("load", scheduleReveal, { once: true });
  }
})();
