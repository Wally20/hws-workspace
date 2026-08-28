const ORDER_SELECTION_STORAGE_KEY = "hws-selected-orders";

const orderCheckboxes = Array.from(document.querySelectorAll(".order-select-input"));
const selectAllOrdersCheckbox = document.querySelector("#selectAllOrders");
const selectedOrderIdsInput = document.querySelector("#selectedOrderIdsInput");
const selectedOrdersCount = document.querySelector("#selectedOrdersCount");
const exportOrdersButton = document.querySelector("#exportOrdersButton");
const ordersExportForm = document.querySelector("#ordersExportForm");

function loadSelectedOrderIds() {
  try {
    const rawValue = window.localStorage.getItem(ORDER_SELECTION_STORAGE_KEY);
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((value) => String(value)).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function saveSelectedOrderIds(selectedIds) {
  window.localStorage.setItem(ORDER_SELECTION_STORAGE_KEY, JSON.stringify(selectedIds));
}

function syncOrdersSelectionUi() {
  const selectedIds = loadSelectedOrderIds();
  const selectedIdSet = new Set(selectedIds);

  orderCheckboxes.forEach((checkbox) => {
    checkbox.checked = selectedIdSet.has(String(checkbox.dataset.orderId || checkbox.value || ""));
  });

  const visibleCheckboxes = orderCheckboxes.filter((checkbox) => !checkbox.disabled);
  const selectedVisibleCount = visibleCheckboxes.filter((checkbox) => checkbox.checked).length;

  if (selectAllOrdersCheckbox) {
    selectAllOrdersCheckbox.checked = visibleCheckboxes.length > 0 && selectedVisibleCount === visibleCheckboxes.length;
    selectAllOrdersCheckbox.indeterminate =
      selectedVisibleCount > 0 && selectedVisibleCount < visibleCheckboxes.length;
  }

  if (selectedOrderIdsInput) {
    selectedOrderIdsInput.value = selectedIds.join(",");
  }

  if (selectedOrdersCount) {
    selectedOrdersCount.textContent = String(selectedIds.length);
  }

  if (exportOrdersButton) {
    exportOrdersButton.disabled = selectedIds.length === 0;
  }
}

function toggleSingleOrderSelection(orderId, isSelected) {
  const selectedIds = loadSelectedOrderIds();
  const nextIds = selectedIds.filter((value) => value !== orderId);
  if (isSelected) {
    nextIds.push(orderId);
  }
  saveSelectedOrderIds(nextIds);
  syncOrdersSelectionUi();
}

function toggleVisibleOrdersSelection(isSelected) {
  const selectedIds = new Set(loadSelectedOrderIds());
  orderCheckboxes.forEach((checkbox) => {
    const orderId = String(checkbox.dataset.orderId || checkbox.value || "");
    if (!orderId) {
      return;
    }
    if (isSelected) {
      selectedIds.add(orderId);
    } else {
      selectedIds.delete(orderId);
    }
  });
  saveSelectedOrderIds(Array.from(selectedIds));
  syncOrdersSelectionUi();
}

orderCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    const orderId = String(checkbox.dataset.orderId || checkbox.value || "");
    if (!orderId) {
      return;
    }
    toggleSingleOrderSelection(orderId, checkbox.checked);
  });
});

selectAllOrdersCheckbox?.addEventListener("change", () => {
  toggleVisibleOrdersSelection(selectAllOrdersCheckbox.checked);
});

ordersExportForm?.addEventListener("submit", (event) => {
  const selectedIds = loadSelectedOrderIds();
  if (!selectedIds.length) {
    event.preventDefault();
    return;
  }
  if (selectedOrderIdsInput) {
    selectedOrderIdsInput.value = selectedIds.join(",");
  }
});

syncOrdersSelectionUi();
