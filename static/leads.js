const leadsSearchInput = document.querySelector("#leadsProductSearch");
const leadsProductList = document.querySelector("#leadsProductList");
const leadsProductCards = Array.from(document.querySelectorAll(".leads-product-card"));
const copyLeadEmailsButton = document.querySelector("#copyLeadEmailsButton");
const clearLeadSelectionsButton = document.querySelector("#clearLeadSelectionsButton");
const leadCopyFeedback = document.querySelector("#leadCopyFeedback");
const leadEmailsPreview = document.querySelector("#leadEmailsPreview");
const leadsIncludedCount = document.querySelector("#leadsIncludedCount");
const leadsExcludedCount = document.querySelector("#leadsExcludedCount");
const leadsEmailCount = document.querySelector("#leadsEmailCount");
const leadsBlockedCount = document.querySelector("#leadsBlockedCount");
const leadBlockedEmailsInput = document.querySelector("#leadBlockedEmailsInput");
const clearLeadBlockedEmailsButton = document.querySelector("#clearLeadBlockedEmailsButton");
const leadBlockedEmailsFeedback = document.querySelector("#leadBlockedEmailsFeedback");

const INCLUDE_STATE = "include";
const EXCLUDE_STATE = "exclude";
const UNSELECTED_STATE = "none";
const BLOCKED_EMAILS_STORAGE_KEY = "hws-leads-blocked-emails";

