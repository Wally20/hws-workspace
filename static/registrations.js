const productSearchInput = document.querySelector("#registrationsProductSearch");
const productList = document.querySelector("#registrationsProductList");
const productCards = Array.from(document.querySelectorAll(".registrations-product-card"));
const copyEmailsButton = document.querySelector("#copyRegistrationEmailsButton");
const copyFeedback = document.querySelector("#registrationCopyFeedback");

productCards.forEach((card, index) => {
  card.dataset.originalIndex = String(index);
});

function scoreProductMatch(card, query) {
  const name = String(card.dataset.productName || "").toLowerCase();
  const sku = String(card.dataset.productSku || "").toLowerCase();
  const searchText = String(card.dataset.productSearch || "").toLowerCase();

  if (!query) {
    return 0;
  }

  if (!searchText.includes(query)) {
    return Number.POSITIVE_INFINITY;
  }

  const nameWords = name.split(/\s+/).filter(Boolean);

  if (name === query) {
    return 0;
  }
  if (name.startsWith(query)) {
    return 1;
  }
  if (nameWords.some((word) => word.startsWith(query))) {
    return 2;
  }
  if (name.includes(query)) {
    return 3;
  }
  if (sku === query) {
    return 4;
  }
  if (sku.startsWith(query)) {
    return 5;
  }
  if (sku.includes(query)) {
    return 6;
  }
  return 7;
}

function filterProducts() {
  const query = String(productSearchInput?.value || "").trim().toLowerCase();
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
copyEmailsButton?.addEventListener("click", copyRegistrationEmails);
