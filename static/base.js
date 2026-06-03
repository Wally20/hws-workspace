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

const sidebarToggle = document.querySelector("#sidebarToggle");
const sidebarStorageKey = "hws-sidebar-collapsed";

function setSidebarCollapsed(isCollapsed, options = {}) {
  const persist = options.persist !== false;
  document.body.classList.toggle("sidebar-collapsed", Boolean(isCollapsed));
  if (sidebarToggle) {
    sidebarToggle.setAttribute("aria-expanded", isCollapsed ? "false" : "true");
    sidebarToggle.setAttribute("aria-label", isCollapsed ? "Sidebar uitklappen" : "Sidebar inklappen");
  }
  if (persist) {
    try {
      window.localStorage.setItem(sidebarStorageKey, isCollapsed ? "1" : "0");
    } catch (error) {
      // localStorage can be unavailable in private or locked-down browser modes.
    }
  }
}

function getSidebarCollapsed() {
  return document.body.classList.contains("sidebar-collapsed");
}

try {
  setSidebarCollapsed(window.localStorage.getItem(sidebarStorageKey) === "1", { persist: false });
} catch (error) {
  setSidebarCollapsed(false, { persist: false });
}

sidebarToggle?.addEventListener("click", () => {
  setSidebarCollapsed(!getSidebarCollapsed());
});

window.HwsSidebar = {
  isCollapsed: getSidebarCollapsed,
  setCollapsed: setSidebarCollapsed,
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});
  });
}
