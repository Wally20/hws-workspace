const productSearchInput = document.querySelector("#registrationsProductSearch");
const productList = document.querySelector("#registrationsProductList");
const productCards = Array.from(document.querySelectorAll(".registrations-product-card"));
const copyEmailsButton = document.querySelector("#copyRegistrationEmailsButton");
const copyPendingEmailsButton = document.querySelector("#copyPendingRegistrationEmailsButton");
const copyFeedback = document.querySelector("#registrationCopyFeedback");
const syncEmailedOrdersButton = document.querySelector("#syncEmailedOrdersButton");
const syncEmailedOrdersFeedback = document.querySelector("#syncEmailedOrdersFeedback");
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
const emailedOrderCount = document.querySelector("#registrationEmailedOrderCount");
const pendingEmailCount = document.querySelector("#registrationPendingEmailCount");
const totalEmailCount = document.querySelector("#registrationEmailCount");
const emailedCheckboxes = Array.from(document.querySelectorAll(".registration-emailed-checkbox"));
const registrationOrderCards = Array.from(document.querySelectorAll("[data-registration-order]"));

productCards.forEach((card, index) => {
  card.dataset.originalIndex = String(index);
});

function normalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function tokenizeSearchValue(value) {
  return normalizeSearchValue(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function scoreProductMatch(card, query) {
  const name = normalizeSearchValue(card.dataset.productName || "");
  const sku = normalizeSearchValue(card.dataset.productSku || "");
  const queryWords = tokenizeSearchValue(query);

  if (!queryWords.length) {
    return 0;
  }

  const nameWords = tokenizeSearchValue(name);
  const skuWords = tokenizeSearchValue(sku);
  const searchableWords = [...nameWords, ...skuWords];

  const matchedWordCount = queryWords.filter((queryWord) =>
    searchableWords.some((word) => word.includes(queryWord))
  ).length;
  const matchedAllWords = matchedWordCount === queryWords.length;

  if (!matchedAllWords) {
    return Number.POSITIVE_INFINITY;
  }

  const fullQuery = queryWords.join(" ");
  const exactTitleMatch = name === fullQuery;
  const titleStartsWithQuery = name.startsWith(fullQuery);
  const titleContainsFullQuery = name.includes(fullQuery);
  const titleWordPrefixMatches = queryWords.filter((queryWord) =>
    nameWords.some((word) => word.startsWith(queryWord))
  ).length;
  const skuStartsWithQuery = sku.startsWith(fullQuery);
  const skuContainsFullQuery = sku.includes(fullQuery);

  if (exactTitleMatch) {
    return 0;
  }
  if (matchedAllWords && titleStartsWithQuery) {
    return 1;
  }
  if (matchedAllWords && titleWordPrefixMatches === queryWords.length) {
    return 2;
  }
  if (matchedAllWords && titleContainsFullQuery) {
    return 3;
  }
  if (matchedAllWords && skuStartsWithQuery) {
    return 4;
  }
  if (matchedAllWords && skuContainsFullQuery) {
    return 5;
  }
  return 20 - matchedWordCount;
}

function filterProducts() {
  const query = String(productSearchInput?.value || "");
  const rankedCards = [];

  productCards.forEach((card) => {
    const matchScore = scoreProductMatch(card, query);
    const matches = matchScore !== Number.POSITIVE_INFINITY;
    card.hidden = !matches;

    if (matches) {
      rankedCards.push({
        card,
        matchScore,
        originalIndex: Number(card.dataset.originalIndex || 0),
      });
    }
  });

  rankedCards
    .sort((left, right) => left.matchScore - right.matchScore || left.originalIndex - right.originalIndex)
    .forEach(({ card }) => {
      productList?.appendChild(card);
    });
}

async function copyRegistrationEmails() {
  const emails = getRegistrationEmailState().allEmails.join(", ");
  if (!emails) {
    return;
  }

  try {
    await navigator.clipboard.writeText(emails);
  } catch (error) {
    if (copyFeedback) {
      copyFeedback.textContent = "Kopieren lukte niet. Selecteer de adressen handmatig.";
    }
    return;
  }

  try {
    const { allOrderIdsWithEmail } = getRegistrationEmailState();
    await updateRegistrationEmailStatus(allOrderIdsWithEmail, true);
    allOrderIdsWithEmail.forEach((orderId) => {
      const checkbox = document.querySelector(`.registration-emailed-checkbox[data-order-id="${CSS.escape(orderId)}"]`);
      if (checkbox instanceof HTMLInputElement) {
        checkbox.checked = true;
      }
    });
    syncRegistrationOrderUI();
    if (copyFeedback) {
      copyFeedback.textContent = "Alle e-mailadressen gekopieerd en op gemaild gezet.";
    }
  } catch (error) {
    if (copyFeedback) {
      copyFeedback.textContent = "E-mailadressen zijn gekopieerd, maar de gemaild-status kon niet worden opgeslagen.";
    }
  }
}

function getRegistrationEmailState() {
  const seenAllEmails = new Set();
  const seenPendingEmails = new Set();
  const allEmails = [];
  const pendingEmails = [];
  const allOrderIdsWithEmail = [];
  const pendingOrderIds = [];
  let emailedCount = 0;

  registrationOrderCards.forEach((card) => {
    const orderId = String(card.dataset.orderId || "").trim();
    const email = String(card.dataset.email || "").trim();
    const checkbox = card.querySelector(".registration-emailed-checkbox");
    const isEmailed = checkbox instanceof HTMLInputElement ? checkbox.checked : false;

    if (isEmailed) {
      emailedCount += 1;
    }

    if (!email) {
      return;
    }

    const normalizedEmail = email.toLowerCase();
    if (!seenAllEmails.has(normalizedEmail)) {
      seenAllEmails.add(normalizedEmail);
      allEmails.push(email);
    }
    if (orderId) {
      allOrderIdsWithEmail.push(orderId);
    }

    if (isEmailed) {
      return;
    }

    if (!seenPendingEmails.has(normalizedEmail)) {
      seenPendingEmails.add(normalizedEmail);
      pendingEmails.push(email);
    }
    if (orderId) {
      pendingOrderIds.push(orderId);
    }
  });

  return {
    allEmails,
    pendingEmails,
    allOrderIdsWithEmail,
    pendingOrderIds,
    emailedCount,
  };
}

function syncRegistrationOrderUI() {
  const { allEmails, pendingEmails, emailedCount } = getRegistrationEmailState();

  registrationOrderCards.forEach((card) => {
    const checkbox = card.querySelector(".registration-emailed-checkbox");
    const isEmailed = checkbox instanceof HTMLInputElement ? checkbox.checked : false;
    card.classList.toggle("registrations-order-card-emailed", isEmailed);
    card.classList.toggle("registrations-order-card-pending", !isEmailed);
  });

  if (totalEmailCount) {
    totalEmailCount.textContent = String(allEmails.length);
  }
  if (pendingEmailCount) {
    pendingEmailCount.textContent = String(pendingEmails.length);
  }
  if (emailedOrderCount) {
    emailedOrderCount.textContent = String(emailedCount);
  }
  if (copyEmailsButton instanceof HTMLButtonElement) {
    copyEmailsButton.disabled = allEmails.length === 0;
  }
  if (copyPendingEmailsButton instanceof HTMLButtonElement) {
    copyPendingEmailsButton.disabled = pendingEmails.length === 0;
  }
}

async function updateRegistrationEmailStatus(orderIds, emailed) {
  const productKey = String(copyEmailsButton?.dataset.productKey || copyPendingEmailsButton?.dataset.productKey || "").trim();
  if (!productKey || !Array.isArray(orderIds) || !orderIds.length) {
    return;
  }

  const response = await fetch("/api/registrations/email-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({
      productKey,
      orderIds,
      emailed,
    }),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
}

async function syncEmailedOrdersToEcwid() {
  const response = await fetch("/api/registrations/sync-emailed-orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: "{}",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = typeof payload.error === "string" && payload.error ? payload.error : "Synchroniseren lukte niet.";
    const error = new Error(errorMessage);
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function copyPendingRegistrationEmails() {
  const { pendingEmails, pendingOrderIds } = getRegistrationEmailState();
  const emails = pendingEmails.join(", ");
  if (!emails || !pendingOrderIds.length) {
    return;
  }

  try {
    await navigator.clipboard.writeText(emails);
  } catch (error) {
    if (copyFeedback) {
      copyFeedback.textContent = "Kopieren lukte niet. Selecteer de adressen handmatig.";
    }
    return;
  }

  try {
    await updateRegistrationEmailStatus(pendingOrderIds, true);
    pendingOrderIds.forEach((orderId) => {
      const checkbox = document.querySelector(`.registration-emailed-checkbox[data-order-id="${CSS.escape(orderId)}"]`);
      if (checkbox instanceof HTMLInputElement) {
        checkbox.checked = true;
      }
    });
    syncRegistrationOrderUI();
    if (copyFeedback) {
      copyFeedback.textContent = "Openstaande e-mailadressen gekopieerd en op gemaild gezet.";
    }
  } catch (error) {
    if (copyFeedback) {
      copyFeedback.textContent = "E-mailadressen zijn gekopieerd, maar de gemaild-status kon niet worden opgeslagen.";
    }
  }
}

async function handleRegistrationEmailedToggle(event) {
  const checkbox = event.currentTarget;
  if (!(checkbox instanceof HTMLInputElement)) {
    return;
  }

  const orderId = String(checkbox.dataset.orderId || "").trim();
  if (!orderId) {
    return;
  }

  checkbox.disabled = true;
  try {
    await updateRegistrationEmailStatus([orderId], checkbox.checked);
    syncRegistrationOrderUI();
    if (copyFeedback) {
      copyFeedback.textContent = checkbox.checked ? "Bestelling op gemaild gezet." : "Bestelling weer opengezet.";
    }
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    if (copyFeedback) {
      copyFeedback.textContent = "Opslaan lukte niet. Probeer het opnieuw.";
    }
  } finally {
    checkbox.disabled = false;
  }
}

async function handleSyncEmailedOrders() {
  if (!(syncEmailedOrdersButton instanceof HTMLButtonElement)) {
    return;
  }

  syncEmailedOrdersButton.disabled = true;
  if (syncEmailedOrdersFeedback) {
    syncEmailedOrdersFeedback.textContent = "Synchroniseren met Ecwid...";
  }

  try {
    const payload = await syncEmailedOrdersToEcwid();
    if (syncEmailedOrdersFeedback) {
      syncEmailedOrdersFeedback.textContent =
        payload.message || "De gemailde bestellingen zijn met Ecwid gesynchroniseerd.";
    }
  } catch (error) {
    if (syncEmailedOrdersFeedback) {
      syncEmailedOrdersFeedback.textContent =
        error instanceof Error && error.message ? error.message : "Synchroniseren lukte niet. Probeer het opnieuw.";
    }
  } finally {
    syncEmailedOrdersButton.disabled = false;
  }
}

productSearchInput?.addEventListener("input", filterProducts);
productSearchInput?.addEventListener("search", filterProducts);
productSearchInput?.addEventListener("change", filterProducts);
copyEmailsButton?.addEventListener("click", copyRegistrationEmails);
copyPendingEmailsButton?.addEventListener("click", copyPendingRegistrationEmails);
emailedCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", handleRegistrationEmailedToggle);
});
syncEmailedOrdersButton?.addEventListener("click", handleSyncEmailedOrders);

filterProducts();
syncRegistrationOrderUI();
