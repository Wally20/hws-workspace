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

const workspaceNavigation = document.querySelector("#workspaceNavigation");
const workspaceNavigationToggle = workspaceNavigation?.querySelector("[data-navigation-toggle]");
const workspaceNavigationMenu = document.querySelector("#workspaceNavigationMenu");
const workspaceNavigationClose = workspaceNavigationMenu?.querySelector("[data-navigation-close]");
const workspaceNavigationBackdrop = document.querySelector("[data-navigation-backdrop]");
const desktopNavigationBlocks = document.querySelectorAll("[data-desktop-nav-block]");

function setWorkspaceNavigationOpen(isOpen) {
  if (!workspaceNavigation || !(workspaceNavigationToggle instanceof HTMLButtonElement) || !workspaceNavigationMenu) {
    return;
  }

  workspaceNavigation.classList.toggle("is-open", isOpen);
  workspaceNavigationToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  workspaceNavigationToggle.setAttribute("aria-label", isOpen ? "Sluit paginamenu" : "Open paginamenu");
  workspaceNavigationMenu.hidden = !isOpen;
  if (workspaceNavigationBackdrop instanceof HTMLButtonElement) {
    workspaceNavigationBackdrop.hidden = !isOpen;
  }
  document.body.classList.toggle("workspace-navigation-open", isOpen);
}

function closeWorkspaceNavigation() {
  setWorkspaceNavigationOpen(false);
}

workspaceNavigationToggle?.addEventListener("click", () => {
  setWorkspaceNavigationOpen(workspaceNavigationToggle.getAttribute("aria-expanded") !== "true");
});

workspaceNavigationClose?.addEventListener("click", closeWorkspaceNavigation);
workspaceNavigationBackdrop?.addEventListener("click", closeWorkspaceNavigation);

