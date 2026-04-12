const ordersGrid = document.querySelector("#ordersGrid");
const summaryGrid = document.querySelector("#summaryGrid");
const resultCount = document.querySelector("#resultCount");
const notice = document.querySelector("#notice");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const orderCardTemplate = document.querySelector("#orderCardTemplate");
const connectionStatus = document.querySelector("#connectionStatus");
const connectionText = document.querySelector("#connectionText");
const refreshButton = document.querySelector("#refreshButton");
const lastUpdated = document.querySelector("#lastUpdated");

let allOrders = [];
let refreshTimer = null;

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const summaryCurrencyFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "medium",
  timeStyle: "short",
});

function prettyLabel(value) {
  return (value || "UNKNOWN")
    .toString()
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^\w/, (char) => char.toUpperCase());
}

function buildSummaryCards(orders, summary = null) {
  const paidOrders = summary?.paidCount ?? orders.filter((order) => order.paymentStatus === "PAID").length;
  const pendingOrders = summary?.openCount ?? orders.filter((order) => order.paymentStatus !== "PAID").length;
  const revenue =
    summary?.revenue ??
    orders
      .filter((order) => order.paymentStatus !== "REFUNDED")
      .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const orderCount = summary?.orderCount ?? orders.length;

  const summaryItems = [
    ["Totaal bestellingen", orderCount.toString()],
    ["Totale omzet", summaryCurrencyFormatter.format(revenue)],
    ["Betaald", paidOrders.toString()],
    ["Openstaand", pendingOrders.toString()],
  ];

  summaryGrid.innerHTML = "";

  summaryItems.forEach(([label, value]) => {
    const card = document.createElement("article");
    card.className = "summary-card";
    card.innerHTML = `
      <p class="summary-label">${label}</p>
      <p class="summary-value">${value}</p>
    `;
    summaryGrid.append(card);
  });
}

function populateStatusFilter(orders) {
  const currentValue = statusFilter.value;
  const statuses = Array.from(new Set(orders.map((order) => order.status))).sort();

  statusFilter.innerHTML = '<option value="ALL">Alle statussen</option>';
  statuses.forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = prettyLabel(status);
    statusFilter.append(option);
  });

  statusFilter.value = statuses.includes(currentValue) ? currentValue : "ALL";
}

function renderOrders() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;

  const filteredOrders = allOrders.filter((order) => {
    const matchesSearch =
      !searchTerm ||
      [order.id, order.customerName, order.email]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm);
    const matchesStatus = selectedStatus === "ALL" || order.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  resultCount.textContent = `${filteredOrders.length} van ${allOrders.length} bestellingen`;
  ordersGrid.innerHTML = "";

  if (!filteredOrders.length) {
    ordersGrid.innerHTML = '<div class="empty-state">Geen bestellingen gevonden voor deze filters.</div>';
    return;
  }

  filteredOrders.forEach((order) => {
    const fragment = orderCardTemplate.content.cloneNode(true);
    fragment.querySelector(".order-id").textContent = order.id;
    fragment.querySelector(".order-date").textContent = order.createdAt
      ? dateFormatter.format(new Date(order.createdAt))
      : "Datum onbekend";
    fragment.querySelector(".order-status").textContent = prettyLabel(order.status);
    fragment.querySelector(".customer-name").textContent = order.customerName;
    fragment.querySelector(".customer-email").textContent = order.email || "Geen e-mail";
    fragment.querySelector(".order-total").textContent = currencyFormatter.format(Number(order.total || 0));
    fragment.querySelector(".order-meta").textContent =
      `${order.itemCount} items • ${order.shippingMethod}`;
    fragment.querySelector(".payment-status").textContent = `Betaling: ${prettyLabel(order.paymentStatus)}`;
    fragment.querySelector(".fulfillment-status").textContent =
      `Afhandeling: ${prettyLabel(order.fulfillmentStatus)}`;

    const itemsList = fragment.querySelector(".items-list");
    order.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "line-item";
      row.innerHTML = `
        <div>
          <p class="line-item-name">${item.name}</p>
          <p class="line-item-meta">${item.quantity} x ${currencyFormatter.format(Number(item.price || 0))}${item.sku ? ` • SKU: ${item.sku}` : ""}</p>
        </div>
      `;
      itemsList.append(row);
    });

    ordersGrid.append(fragment);
  });
}

