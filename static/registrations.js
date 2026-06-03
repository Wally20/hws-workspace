const productSearchInput = document.querySelector("#registrationsProductSearch");
const productList = document.querySelector("#registrationsProductList");
const productCards = Array.from(document.querySelectorAll(".registrations-product-card"));
const copyEmailsButton = document.querySelector("#copyRegistrationEmailsButton");
const copyPendingEmailsButton = document.querySelector("#copyPendingRegistrationEmailsButton");
const sendPendingEmailsButton = document.querySelector("#sendPendingRegistrationEmailsButton");
const copyFeedback = document.querySelector("#registrationCopyFeedback");
const syncEmailedOrdersButton = document.querySelector("#syncEmailedOrdersButton");
const syncEmailedOrdersFeedback = document.querySelector("#syncEmailedOrdersFeedback");
const completeRegistrationEventButton = document.querySelector("#completeRegistrationEventButton");
const cancelRegistrationEventButton = document.querySelector("#cancelRegistrationEventButton");
const registrationEventFeedback = document.querySelector("#registrationEventFeedback");
const registrationEventStatusText = document.querySelector("#registrationEventStatusText");
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
const emailedOrderCount = document.querySelector("#registrationEmailedOrderCount");
const pendingEmailCount = document.querySelector("#registrationPendingEmailCount");
const totalEmailCount = document.querySelector("#registrationEmailCount");
const emailedCheckboxes = Array.from(document.querySelectorAll(".registration-emailed-checkbox"));
const registrationOrderCards = Array.from(document.querySelectorAll("[data-registration-order]"));
const registrationEmailSettingsForm = document.querySelector("#registrationEmailSettingsForm");
const registrationEmailProductKey = document.querySelector("#registrationEmailProductKey");
const registrationEmailProductName = document.querySelector("#registrationEmailProductName");
const registrationEventDateInput = document.querySelector("#registrationEventDateInput");
const registrationUseSecondEventDateInput = document.querySelector("#registrationUseSecondEventDateInput");
const registrationSecondEventDateField = document.querySelector("#registrationSecondEventDateField");
const registrationEventDate2Input = document.querySelector("#registrationEventDate2Input");
const registrationEmailSubjectInput = document.querySelector("#registrationEmailSubjectInput");
const registrationEmailBodyInput = document.querySelector("#registrationEmailBodyInput");
const registrationEmailFormatButtons = Array.from(document.querySelectorAll("[data-email-format]"));
const registrationEmailTemplateSelect = document.querySelector("#registrationEmailTemplateSelect");
const registrationEmailSettingsFeedback = document.querySelector("#registrationEmailSettingsFeedback");
const saveRegistrationEmailSettingsButton = document.querySelector("#saveRegistrationEmailSettingsButton");
const registrationEmailTemplatesJson = document.querySelector("#registrationEmailTemplatesJson");
let registrationEmailTemplates = parseRegistrationEmailTemplates();

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

function parseRegistrationEmailTemplates() {
  if (!registrationEmailTemplatesJson?.textContent) {
    return [];
  }

  try {
    const parsedTemplates = JSON.parse(registrationEmailTemplatesJson.textContent);
    return Array.isArray(parsedTemplates) ? parsedTemplates : [];
  } catch (error) {
    return [];
  }
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

function copyTextWithFallback(value) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "-1000px";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();

  if (!copied) {
    return Promise.reject(new Error("Copy command failed"));
  }
  return Promise.resolve();
}

function getRegistrationCheckboxForOrder(orderId) {
  if (window.CSS?.escape) {
    return document.querySelector(`.registration-emailed-checkbox[data-order-id="${CSS.escape(orderId)}"]`);
  }

  return emailedCheckboxes.find((checkbox) => String(checkbox.dataset.orderId || "") === String(orderId));
}

