document.querySelectorAll("[data-auto-submit='1']").forEach((element) => {
  element.addEventListener("change", () => {
    if (element instanceof HTMLElement && element.form) {
      element.form.submit();
    }
  });
});

document.querySelectorAll(".social-idea-check-form input[type='checkbox']").forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    if (!(checkbox instanceof HTMLInputElement) || !checkbox.form) {
      return;
    }

    const hiddenInput = checkbox.form.querySelector("input[name='is_scheduled']");
    if (hiddenInput instanceof HTMLInputElement) {
      hiddenInput.value = checkbox.checked ? "1" : "0";
    }
    checkbox.form.submit();
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  });
}
