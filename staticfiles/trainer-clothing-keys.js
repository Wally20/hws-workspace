const TRAINER_KEY_SET_LIMIT = 25;

function createTrainerKeySetRow(club = "") {
  const row = document.createElement("div");
  row.className = "trainer-key-set-row";
  row.dataset.keySetRow = "";

  const label = document.createElement("label");
  label.className = "field";
  const labelText = document.createElement("span");
  labelText.textContent = "Club";
  const input = document.createElement("input");
  input.type = "text";
  input.name = "key_set_club";
  input.value = String(club || "");
  input.maxLength = 100;
  input.placeholder = "Naam van de club";
  label.append(labelText, input);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "subtle-button action-small trainer-key-set-remove";
  removeButton.dataset.removeKeySet = "";
  removeButton.textContent = "Verwijderen";
  row.append(label, removeButton);
  return row;
}

function updateTrainerClothingSizeRequirement(row, requireComplete) {
  const quantityInput = row.querySelector("[data-clothing-quantity-input]");
  const sizeInput = row.querySelector("[data-clothing-size-input]");
  if (!(quantityInput instanceof HTMLInputElement) || !(sizeInput instanceof HTMLInputElement)) return;
  const quantity = Number.parseInt(quantityInput.value || "0", 10);
  sizeInput.required = requireComplete && Number.isFinite(quantity) && quantity > 0;
}

function updateTrainerKeySetScope(scope) {
  const rows = scope.querySelectorAll("[data-key-set-row]");
  const addButton = scope.querySelector("[data-add-key-set]");
  const noKeySetsInput = scope.querySelector("[data-no-key-sets]");
  const hasNoKeySets = noKeySetsInput instanceof HTMLInputElement && noKeySetsInput.checked;

  rows.forEach((row) => {
    const input = row.querySelector('input[name="key_set_club"]');
    if (input instanceof HTMLInputElement) input.disabled = hasNoKeySets;
  });
  if (addButton instanceof HTMLButtonElement) {
    addButton.disabled = hasNoKeySets || rows.length >= TRAINER_KEY_SET_LIMIT;
  }
}

function initializeTrainerClothingKeysScope(scope) {
  const requireComplete = scope.dataset.requireComplete === "1";
  scope.querySelectorAll("[data-clothing-key]").forEach((row) => {
    updateTrainerClothingSizeRequirement(row, requireComplete);
    row.querySelector("[data-clothing-quantity-input]")?.addEventListener("input", () => {
      updateTrainerClothingSizeRequirement(row, requireComplete);
    });
  });

  scope.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("[data-add-key-set]")) {
      const rowsContainer = scope.querySelector("[data-key-set-rows]");
      if (!rowsContainer || rowsContainer.querySelectorAll("[data-key-set-row]").length >= TRAINER_KEY_SET_LIMIT) return;
      const row = createTrainerKeySetRow();
      rowsContainer.appendChild(row);
      row.querySelector("input")?.focus();
      updateTrainerKeySetScope(scope);
      return;
    }
    const removeButton = target.closest("[data-remove-key-set]");
    if (!removeButton) return;
    const rowsContainer = scope.querySelector("[data-key-set-rows]");
    removeButton.closest("[data-key-set-row]")?.remove();
    if (rowsContainer && !rowsContainer.querySelector("[data-key-set-row]")) {
      rowsContainer.appendChild(createTrainerKeySetRow());
    }
    updateTrainerKeySetScope(scope);
  });

  scope.querySelector("[data-no-key-sets]")?.addEventListener("change", () => updateTrainerKeySetScope(scope));
  updateTrainerKeySetScope(scope);
}

window.setTrainerClothingKeysData = (scope, clothingItems = [], keySets = []) => {
  if (!(scope instanceof HTMLElement)) return;
  const clothingByKey = new Map(
    (Array.isArray(clothingItems) ? clothingItems : []).map((item) => [String(item?.key || ""), item])
  );
  scope.querySelectorAll("[data-clothing-key]").forEach((row) => {
    const item = clothingByKey.get(row.dataset.clothingKey || "") || {};
    const quantityInput = row.querySelector("[data-clothing-quantity-input]");
    const sizeInput = row.querySelector("[data-clothing-size-input]");
    if (quantityInput instanceof HTMLInputElement) quantityInput.value = String(item.quantity || 0);
    if (sizeInput instanceof HTMLInputElement) sizeInput.value = String(item.size || "");
    updateTrainerClothingSizeRequirement(row, scope.dataset.requireComplete === "1");
  });

  const rowsContainer = scope.querySelector("[data-key-set-rows]");
  if (rowsContainer) {
    rowsContainer.innerHTML = "";
    const clubs = (Array.isArray(keySets) ? keySets : [])
      .map((item) => String(item?.club || "").trim())
      .filter(Boolean)
      .slice(0, TRAINER_KEY_SET_LIMIT);
    (clubs.length ? clubs : [""]).forEach((club) => rowsContainer.appendChild(createTrainerKeySetRow(club)));
  }
  const noKeySetsInput = scope.querySelector("[data-no-key-sets]");
  if (noKeySetsInput instanceof HTMLInputElement) noKeySetsInput.checked = false;
  updateTrainerKeySetScope(scope);
};

document.querySelectorAll("[data-clothing-keys-scope]").forEach(initializeTrainerClothingKeysScope);