function getRegistrationCheckboxesForOrder(orderId) {
  return emailedCheckboxes.filter((checkbox) => String(checkbox.dataset.orderId || "") === String(orderId));
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
        canceledRank: card.dataset.eventCanceled === "true" ? 1 : 0,
        originalIndex: Number(card.dataset.originalIndex || 0),
      });
    }
  });

  rankedCards
    .sort(
      (left, right) =>
        left.canceledRank - right.canceledRank || left.matchScore - right.matchScore || left.originalIndex - right.originalIndex
    )
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
    await copyTextWithFallback(emails);
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
      getRegistrationCheckboxesForOrder(orderId).forEach((checkbox) => {
        checkbox.checked = true;
      });
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
  const allOrderIdSet = new Set();
  const pendingOrderIdSet = new Set();
  const emailedOrderIdSet = new Set();
  let emailedCount = 0;

  registrationOrderCards.forEach((card) => {
    const orderId = String(card.dataset.orderId || "").trim();
    const email = String(card.dataset.email || "").trim();
    const checkbox = card.querySelector(".registration-emailed-checkbox");
    const isEmailed = checkbox instanceof HTMLInputElement ? checkbox.checked : false;

    if (orderId && isEmailed) {
      emailedOrderIdSet.add(orderId);
    }

    if (!email) {
      return;
    }

    const normalizedEmail = email.toLowerCase();
    if (!seenAllEmails.has(normalizedEmail)) {
      seenAllEmails.add(normalizedEmail);
      allEmails.push(email);
    }
    if (orderId && !allOrderIdSet.has(orderId)) {
      allOrderIdSet.add(orderId);
      allOrderIdsWithEmail.push(orderId);
    }

    if (isEmailed) {
      return;
    }

    if (!seenPendingEmails.has(normalizedEmail)) {
      seenPendingEmails.add(normalizedEmail);
      pendingEmails.push(email);
    }
    if (orderId && !pendingOrderIdSet.has(orderId)) {
      pendingOrderIdSet.add(orderId);
      pendingOrderIds.push(orderId);
    }
  });

  emailedCount = emailedOrderIdSet.size;

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
  if (sendPendingEmailsButton instanceof HTMLButtonElement) {
    sendPendingEmailsButton.disabled = pendingEmails.length === 0;
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

async function saveRegistrationEmailSettings() {
  const productKey = String(registrationEmailProductKey?.value || "").trim();
  if (!productKey) {
    return null;
  }

  const response = await fetch("/api/registrations/event-email-settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({
      productKey,
      productName: String(registrationEmailProductName?.value || "").trim(),
      eventDate: String(registrationEventDateInput?.value || "").trim(),
      useSecondEventDate: registrationUseSecondEventDateInput instanceof HTMLInputElement
        ? registrationUseSecondEventDateInput.checked
        : false,
      eventDate2:
        registrationUseSecondEventDateInput instanceof HTMLInputElement && registrationUseSecondEventDateInput.checked
          ? String(registrationEventDate2Input?.value || "").trim()
          : "",
      emailSubject: String(registrationEmailSubjectInput?.value || "").trim(),
      emailBody: String(registrationEmailBodyInput?.value || "").trim(),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = typeof payload.error === "string" && payload.error ? payload.error : "Opslaan lukte niet.";
    const error = new Error(errorMessage);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function syncSecondEventDateField() {
  const useSecondDate =
    registrationUseSecondEventDateInput instanceof HTMLInputElement && registrationUseSecondEventDateInput.checked;

  if (registrationSecondEventDateField instanceof HTMLElement) {
    registrationSecondEventDateField.hidden = !useSecondDate;
  }
  if (registrationEventDate2Input instanceof HTMLInputElement) {
    registrationEventDate2Input.disabled = !useSecondDate;
    if (!useSecondDate) {
      registrationEventDate2Input.value = "";
    }
  }
}

function replaceRegistrationEmailSelection(nextValue, selectionStart, selectionEnd) {
  if (!(registrationEmailBodyInput instanceof HTMLTextAreaElement)) {
    return;
  }
  registrationEmailBodyInput.value = nextValue;
  registrationEmailBodyInput.focus();
  registrationEmailBodyInput.setSelectionRange(selectionStart, selectionEnd);
}

function formatRegistrationEmailSelection(format) {
  if (!(registrationEmailBodyInput instanceof HTMLTextAreaElement)) {
    return;
  }

  const start = registrationEmailBodyInput.selectionStart;
  const end = registrationEmailBodyInput.selectionEnd;
  const value = registrationEmailBodyInput.value;
  const selectedText = value.slice(start, end);

  if (format === "bold" || format === "italic") {
    const marker = format === "bold" ? "**" : "*";
    const fallbackText = format === "bold" ? "tekst" : "tekst";
    const innerText = selectedText || fallbackText;
    const formattedText = `${marker}${innerText}${marker}`;
    replaceRegistrationEmailSelection(
      `${value.slice(0, start)}${formattedText}${value.slice(end)}`,
      start + marker.length,
      start + marker.length + innerText.length
    );
    return;
  }

  if (format === "bullet") {
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEnd = end;
    const selectedLines = value.slice(lineStart, lineEnd);
    const sourceLines = selectedLines ? selectedLines.split("\n") : [""];
    const formattedLines = sourceLines
      .map((line) => {
        const trimmedLine = line.trimStart();
        if (!trimmedLine) {
          return "- ";
        }
        if (/^([-*]|&bull;|•)\s+/.test(trimmedLine)) {
          return line;
        }
        return `${line.slice(0, line.length - trimmedLine.length)}- ${trimmedLine}`;
      })
      .join("\n");
    const nextValue = `${value.slice(0, lineStart)}${formattedLines}${value.slice(lineEnd)}`;
    const nextCursor = lineStart + formattedLines.length;
    replaceRegistrationEmailSelection(nextValue, nextCursor, nextCursor);
  }
}

async function sendPendingRegistrationEmails() {
  const productKey = String(sendPendingEmailsButton?.dataset.productKey || "").trim();
  if (!productKey) {
    return null;
  }

  const response = await fetch("/api/registrations/send-event-email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ productKey }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = typeof payload.error === "string" && payload.error ? payload.error : "Versturen lukte niet.";
    const error = new Error(errorMessage);
    error.payload = payload;
    throw error;
  }
  return payload;
}

function refreshRegistrationEmailTemplateOptions(templates) {
  if (!(registrationEmailTemplateSelect instanceof HTMLSelectElement) || !Array.isArray(templates)) {
    return;
  }

  registrationEmailTemplates = templates;
  const currentValue = registrationEmailTemplateSelect.value;
  registrationEmailTemplateSelect.innerHTML = '<option value="">Kies een eerdere mailtekst</option>';
  registrationEmailTemplates.forEach((template) => {
    const option = document.createElement("option");
    option.value = String(template.productKey || "");
    option.textContent = String(template.label || template.productName || template.productKey || "Eerdere mail");
    registrationEmailTemplateSelect.append(option);
  });
  registrationEmailTemplateSelect.value = registrationEmailTemplates.some((template) => template.productKey === currentValue)
    ? currentValue
    : "";
}

function applySelectedRegistrationEmailTemplate() {
  if (!(registrationEmailTemplateSelect instanceof HTMLSelectElement)) {
    return;
  }

  const selectedTemplate = registrationEmailTemplates.find(
    (template) => String(template.productKey || "") === String(registrationEmailTemplateSelect.value || "")
  );
  if (!selectedTemplate) {
    return;
  }

  if (registrationEmailSubjectInput instanceof HTMLInputElement && selectedTemplate.emailSubject) {
    registrationEmailSubjectInput.value = String(selectedTemplate.emailSubject || "");
  }
  if (registrationEmailBodyInput instanceof HTMLTextAreaElement) {
    registrationEmailBodyInput.value = String(selectedTemplate.emailBody || "");
  }
  if (registrationEmailSettingsFeedback) {
    registrationEmailSettingsFeedback.textContent = "Tekst overgenomen. Sla op om deze mail aan dit product te koppelen.";
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

async function completeRegistrationEventInEcwid() {
  const productKey = String(completeRegistrationEventButton?.dataset.productKey || "").trim();
  if (!productKey) {
    return null;
  }

  const response = await fetch("/api/registrations/event-completed", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ productKey }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = typeof payload.error === "string" && payload.error ? payload.error : "Event afronden lukte niet.";
    const error = new Error(errorMessage);
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function cancelRegistrationEventInEcwid() {
  const productKey = String(cancelRegistrationEventButton?.dataset.productKey || "").trim();
  if (!productKey) {
    return null;
  }

  const response = await fetch("/api/registrations/event-canceled", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({ productKey }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = typeof payload.error === "string" && payload.error ? payload.error : "Event annuleren lukte niet.";
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
    await copyTextWithFallback(emails);
  } catch (error) {
    if (copyFeedback) {
      copyFeedback.textContent = "Kopieren lukte niet. Selecteer de adressen handmatig.";
    }
    return;
  }

  try {
    await updateRegistrationEmailStatus(pendingOrderIds, true);
    pendingOrderIds.forEach((orderId) => {
      getRegistrationCheckboxesForOrder(orderId).forEach((checkbox) => {
        checkbox.checked = true;
      });
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

async function handleSendPendingRegistrationEmails() {
  if (!(sendPendingEmailsButton instanceof HTMLButtonElement)) {
    return;
  }

  const { pendingOrderIds } = getRegistrationEmailState();
  if (!pendingOrderIds.length) {
    return;
  }

  const confirmed = window.confirm(
    `Weet je zeker dat je de standaardmail wilt versturen naar ${pendingOrderIds.length} nog niet gemailde bestelling(en)?`
  );
  if (!confirmed) {
    return;
  }

  sendPendingEmailsButton.disabled = true;
  if (copyFeedback) {
    copyFeedback.textContent = "Standaardmails versturen...";
  }

  try {
    const payload = await sendPendingRegistrationEmails();
    const sentOrderIds = Array.isArray(payload?.sentOrderIds) ? payload.sentOrderIds : [];
    sentOrderIds.forEach((orderId) => {
      getRegistrationCheckboxesForOrder(orderId).forEach((checkbox) => {
        checkbox.checked = true;
      });
    });
    syncRegistrationOrderUI();
    if (copyFeedback) {
      copyFeedback.textContent = payload?.message || "Standaardmails verstuurd.";
    }
  } catch (error) {
    if (copyFeedback) {
      copyFeedback.textContent =
        error instanceof Error && error.message ? error.message : "Versturen lukte niet. Probeer het opnieuw.";
    }
  } finally {
    syncRegistrationOrderUI();
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
    getRegistrationCheckboxesForOrder(orderId).forEach((relatedCheckbox) => {
      relatedCheckbox.checked = checkbox.checked;
    });
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

async function handleRegistrationEmailSettingsSubmit(event) {
  event.preventDefault();
  if (!(saveRegistrationEmailSettingsButton instanceof HTMLButtonElement)) {
    return;
  }

  saveRegistrationEmailSettingsButton.disabled = true;
  if (registrationEmailSettingsFeedback) {
    registrationEmailSettingsFeedback.textContent = "Mailinstellingen opslaan...";
  }

  try {
    const payload = await saveRegistrationEmailSettings();
    refreshRegistrationEmailTemplateOptions(payload?.templates || []);
    if (registrationEmailSettingsFeedback) {
      registrationEmailSettingsFeedback.textContent = payload?.message || "Mailinstellingen opgeslagen.";
    }
  } catch (error) {
    if (registrationEmailSettingsFeedback) {
      registrationEmailSettingsFeedback.textContent =
        error instanceof Error && error.message ? error.message : "Opslaan lukte niet. Probeer het opnieuw.";
    }
  } finally {
    saveRegistrationEmailSettingsButton.disabled = false;
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

async function handleCompleteRegistrationEvent() {
  if (!(completeRegistrationEventButton instanceof HTMLButtonElement)) {
    return;
  }

  const confirmed = window.confirm(
    "Weet je zeker dat je dit event wilt afronden en alle bijbehorende Ecwid-bestellingen op geleverd wilt zetten?"
  );
  if (!confirmed) {
    return;
  }

  completeRegistrationEventButton.disabled = true;
  if (cancelRegistrationEventButton instanceof HTMLButtonElement) {
    cancelRegistrationEventButton.disabled = true;
  }
  if (registrationEventFeedback) {
    registrationEventFeedback.textContent = "Event afronden en Ecwid bijwerken...";
  }

  try {
    const payload = await completeRegistrationEventInEcwid();
    if (registrationEventStatusText) {
      registrationEventStatusText.textContent = "Event afgerond";
    }
    if (registrationEventFeedback) {
      registrationEventFeedback.textContent = payload?.message || "Event afgerond en bestellingen op geleverd gezet.";
    }
  } catch (error) {
    completeRegistrationEventButton.disabled = false;
    if (cancelRegistrationEventButton instanceof HTMLButtonElement) {
      cancelRegistrationEventButton.disabled = false;
    }
    if (registrationEventFeedback) {
      registrationEventFeedback.textContent =
        error instanceof Error && error.message ? error.message : "Event afronden lukte niet. Probeer het opnieuw.";
    }
  }
}

async function handleCancelRegistrationEvent() {
  if (!(cancelRegistrationEventButton instanceof HTMLButtonElement)) {
    return;
  }

  const confirmed = window.confirm(
    "Weet je zeker dat je dit event wilt annuleren en alle bijbehorende Ecwid-bestellingen op geretourneerd wilt zetten?"
  );
  if (!confirmed) {
    return;
  }

  cancelRegistrationEventButton.disabled = true;
  if (completeRegistrationEventButton instanceof HTMLButtonElement) {
    completeRegistrationEventButton.disabled = true;
  }
  if (registrationEventFeedback) {
    registrationEventFeedback.textContent = "Event annuleren en Ecwid bijwerken...";
  }

  try {
    const payload = await cancelRegistrationEventInEcwid();
    if (registrationEventStatusText) {
      registrationEventStatusText.textContent = "Event geannuleerd";
    }
    if (registrationEventFeedback) {
      registrationEventFeedback.textContent =
        payload?.message || "Event geannuleerd en bestellingen op geretourneerd gezet.";
    }
  } catch (error) {
    cancelRegistrationEventButton.disabled = false;
    if (completeRegistrationEventButton instanceof HTMLButtonElement) {
      completeRegistrationEventButton.disabled = false;
    }
    if (registrationEventFeedback) {
      registrationEventFeedback.textContent =
        error instanceof Error && error.message ? error.message : "Event annuleren lukte niet. Probeer het opnieuw.";
    }
  }
}

productSearchInput?.addEventListener("input", filterProducts);
productSearchInput?.addEventListener("search", filterProducts);
productSearchInput?.addEventListener("change", filterProducts);
copyEmailsButton?.addEventListener("click", copyRegistrationEmails);
copyPendingEmailsButton?.addEventListener("click", copyPendingRegistrationEmails);
sendPendingEmailsButton?.addEventListener("click", handleSendPendingRegistrationEmails);
registrationEmailFormatButtons.forEach((button) => {
  button.addEventListener("click", () => formatRegistrationEmailSelection(String(button.dataset.emailFormat || "")));
});
registrationEmailSettingsForm?.addEventListener("submit", handleRegistrationEmailSettingsSubmit);
registrationEmailTemplateSelect?.addEventListener("change", applySelectedRegistrationEmailTemplate);
registrationUseSecondEventDateInput?.addEventListener("change", syncSecondEventDateField);
emailedCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", handleRegistrationEmailedToggle);
});
syncEmailedOrdersButton?.addEventListener("click", handleSyncEmailedOrders);
completeRegistrationEventButton?.addEventListener("click", handleCompleteRegistrationEvent);
cancelRegistrationEventButton?.addEventListener("click", handleCancelRegistrationEvent);

filterProducts();
syncSecondEventDateField();
syncRegistrationOrderUI();
