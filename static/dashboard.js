const editEventsButton = document.querySelector("#editEventsButton");
const eventEditor = document.querySelector("#eventEditor");
const selectedEventsContainer = document.querySelector("#selectedEvents");
const eventSearchInput = document.querySelector("#eventSearchInput");
const eventSearchButton = document.querySelector("#eventSearchButton");
const eventSearchResults = document.querySelector("#eventSearchResults");
const saveEventsButton = document.querySelector("#saveEventsButton");
const compactStatList = document.querySelector("#eventsStatList");
const reportSummaryList = document.querySelector("#reportSummaryList");
const revenueChart = document.querySelector(".revenue-chart");

let selectedEvents = Array.from(document.querySelectorAll(".event-row")).map((row) => ({
  productId: row.dataset.productId || null,
  label: row.dataset.productLabel || "",
  matchTerms: [row.dataset.productLabel || ""],
  previewCount: row.dataset.soldCount || "0",
}));
let searchDebounce = null;
let dashboardRefreshTimer = null;

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function updateReportTile(reportSummary) {
  if (!reportSummaryList || !reportSummary) {
    return;
  }

  const fields = {
    ecwidRevenue: Number(reportSummary.ecwidRevenue || 0),
    moneybirdRevenue: Number(reportSummary.moneybirdRevenue || 0),
    combinedRevenue: Number(reportSummary.combinedRevenue || 0),
  };

  Object.entries(fields).forEach(([fieldName, fieldValue]) => {
    const target = reportSummaryList.querySelector(`[data-report-field="${fieldName}"]`);
    if (target) {
      target.textContent = currencyFormatter.format(fieldValue);
    }
  });
}

function updateEventTile(productSummary) {
  if (!compactStatList || !Array.isArray(productSummary)) {
    return;
  }

  compactStatList.innerHTML = "";
  productSummary.forEach((product) => {
    const row = document.createElement("div");
    row.className = "compact-stat-row event-row";
    row.dataset.productId = product.productId || "";
    row.dataset.productLabel = product.label || "";
    row.dataset.soldCount = String(product.soldCount || 0);
    row.innerHTML = `
      <span class="summary-label">${product.label || "Onbekend event"}</span>
      <span class="compact-stat-value">${product.soldCount || 0}</span>
    `;
    compactStatList.append(row);
  });

  selectedEvents = productSummary.map((product) => ({
    productId: product.productId || null,
    label: product.label || "",
    matchTerms: [product.label || ""],
    previewCount: String(product.soldCount || 0),
  }));
}

function updateRevenueChart(monthlyRevenueSeries) {
  if (!revenueChart || !Array.isArray(monthlyRevenueSeries)) {
    return;
  }

  revenueChart.dataset.chartSeries = JSON.stringify(monthlyRevenueSeries);
  if (typeof window.renderRevenueChart === "function") {
    window.renderRevenueChart(revenueChart);
  }
}

async function refreshDashboardSummary({ silent = true } = {}) {
  try {
    const response = await fetch(`/api/dashboard-summary${silent ? "" : "?refresh=1"}`);
    const payload = await response.json();
    if (!response.ok) {
      return;
    }

    updateReportTile(payload.reportSummary || {});
    updateEventTile(payload.productSummary || []);
    updateRevenueChart(payload.monthlyRevenueSeries || []);
  } catch (error) {
    console.error("Dashboardsamenvatting verversen mislukt", error);
  }
}

function renderSelectedEvents() {
  if (!selectedEventsContainer) {
    return;
  }

  selectedEventsContainer.innerHTML = "";
  selectedEvents.forEach((eventItem, index) => {
    const row = document.createElement("div");
    row.className = "selected-event-row";
    row.innerHTML = `
      <div class="selected-event-copy">
        <strong>${eventItem.label}</strong>
        <span>Ecwid product ${eventItem.productId || "-"}</span>
      </div>
      <button type="button" class="subtle-button" data-remove-index="${index}">Verwijder</button>
    `;
    selectedEventsContainer.append(row);
  });
}

function renderTilePreview() {
  if (!compactStatList) {
    return;
  }

  compactStatList.innerHTML = "";
  selectedEvents.forEach((eventItem) => {
    const row = document.createElement("div");
    row.className = "compact-stat-row event-row";
    row.dataset.productId = eventItem.productId || "";
    row.dataset.productLabel = eventItem.label || "";
    row.dataset.soldCount = eventItem.previewCount || "0";
    row.innerHTML = `
      <span class="summary-label">${eventItem.label}</span>
      <span class="compact-stat-value">${eventItem.previewCount || "0"}</span>
    `;
    compactStatList.append(row);
  });
}

function renderSearchResults(items) {
  if (!eventSearchResults) {
    return;
  }

  eventSearchResults.innerHTML = "";
  if (!items.length) {
    eventSearchResults.innerHTML = '<div class="search-result-row"><div class="search-result-copy"><strong>Geen producten gevonden</strong><span>Probeer een andere zoekterm.</span></div></div>';
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "search-result-row";
    row.innerHTML = `
      <div class="search-result-copy">
        <strong>${item.name}</strong>
        <span>${item.sku ? `SKU: ${item.sku}` : `Product ID: ${item.id}`}</span>
      </div>
      <button type="button" class="subtle-button" data-add-id="${item.id}" data-add-label="${item.name}">Toevoegen</button>
    `;
    eventSearchResults.append(row);
  });
}

async function searchEvents() {
  const query = eventSearchInput?.value.trim();
  if (!query) {
    renderSearchResults([]);
    return;
  }

  const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`);
  const payload = await response.json();
  renderSearchResults(payload.items || []);
}

async function saveEvents() {
  await fetch("/api/dashboard-events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: selectedEvents.map((item) => ({
        productId: item.productId,
        label: item.label,
        matchTerms: item.matchTerms,
      })),
    }),
  });
  window.location.reload();
}

editEventsButton?.addEventListener("click", () => {
  eventEditor.hidden = !eventEditor.hidden;
  renderSelectedEvents();
  renderTilePreview();
});

eventSearchButton?.addEventListener("click", searchEvents);
eventSearchInput?.addEventListener("input", () => {
  window.clearTimeout(searchDebounce);
  searchDebounce = window.setTimeout(() => {
    searchEvents();
  }, 180);
});
eventSearchInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchEvents();
  }
});

selectedEventsContainer?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const index = Number(target.dataset.removeIndex);
  if (!Number.isNaN(index)) {
    selectedEvents.splice(index, 1);
    renderSelectedEvents();
    renderTilePreview();
  }
});

eventSearchResults?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const productId = target.dataset.addId;
  const label = target.dataset.addLabel;
  if (!productId || !label) {
    return;
  }

  const alreadySelected = selectedEvents.some((item) => String(item.productId) === String(productId));
  if (alreadySelected) {
    return;
  }

  selectedEvents.push({
    productId,
    label,
    matchTerms: [label],
    previewCount: "Nieuw",
  });
  selectedEvents.sort((a, b) => a.label.localeCompare(b.label, "nl"));
  renderSelectedEvents();
  renderTilePreview();
});

saveEventsButton?.addEventListener("click", saveEvents);

if (reportSummaryList || compactStatList) {
  refreshDashboardSummary();
  dashboardRefreshTimer = window.setInterval(() => {
    refreshDashboardSummary();
  }, 60000);
}
