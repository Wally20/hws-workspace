const productSearchInput = document.querySelector("#registrationsProductSearch");
const productCards = Array.from(document.querySelectorAll(".registrations-product-card"));
const copyEmailsButton = document.querySelector("#copyRegistrationEmailsButton");
const copyFeedback = document.querySelector("#registrationCopyFeedback");

function filterProducts() {
  const query = String(productSearchInput?.value || "").trim().toLowerCase();

  productCards.forEach((card) => {
    const searchText = String(card.dataset.productSearch || "").toLowerCase();
    const matches = !query || searchText.includes(query);
    card.hidden = !matches;
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