leadsProductCards.forEach((card, index) => {
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
  const query = String(leadsSearchInput?.value || "");
  const rankedCards = [];

  leadsProductCards.forEach((card) => {
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
      leadsProductList?.appendChild(card);
    });
}

function parseCardEmails(card) {
  try {
    const parsedEmails = JSON.parse(card.dataset.productEmails || "[]");
    return Array.isArray(parsedEmails) ? parsedEmails : [];
  } catch (error) {
    return [];
  }
}

function parseEmailList(rawValue) {
  return Array.from(
    new Set(
      String(rawValue || "")
        .split(/[\s,;]+/)
        .map((email) => String(email || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function loadBlockedEmails() {
  if (!leadBlockedEmailsInput) {
    return;
  }

  try {
    const storedValue = window.localStorage.getItem(BLOCKED_EMAILS_STORAGE_KEY);
    if (storedValue) {
      leadBlockedEmailsInput.value = storedValue;
    }
  } catch (error) {
    // Ignore storage issues and keep the field usable for the current session.
  }
}

function saveBlockedEmails() {
  if (!leadBlockedEmailsInput) {
    return;
  }

  try {
    window.localStorage.setItem(BLOCKED_EMAILS_STORAGE_KEY, leadBlockedEmailsInput.value);
  } catch (error) {
    // Ignore storage issues and keep the field usable for the current session.
  }
}

function collectEmailsForState(state) {
  const emails = new Set();

  leadsProductCards.forEach((card) => {
    if ((card.dataset.selectionState || UNSELECTED_STATE) !== state) {
      return;
    }

    parseCardEmails(card).forEach((email) => {
      const normalizedEmail = String(email || "").trim();
      if (normalizedEmail) {
        emails.add(normalizedEmail);
      }
    });
  });

  return emails;
}

function renderSelectionState(card) {
  const state = card.dataset.selectionState || UNSELECTED_STATE;
  card.classList.toggle("leads-product-card-included", state === INCLUDE_STATE);
  card.classList.toggle("leads-product-card-excluded", state === EXCLUDE_STATE);
  card.setAttribute("aria-pressed", state === UNSELECTED_STATE ? "false" : "true");
}

function updateLeadSummary() {
  const includedProducts = leadsProductCards.filter(
    (card) => (card.dataset.selectionState || UNSELECTED_STATE) === INCLUDE_STATE
  );
  const excludedProducts = leadsProductCards.filter(
    (card) => (card.dataset.selectionState || UNSELECTED_STATE) === EXCLUDE_STATE
  );
  const includedEmails = collectEmailsForState(INCLUDE_STATE);
  const excludedEmails = collectEmailsForState(EXCLUDE_STATE);
  const blockedEmails = new Set(parseEmailList(leadBlockedEmailsInput?.value || ""));
  const finalEmails = Array.from(includedEmails).filter((email) => !excludedEmails.has(email) && !blockedEmails.has(email.toLowerCase()));
  const finalEmailList = finalEmails.join(", ");

  if (leadsIncludedCount) {
    leadsIncludedCount.textContent = String(includedProducts.length);
  }
  if (leadsExcludedCount) {
    leadsExcludedCount.textContent = String(excludedProducts.length);
  }
  if (leadsEmailCount) {
    leadsEmailCount.textContent = String(finalEmails.length);
  }
  if (leadsBlockedCount) {
    leadsBlockedCount.textContent = String(blockedEmails.size);
  }
  if (leadEmailsPreview) {
    leadEmailsPreview.value = finalEmailList;
  }
  if (copyLeadEmailsButton) {
    copyLeadEmailsButton.disabled = !finalEmailList;
    copyLeadEmailsButton.dataset.emails = finalEmailList;
  }
}

function cycleCardSelection(card) {
  const currentState = card.dataset.selectionState || UNSELECTED_STATE;
  let nextState = INCLUDE_STATE;

  if (currentState === INCLUDE_STATE) {
    nextState = EXCLUDE_STATE;
  } else if (currentState === EXCLUDE_STATE) {
    nextState = UNSELECTED_STATE;
  }

  card.dataset.selectionState = nextState;
  renderSelectionState(card);
  updateLeadSummary();
}

async function copyLeadEmails() {
  const emails = String(copyLeadEmailsButton?.dataset.emails || "").trim();
  if (!emails) {
    return;
  }

  try {
    await navigator.clipboard.writeText(emails);
    if (leadCopyFeedback) {
      leadCopyFeedback.textContent = "E-mailadressen gekopieerd.";
    }
  } catch (error) {
    if (leadCopyFeedback) {
      leadCopyFeedback.textContent = "Kopieren lukte niet. Selecteer de adressen handmatig.";
    }
  }
}

function clearLeadSelections() {
  leadsProductCards.forEach((card) => {
    card.dataset.selectionState = UNSELECTED_STATE;
    renderSelectionState(card);
  });

  if (leadCopyFeedback) {
    leadCopyFeedback.textContent = "";
  }

  updateLeadSummary();
}

function handleBlockedEmailsInput() {
  saveBlockedEmails();
  if (leadBlockedEmailsFeedback) {
    leadBlockedEmailsFeedback.textContent = "Blokkeerlijst opgeslagen.";
  }
  updateLeadSummary();
}

function clearBlockedEmails() {
  if (!leadBlockedEmailsInput) {
    return;
  }

  leadBlockedEmailsInput.value = "";
  saveBlockedEmails();
  if (leadBlockedEmailsFeedback) {
    leadBlockedEmailsFeedback.textContent = "Blokkeerlijst gewist.";
  }
  updateLeadSummary();
}

leadsProductCards.forEach((card) => {
  card.dataset.selectionState = UNSELECTED_STATE;
  renderSelectionState(card);
  card.addEventListener("click", () => {
    cycleCardSelection(card);
  });
});

leadsSearchInput?.addEventListener("input", filterProducts);
leadsSearchInput?.addEventListener("search", filterProducts);
leadsSearchInput?.addEventListener("change", filterProducts);
copyLeadEmailsButton?.addEventListener("click", copyLeadEmails);
clearLeadSelectionsButton?.addEventListener("click", clearLeadSelections);
leadBlockedEmailsInput?.addEventListener("input", handleBlockedEmailsInput);
clearLeadBlockedEmailsButton?.addEventListener("click", clearBlockedEmails);

loadBlockedEmails();
filterProducts();
updateLeadSummary();
