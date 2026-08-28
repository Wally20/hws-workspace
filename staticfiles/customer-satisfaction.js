const customerSatisfactionSearchInput = document.querySelector("#customerSatisfactionProductSearch");
const customerSatisfactionProductCards = Array.from(
  document.querySelectorAll("[data-customer-satisfaction-product]")
);

function normalizeCustomerSatisfactionSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function filterCustomerSatisfactionProducts() {
  const queryWords = normalizeCustomerSatisfactionSearchValue(customerSatisfactionSearchInput?.value).split(/\s+/).filter(Boolean);
  customerSatisfactionProductCards.forEach((card) => {
    const searchValue = normalizeCustomerSatisfactionSearchValue(card.dataset.search);
    card.hidden = !queryWords.every((word) => searchValue.includes(word));
  });
}

customerSatisfactionSearchInput?.addEventListener("input", filterCustomerSatisfactionProducts);
customerSatisfactionSearchInput?.addEventListener("search", filterCustomerSatisfactionProducts);
