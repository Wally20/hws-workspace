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

function initWorkspacePageSearch() {
  const pages = getWorkspaceSearchPages();
  if (!pages.length || document.querySelector("[data-workspace-search-root]")) {
    return;
  }

  const sections = ["Alle", ...Array.from(new Set(pages.map((page) => page.section).filter(Boolean)))];
  let selectedSection = "Alle";
  let activeIndex = 0;
  let filteredPages = pages.slice();

  const root = document.createElement("div");
  root.className = "workspace-search-root";
  root.dataset.workspaceSearchRoot = "1";
  root.innerHTML = `
    <button class="workspace-search-fab" type="button" aria-label="Pagina zoeken" aria-expanded="false">
      <span aria-hidden="true">?</span>
    </button>
    <div class="workspace-search-backdrop" data-search-close hidden></div>
    <section class="workspace-search-panel" role="dialog" aria-modal="true" aria-labelledby="workspaceSearchTitle" hidden>
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
        <input id="workspaceSearchInput" type="search" autocomplete="off" placeholder="Zoek op pagina, onderdeel, taak of URL">
      </label>
      <div class="workspace-search-filters" role="listbox" aria-label="Filter op onderdeel"></div>
      <div class="workspace-search-meta" aria-live="polite"></div>
      <div class="workspace-search-results" role="listbox" aria-label="Zoekresultaten"></div>
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
    filtersElement.innerHTML = sections
      .map((section) => {
        const isActive = section === selectedSection;
        return `<button class="workspace-search-filter${isActive ? " is-active" : ""}" type="button" data-section="${section}" aria-selected="${isActive ? "true" : "false"}">${section}</button>`;
      })
      .join("");
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

    if (!filteredPages.length) {
      resultsElement.innerHTML = `<div class="workspace-search-empty">Geen pagina gevonden</div>`;
      return;
    }

    resultsElement.innerHTML = filteredPages
      .map((page, index) => `
        <a class="workspace-search-result${index === activeIndex ? " is-active" : ""}" href="${page.path}" role="option" aria-selected="${index === activeIndex ? "true" : "false"}" data-result-index="${index}">
          <span class="workspace-search-result-main">
            <strong>${page.title}</strong>
            <small>${page.description}</small>
          </span>
          <span class="workspace-search-result-side">
            <span>${page.section}</span>
            <code>${page.path}</code>
          </span>
        </a>
      `)
      .join("");
  }

  function openSearch() {
    panel.hidden = false;
    backdrop.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    document.body.classList.add("workspace-search-open");
    activeIndex = 0;
    renderResults();
    window.setTimeout(() => input.focus(), 20);
  }

  function closeSearch() {
    panel.hidden = true;
    backdrop.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    document.body.classList.remove("workspace-search-open");
    fab.focus();
  }

  function goToActiveResult() {
    const activePage = filteredPages[activeIndex];
    if (activePage) {
      window.location.href = activePage.path;
    }
  }

  renderFilters();
  renderResults();

  fab.addEventListener("click", openSearch);
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

  resultsElement.addEventListener("mousemove", (event) => {
    const result = event.target.closest("[data-result-index]");
    if (!result) {
      return;
    }
    activeIndex = Number(result.dataset.resultIndex || 0);
    renderResults();
  });

  document.addEventListener("keydown", (event) => {
    const isOpen = !panel.hidden;
    const isTyping = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

    if (!isOpen && event.key === "/" && !isTyping) {
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
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      activeIndex = Math.min(activeIndex + 1, Math.max(filteredPages.length - 1, 0));
      renderResults();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      renderResults();
    } else if (event.key === "Enter") {
      event.preventDefault();
      goToActiveResult();
    }
  });
}

initWorkspacePageSearch();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js?v=2026-07-22-exercise-layout-4", { updateViaCache: "none" }).then((registration) => {
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