desktopNavigationBlocks.forEach((block) => {
  const toggle = block.querySelector(".workspace-nav-block-toggle");
  if (!(toggle instanceof HTMLButtonElement)) {
    return;
  }

  const setExpanded = (isExpanded) => {
    toggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
  };

  block.addEventListener("mouseenter", () => setExpanded(true));
  block.addEventListener("mouseleave", () => setExpanded(false));
  block.addEventListener("focusin", () => setExpanded(true));
  block.addEventListener("focusout", () => {
    window.requestAnimationFrame(() => setExpanded(block.contains(document.activeElement)));
  });
  block.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    setExpanded(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
});

const desktopNavigationQuery = window.matchMedia("(min-width: 1180px)");
desktopNavigationQuery.addEventListener?.("change", (event) => {
  if (event.matches) {
    closeWorkspaceNavigation();
  }
});

document.addEventListener("click", (event) => {
  if (
    workspaceNavigation
    && workspaceNavigation.classList.contains("is-open")
    && event.target instanceof Node
    && !workspaceNavigation.contains(event.target)
    && !workspaceNavigationMenu?.contains(event.target)
  ) {
    closeWorkspaceNavigation();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && workspaceNavigation?.classList.contains("is-open")) {
    closeWorkspaceNavigation();
    workspaceNavigationToggle?.focus();
  }
});

function normalizeWorkspaceSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getWorkspaceSearchPages() {
  const sourceElement = document.querySelector("#workspaceSearchPages");
  if (!sourceElement) {
    return [];
  }

  try {
    const parsedPages = JSON.parse(sourceElement.textContent || "[]");
    return Array.isArray(parsedPages) ? parsedPages : [];
  } catch (error) {
    return [];
  }
}

function scoreWorkspaceSearchPage(page, queryParts) {
  if (!queryParts.length) {
    return 1;
  }

  const title = normalizeWorkspaceSearchText(page.title);
  const section = normalizeWorkspaceSearchText(page.section);
  const path = normalizeWorkspaceSearchText(page.path);
  const description = normalizeWorkspaceSearchText(page.description);
  const keywords = Array.isArray(page.keywords)
    ? page.keywords.map(normalizeWorkspaceSearchText).join(" ")
    : "";
  const haystack = `${title} ${section} ${path} ${description} ${keywords}`;

  return queryParts.reduce((score, part) => {
    if (!haystack.includes(part)) {
      return -1000;
    }
    if (title === part) {
      return score + 80;
    }
    if (title.startsWith(part)) {
      return score + 48;
    }
    if (path.includes(part)) {
      return score + 30;
    }
    if (section.includes(part)) {
      return score + 18;
    }
    if (keywords.includes(part)) {
      return score + 14;
    }
    return score + 8;
  }, 0);
}

function getWorkspaceSearchPagePath(page) {
  const path = String(page?.path || "").trim();
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

function initWorkspacePageSearch() {
  const pages = getWorkspaceSearchPages();
  if (!pages.length || document.querySelector("[data-workspace-search-root]")) {
    return;
  }

  const sections = ["Alle", ...Array.from(new Set(pages.map((page) => page.section).filter(Boolean)))];
  let selectedSection = "Alle";
  let activeIndex = 0;
  let filteredPages = pages.slice();
  let focusBeforeSearch = null;

  const root = document.createElement("div");
  root.className = "workspace-search-root";
  root.dataset.workspaceSearchRoot = "1";
  root.innerHTML = `
    <button class="workspace-search-fab" type="button" aria-label="Pagina zoeken" aria-expanded="false" aria-controls="workspaceSearchPanel" aria-keyshortcuts="/ Control+K Meta+K" title="Pagina zoeken (/)">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5"></circle>
        <path d="m16 16 4 4"></path>
      </svg>
    </button>
    <button class="workspace-search-backdrop" type="button" data-search-close aria-label="Zoeken sluiten" tabindex="-1" hidden></button>
    <section class="workspace-search-panel" id="workspaceSearchPanel" role="dialog" aria-modal="true" aria-labelledby="workspaceSearchTitle" hidden>
      <div class="workspace-search-header">
        <div>
          <p class="workspace-search-eyebrow">Snel navigeren</p>
          <h2 id="workspaceSearchTitle">Zoek pagina</h2>
        </div>
        <button class="workspace-search-close" type="button" data-search-close aria-label="Zoeken sluiten">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18"></path>
          </svg>
        </button>
      </div>
      <label class="workspace-search-input-wrap" for="workspaceSearchInput">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5"></circle>
          <path d="m16 16 4 4"></path>
        </svg>
        <input id="workspaceSearchInput" type="search" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="workspaceSearchResults" aria-describedby="workspaceSearchMeta" autocomplete="off" placeholder="Zoek op pagina, onderdeel, taak of URL">
      </label>
      <div class="workspace-search-filters" role="group" aria-label="Filter op onderdeel"></div>
      <div class="workspace-search-meta" id="workspaceSearchMeta" aria-live="polite"></div>
      <div class="workspace-search-results" id="workspaceSearchResults" role="listbox" aria-label="Zoekresultaten"></div>
    </section>
  `;

  document.body.appendChild(root);

  const fab = root.querySelector(".workspace-search-fab");
  const panel = root.querySelector(".workspace-search-panel");
  const backdrop = root.querySelector(".workspace-search-backdrop");
  const input = root.querySelector("#workspaceSearchInput");
  const filtersElement = root.querySelector(".workspace-search-filters");
  const metaElement = root.querySelector(".workspace-search-meta");
  const resultsElement = root.querySelector(".workspace-search-results");
  const closeElements = root.querySelectorAll("[data-search-close]");

  function renderFilters() {
    filtersElement.replaceChildren();
    sections.forEach((section) => {
      const isActive = section === selectedSection;
      const button = document.createElement("button");
      button.className = `workspace-search-filter${isActive ? " is-active" : ""}`;
      button.type = "button";
      button.dataset.section = section;
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
      button.textContent = section;
      filtersElement.append(button);
    });
  }

  function updateActiveResult({ scroll = false } = {}) {
    const results = Array.from(resultsElement.querySelectorAll("[data-result-index]"));
    results.forEach((result, index) => {
      const isActive = index === activeIndex;
      result.classList.toggle("is-active", isActive);
      result.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    const activeResult = results[activeIndex];
    if (activeResult) {
      input.setAttribute("aria-activedescendant", activeResult.id);
      if (scroll) {
        activeResult.scrollIntoView({ block: "nearest" });
      }
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  }

  function renderResults() {
    const queryParts = normalizeWorkspaceSearchText(input.value).split(/\s+/).filter(Boolean);
    filteredPages = pages
      .filter((page) => selectedSection === "Alle" || page.section === selectedSection)
      .map((page) => ({ page, score: scoreWorkspaceSearchPage(page, queryParts) }))
      .filter((item) => item.score > -1000)
      .sort((left, right) => right.score - left.score || left.page.title.localeCompare(right.page.title, "nl"))
      .map((item) => item.page);

    activeIndex = Math.min(activeIndex, Math.max(filteredPages.length - 1, 0));
    metaElement.textContent = `${filteredPages.length} ${filteredPages.length === 1 ? "pagina" : "pagina's"} gevonden`;
    resultsElement.replaceChildren();

    if (!filteredPages.length) {
      const empty = document.createElement("div");
      empty.className = "workspace-search-empty";
      empty.textContent = "Geen pagina gevonden";
      resultsElement.append(empty);
      input.removeAttribute("aria-activedescendant");
      return;
    }

    filteredPages.forEach((page, index) => {
      const result = document.createElement("a");
      const path = getWorkspaceSearchPagePath(page);
      result.className = "workspace-search-result";
      result.href = path;
      result.id = `workspaceSearchResult${index}`;
      result.setAttribute("role", "option");
      result.dataset.resultIndex = String(index);

      const main = document.createElement("span");
      main.className = "workspace-search-result-main";
      const title = document.createElement("strong");
      title.textContent = String(page.title || "Pagina");
      const description = document.createElement("small");
      description.textContent = String(page.description || "");
      main.append(title, description);

      const side = document.createElement("span");
      side.className = "workspace-search-result-side";
      const section = document.createElement("span");
      section.textContent = String(page.section || "Algemeen");
      const code = document.createElement("code");
      code.textContent = path;
      side.append(section, code);

      result.append(main, side);
      resultsElement.append(result);
    });
    updateActiveResult();
  }

  function openSearch() {
    if (!panel.hidden) {
      input.focus();
      return;
    }
    focusBeforeSearch = document.activeElement instanceof HTMLElement ? document.activeElement : fab;
    closeWorkspaceNavigation();
    panel.hidden = false;
    backdrop.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-expanded", "true");
    document.body.classList.add("workspace-search-open");
    activeIndex = 0;
    renderResults();
    window.requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  function closeSearch() {
    if (panel.hidden) {
      return;
    }
    panel.hidden = true;
    backdrop.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    document.body.classList.remove("workspace-search-open");
    const focusTarget = focusBeforeSearch?.isConnected ? focusBeforeSearch : fab;
    focusBeforeSearch = null;
    focusTarget.focus();
  }

  function goToActiveResult() {
    const activePage = filteredPages[activeIndex];
    if (activePage) {
      window.location.href = activePage.path;
    }
  }

  renderFilters();
  renderResults();

  fab.addEventListener("click", () => {
    if (panel.hidden) {
      openSearch();
    } else {
      closeSearch();
    }
  });
  closeElements.forEach((element) => element.addEventListener("click", closeSearch));
  input.addEventListener("input", () => {
    activeIndex = 0;
    renderResults();
  });

  filtersElement.addEventListener("click", (event) => {
    const filterButton = event.target.closest("[data-section]");
    if (!filterButton) {
      return;
    }
    selectedSection = filterButton.dataset.section || "Alle";
    activeIndex = 0;
    renderFilters();
    renderResults();
    input.focus();
  });

  resultsElement.addEventListener("pointerover", (event) => {
    const result = event.target.closest("[data-result-index]");
    if (!result) {
      return;
    }
    activeIndex = Number(result.dataset.resultIndex || 0);
    updateActiveResult();
  });

  document.addEventListener("keydown", (event) => {
    const isOpen = !panel.hidden;
    const target = event.target;
    const isTyping = target instanceof HTMLInputElement
      || target instanceof HTMLTextAreaElement
      || target instanceof HTMLSelectElement
      || (target instanceof HTMLElement && target.isContentEditable);
    const usesSearchShortcut = event.key === "/" || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k");

    if (!isOpen && usesSearchShortcut && !isTyping) {
      event.preventDefault();
      openSearch();
      return;
    }

    if (!isOpen) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
    } else if (event.key === "Tab") {
      const focusable = Array.from(panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
        .filter((element) => !element.closest("[hidden]"));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (first && last && event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (first && last && !event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    } else if (event.key === "ArrowDown" && target === input) {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, Math.max(filteredPages.length - 1, 0));
      updateActiveResult({ scroll: true });
    } else if (event.key === "ArrowUp" && target === input) {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActiveResult({ scroll: true });
    } else if (event.key === "Enter" && target === input) {
      event.preventDefault();
      goToActiveResult();
    }
  });
}

function initSectionTileSearch() {
  document.querySelectorAll("[data-tile-search-root]").forEach((root) => {
    const input = root.querySelector("[data-tile-search-input]");
    const items = Array.from(root.querySelectorAll("[data-tile-search-item]"));
    const status = root.querySelector("[data-tile-search-status]");
    const empty = root.querySelector("[data-tile-search-empty]");
    if (!(input instanceof HTMLInputElement) || !items.length) {
      return;
    }

    const applyFilter = () => {
      const queryParts = normalizeWorkspaceSearchText(input.value).split(/\s+/).filter(Boolean);
      let visibleCount = 0;
      items.forEach((item) => {
        const text = normalizeWorkspaceSearchText(item.textContent);
        const isVisible = queryParts.every((part) => text.includes(part));
        item.hidden = !isVisible;
        if (isVisible) {
          visibleCount += 1;
        }
      });
      if (status) {
        status.textContent = `${visibleCount} van ${items.length} ${items.length === 1 ? "onderdeel" : "onderdelen"}`;
      }
      if (empty) {
        empty.hidden = visibleCount > 0;
      }
    };

    input.addEventListener("input", applyFilter);
    applyFilter();
  });
}

function initAccessibleModalDialogs() {
  const modalRoots = Array.from(document.querySelectorAll(".agenda-modal"));
  modalRoots.forEach((modal, index) => {
    const dialog = modal.querySelector(":scope > .agenda-modal-dialog");
    if (!(dialog instanceof HTMLElement)) {
      return;
    }

    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    if (!dialog.hasAttribute("aria-label") && !dialog.hasAttribute("aria-labelledby")) {
      const title = dialog.querySelector("h1, h2, h3");
      if (title) {
        if (!title.id) {
          title.id = `hwsModalTitle${index + 1}`;
        }
        dialog.setAttribute("aria-labelledby", title.id);
      } else {
        dialog.setAttribute("aria-label", "Dialoogvenster");
      }
    }
    if (!dialog.hasAttribute("tabindex")) {
      dialog.tabIndex = -1;
    }

    let wasOpen = false;
    let focusBeforeOpen = null;
    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const handleVisibility = () => {
      const isOpen = !modal.hidden;
      if (isOpen && !wasOpen) {
        if (!modal.contains(document.activeElement) && document.activeElement instanceof HTMLElement) {
          focusBeforeOpen = document.activeElement;
        }
        window.requestAnimationFrame(() => {
          if (modal.hidden || modal.contains(document.activeElement)) {
            return;
          }
          const firstFocusable = Array.from(dialog.querySelectorAll(focusableSelector))
            .find((element) => !element.closest("[hidden]"));
          (firstFocusable || dialog).focus();
        });
      } else if (!isOpen && wasOpen && focusBeforeOpen?.isConnected) {
        focusBeforeOpen.focus();
        focusBeforeOpen = null;
      }
      wasOpen = isOpen;
    };

    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Tab" || modal.hidden) {
        return;
      }
      const openModals = modalRoots.filter((candidate) => !candidate.hidden);
      if (openModals[openModals.length - 1] !== modal) {
        return;
      }
      const focusable = Array.from(dialog.querySelectorAll(focusableSelector))
        .filter((element) => !element.closest("[hidden]"));
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    new MutationObserver(handleVisibility).observe(modal, { attributes: true, attributeFilter: ["hidden"] });
    handleVisibility();
  });
}

initWorkspacePageSearch();
initSectionTileSearch();
initAccessibleModalDialogs();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js?v=2026-08-26-safe-activation", { updateViaCache: "none" }).then((registration) => {
      registration.update().catch(() => {});
    }).catch(() => {});
  });
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

async function initSpaarpotPushControls() {
  const root = document.querySelector("[data-spaarpot-push]");
  if (!root || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return;
  }

  const button = root.querySelector("[data-spaarpot-push-button]");
  const status = root.querySelector("[data-spaarpot-push-status]");
  if (!(button instanceof HTMLButtonElement) || !status) {
    return;
  }

  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const setStatus = (message) => {
    status.textContent = message;
  };

  try {
    const statusResponse = await fetch("/api/push/status");
    const pushConfig = await statusResponse.json();
    if (!statusResponse.ok || !pushConfig.enabled || !pushConfig.publicKey) {
      button.disabled = true;
      setStatus(pushConfig.message || "Pushmeldingen staan nog niet aan op de server.");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      button.textContent = "Pushmelding actief";
      button.disabled = true;
      setStatus("Je ontvangt elke maandagochtend om 07:00 een spaarpotmelding.");
      return;
    }

    button.hidden = false;
    setStatus("Zet de wekelijkse spaarpotmelding aan voor deze browser.");

    button.addEventListener("click", async () => {
      button.disabled = true;
      setStatus("Pushmelding wordt aangezet...");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        button.disabled = false;
        setStatus("Browsertoestemming is nodig om pushmeldingen te ontvangen.");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(pushConfig.publicKey),
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ subscription }),
      });

      if (!response.ok) {
        button.disabled = false;
        setStatus("Opslaan van de pushmelding is mislukt.");
        return;
      }

      button.textContent = "Pushmelding actief";
      setStatus("Je ontvangt elke maandagochtend om 07:00 een spaarpotmelding.");
    });
  } catch (error) {
    setStatus("Pushmeldingen kunnen nu niet worden ingesteld.");
  }
}

initSpaarpotPushControls();