function updateLastUpdatedLabel() {
  if (!lastUpdated) {
    return;
  }

  lastUpdated.textContent = `Laatst ververst: ${dateFormatter.format(new Date())}`;
}

async function loadOrders({ silent = false } = {}) {
  notice.hidden = true;
  if (refreshButton) {
    refreshButton.disabled = true;
    refreshButton.textContent = silent ? "Automatisch verversen..." : "Bezig met verversen...";
  }

  try {
    const response = await fetch("/api/orders");
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.details || payload.error || "Onbekende fout");
    }

    allOrders = payload.items || [];
    buildSummaryCards(allOrders, payload.summary);
    populateStatusFilter(allOrders);
    renderOrders();

    if (connectionStatus && connectionText) {
      connectionStatus.textContent =
        payload.source === "ecwid" ? "Live Ecwid-koppeling klaar" : "Demo-modus actief";
      connectionText.textContent =
        payload.source === "ecwid"
          ? "De server gebruikt je beveiligde Ecwid-configuratie."
          : "De pagina draait nu met voorbeeldbestellingen totdat je de Ecwid-serverkoppeling gebruikt.";
    }

    if (payload.message) {
      notice.hidden = false;
      notice.textContent = payload.message;
    }

    updateLastUpdatedLabel();
  } catch (error) {
    allOrders = [
      {
        id: "WEB-1001",
        createdAt: "2026-04-04T14:12:00+02:00",
        status: "PAID",
        paymentStatus: "PAID",
        fulfillmentStatus: "AWAITING_PROCESSING",
        total: 89.95,
        email: "anne@example.com",
        customerName: "Anne de Vries",
        paymentMethod: "iDEAL",
        shippingMethod: "PostNL pakket",
        itemCount: 3,
        items: [
          { name: "Linnen blouse", quantity: 1, price: 49.95, sku: "BL-01" },
          { name: "Canvas tas", quantity: 2, price: 20.0, sku: "TS-02" },
        ],
      },
      {
        id: "WEB-1002",
        createdAt: "2026-04-03T09:05:00+02:00",
        status: "PROCESSING",
        paymentStatus: "AWAITING_PAYMENT",
        fulfillmentStatus: "AWAITING_PROCESSING",
        total: 129.0,
        email: "milan@example.com",
        customerName: "Milan Jansen",
        paymentMethod: "Bankoverschrijving",
        shippingMethod: "Afhalen",
        itemCount: 1,
        items: [
          { name: "Leren portefeuille", quantity: 1, price: 129.0, sku: "PF-09" },
        ],
      },
      {
        id: "WEB-1003",
        createdAt: "2026-04-01T16:45:00+02:00",
        status: "SHIPPED",
        paymentStatus: "PAID",
        fulfillmentStatus: "SHIPPED",
        total: 62.5,
        email: "noor@example.com",
        customerName: "Noor Bakker",
        paymentMethod: "Creditcard",
        shippingMethod: "DHL",
        itemCount: 2,
        items: [
          { name: "Keramische mok", quantity: 2, price: 17.5, sku: "MK-11" },
          { name: "Theeblik", quantity: 1, price: 27.5, sku: "TB-03" },
        ],
      },
    ];

    buildSummaryCards(allOrders);
    populateStatusFilter(allOrders);
    renderOrders();

    if (connectionStatus && connectionText) {
      connectionStatus.textContent = "Demo-modus actief";
      connectionText.textContent =
        "Five Server kan de Ecwid API-route niet server-side uitvoeren, dus je ziet nu voorbeeldbestellingen.";
    }

    notice.hidden = false;
    notice.textContent =
      "Je bekijkt dit bestand statisch. Voor live Ecwid-data moet je de Flask-server starten via python3 app.py.";
    updateLastUpdatedLabel();
  } finally {
    if (refreshButton) {
      refreshButton.disabled = false;
      refreshButton.textContent = "Nu verversen";
    }
  }
}

searchInput.addEventListener("input", renderOrders);
statusFilter.addEventListener("change", renderOrders);
refreshButton?.addEventListener("click", () => loadOrders());

loadOrders();

refreshTimer = window.setInterval(() => {
  loadOrders({ silent: true });
}, 30000);
