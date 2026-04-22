const productSearchInput = document.querySelector("#registrationsProductSearch");
const productList = document.querySelector("#registrationsProductList");
const productCards = Array.from(document.querySelectorAll(".registrations-product-card"));
const copyEmailsButton = document.querySelector("#copyRegistrationEmailsButton");
const copyFeedback = document.querySelector("#registrationCopyFeedback");

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
  const emails = String(copyEmailsButton?.dataset.emails || "").trim();
  if (!emails) {
    return;
  }

  try {
    await navigator.clipboard.writeText(emails);
    if (copyFeedback) {
      copyFeedback.textContent = "E-mailadressen gekopieerd.";
    }
  } catch (error) {
    if (copyFeedback) {
      copyFeedback.textContent = "Kopieren lukte niet. Selecteer de adressen handmatig.";
    }
  }
}

productSearchInput?.addEventListener("input", filterProducts);
productSearchInput?.addEventListener("search", filterProducts);
productSearchInput?.addEventListener("change", filterProducts);
copyEmailsButton?.addEventListener("click", copyRegistrationEmails);

filterProducts();
