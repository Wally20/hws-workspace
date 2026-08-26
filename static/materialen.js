(function () {
  const form = document.querySelector("[data-materials-form]");
  if (!form) {
    return;
  }

  const materialList = form.querySelector("[data-material-list]");
  const clubList = form.querySelector("[data-club-list]");
  const materialTemplate = document.getElementById("materialRowTemplate");
  const clubTemplate = document.getElementById("clubRowTemplate");
  const clubExportModal = form.querySelector("[data-club-export-modal]");

  const parseCount = (value) => {
    const number = Number.parseInt(String(value || "0"), 10);
    return Number.isFinite(number) && number > 0 ? number : 0;
  };

  const makeKey = (prefix) => `${prefix}-new-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  const getMaterialRows = () => Array.from(form.querySelectorAll("[data-material-row]"));
  const getClubRows = () => Array.from(form.querySelectorAll("[data-club-row]"));

  const getMaterialName = (materialRow) => {
    const input = materialRow.querySelector('input[name="material_name"]');
    return String(input ? input.value : "").trim() || "Materiaal";
  };

  const getClubName = (clubRow) => {
    const input = clubRow.querySelector("[data-club-name-input]");
    return String(input ? input.value : "").trim() || "Nieuwe club";
  };

  const normalizeSearch = (value) => String(value || "").trim().toLowerCase();

  const setModalOpen = (clubRow, isOpen) => {
    const modal = clubRow.querySelector("[data-club-modal]");
    if (!modal) {
      return;
    }
    modal.hidden = !isOpen;
    document.body.classList.toggle("materials-modal-open", isOpen);
    if (isOpen) {
      const input = clubRow.querySelector("[data-club-name-input]");
      if (input) {
        input.focus();
      }
    }
  };

  const closeAllClubModals = () => {
    getClubRows().forEach((clubRow) => setModalOpen(clubRow, false));
  };

  const getExportClubCheckboxes = () => (
    clubExportModal
      ? Array.from(clubExportModal.querySelectorAll("[data-export-club-checkbox]"))
      : []
  );

  const updateClubExportSelection = () => {
    const checkboxes = getExportClubCheckboxes();
    const selectedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
    const count = clubExportModal?.querySelector("[data-club-export-count]");
    const exportButton = clubExportModal?.querySelector("[data-export-selected-clubs]");
    if (count) {
      count.textContent = `${selectedCount} van ${checkboxes.length} clubs geselecteerd`;
    }
    if (exportButton) {
      exportButton.disabled = selectedCount === 0;
    }
  };

  const setClubExportModalOpen = (isOpen) => {
    if (!clubExportModal) {
      return;
    }
    clubExportModal.hidden = !isOpen;
    document.body.classList.toggle("materials-modal-open", isOpen);
    if (isOpen) {
      updateClubExportSelection();
      clubExportModal.querySelector("[data-export-club-checkbox]")?.focus();
    }
  };

  const syncClubTile = (clubRow) => {
    const title = clubRow.querySelector("[data-club-title]");
    if (title) {
      title.textContent = getClubName(clubRow);
    }
  };

  const applyClubMaterialFilter = (clubRow) => {
    const searchInput = clubRow.querySelector("[data-club-material-search]");
    const query = normalizeSearch(searchInput ? searchInput.value : "");

    clubRow.querySelectorAll("[data-club-material-field]").forEach((field) => {
      const label = field.querySelector("[data-club-material-label]");
      const materialName = normalizeSearch(label ? label.textContent : "");
      field.hidden = Boolean(query) && !materialName.includes(query);
    });
  };

  const applyAllClubMaterialFilters = () => {
    getClubRows().forEach(applyClubMaterialFilter);
  };

  const updateChoiceState = (field) => {
    const checkbox = field.querySelector("[data-club-material-toggle]");
    const input = field.querySelector("[data-club-quantity]");
    if (!checkbox || !input) {
      return;
    }
    input.disabled = !checkbox.checked;
    field.classList.toggle("materials-club-material-choice-active", checkbox.checked);
    if (!checkbox.checked) {
      input.value = "0";
    }
  };

  const buildClubMaterialField = (clubKey, materialKey, materialName) => {
    const label = document.createElement("label");
    label.className = "materials-club-material-choice";
    label.setAttribute("data-club-material-field", "");
    label.dataset.materialKey = materialKey;

    const checkWrap = document.createElement("span");
    checkWrap.className = "materials-choice-check";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.setAttribute("data-club-material-toggle", "");

    const name = document.createElement("span");
    name.setAttribute("data-club-material-label", "");
    name.textContent = materialName || "Materiaal";

    const available = document.createElement("output");
    available.className = "materials-choice-available";
    available.setAttribute("data-club-material-available", "");
    available.textContent = "Beschikbaar: 0";

    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.name = `quantity__${clubKey}__${materialKey}`;
    quantity.value = "0";
    quantity.min = "0";
    quantity.step = "1";
    quantity.inputMode = "numeric";
    quantity.disabled = true;
    quantity.setAttribute("data-club-quantity", "");

    checkWrap.append(checkbox, name);
    label.append(checkWrap, available, quantity);
    return label;
  };

  const syncClubMaterialFields = () => {
    const materials = getMaterialRows().map((row) => ({
      key: row.dataset.materialKey,
      name: getMaterialName(row),
    }));

    getClubRows().forEach((clubRow) => {
      const clubKey = clubRow.dataset.clubKey;
      const fieldsWrap = clubRow.querySelector("[data-club-materials]");
      if (!fieldsWrap || !clubKey) {
        return;
      }

      Array.from(fieldsWrap.querySelectorAll("[data-club-material-field]")).forEach((field) => {
        if (!materials.some((material) => material.key === field.dataset.materialKey)) {
          field.remove();
        }
      });

      materials.forEach((material) => {
        let field = fieldsWrap.querySelector(`[data-club-material-field][data-material-key="${CSS.escape(material.key)}"]`);
        if (!field) {
          field = buildClubMaterialField(clubKey, material.key, material.name);
          fieldsWrap.appendChild(field);
        }

        const label = field.querySelector("[data-club-material-label]");
        if (label) {
          label.textContent = material.name;
        }

        const input = field.querySelector("[data-club-quantity]");
        if (input) {
          input.name = `quantity__${clubKey}__${material.key}`;
          const checkbox = field.querySelector("[data-club-material-toggle]");
          if (checkbox && parseCount(input.value) > 0) {
            checkbox.checked = true;
          }
        }
        updateChoiceState(field);
      });

      syncClubTile(clubRow);
      applyClubMaterialFilter(clubRow);
    });
  };

  const recalculate = () => {
    syncClubMaterialFields();
    const availableByMaterial = new Map();

    getClubRows().forEach((clubRow) => {
      let clubTotal = 0;
      clubRow.querySelectorAll("[data-club-quantity]").forEach((input) => {
        if (!input.disabled) {
          clubTotal += parseCount(input.value);
        }
      });
      const clubOutput = clubRow.querySelector("[data-club-total]");
      if (clubOutput) {
        clubOutput.value = String(clubTotal);
        clubOutput.textContent = String(clubTotal);
      }
    });

    getMaterialRows().forEach((materialRow) => {
      const materialKey = materialRow.dataset.materialKey;
      const totalInput = materialRow.querySelector("[data-material-total-input]");
      const total = parseCount(totalInput ? totalInput.value : 0);
      let allocated = 0;

      getClubRows().forEach((clubRow) => {
        const input = clubRow.querySelector(`[data-club-material-field][data-material-key="${CSS.escape(materialKey)}"] [data-club-quantity]`);
        if (input && !input.disabled) {
          allocated += parseCount(input.value);
        }
      });

      const available = total - allocated;
      const allocatedRowOutput = materialRow.querySelector("[data-material-allocated]");
      const availableRowOutput = materialRow.querySelector("[data-material-available]");

      if (allocatedRowOutput) {
        allocatedRowOutput.value = String(allocated);
        allocatedRowOutput.textContent = String(allocated);
      }
      if (availableRowOutput) {
        availableRowOutput.value = String(available);
        availableRowOutput.textContent = String(available);
        availableRowOutput.classList.toggle("materials-negative", available < 0);
      }
      availableByMaterial.set(materialKey, available);
    });

    getClubRows().forEach((clubRow) => {
      clubRow.querySelectorAll("[data-club-material-field]").forEach((field) => {
        const available = availableByMaterial.get(field.dataset.materialKey) || 0;
        const output = field.querySelector("[data-club-material-available]");
        if (output) {
          output.value = String(available);
          output.textContent = `Beschikbaar: ${available}`;
          output.classList.toggle("materials-negative", available < 0);
        }
      });
    });
  };

  const addMaterial = () => {
    const key = makeKey("material");
    const fragment = materialTemplate.content.cloneNode(true);
    const row = fragment.querySelector("[data-material-row]");
    row.dataset.materialKey = key;
    row.querySelector('input[name="material_key"]').value = key;
    materialList.appendChild(fragment);
    recalculate();
    row.querySelector('input[name="material_name"]').focus();
  };

  const addClub = () => {
    const key = makeKey("club");
    const fragment = clubTemplate.content.cloneNode(true);
    const row = fragment.querySelector("[data-club-row]");
    row.dataset.clubKey = key;
    row.querySelector('input[name="club_key"]').value = key;
    clubList.appendChild(fragment);
    recalculate();
    setModalOpen(row, true);
  };

  form.addEventListener("click", (event) => {
    const addMaterialButton = event.target.closest("[data-add-material]");
    const addClubButton = event.target.closest("[data-add-club]");
    const removeMaterialButton = event.target.closest("[data-remove-material]");
    const removeClubButton = event.target.closest("[data-remove-club]");
    const openClubButton = event.target.closest("[data-open-club-modal]");
    const closeClubButton = event.target.closest("[data-close-club-modal]");
    const openClubExportButton = event.target.closest("[data-open-club-export-modal]");
    const closeClubExportButton = event.target.closest("[data-close-club-export-modal]");
    const selectAllExportClubsButton = event.target.closest("[data-select-all-export-clubs]");
    const clearExportClubsButton = event.target.closest("[data-clear-export-clubs]");
    const exportSelectedClubsButton = event.target.closest("[data-export-selected-clubs]");

    if (addMaterialButton) {
      addMaterial();
      return;
    }
    if (addClubButton) {
      addClub();
      return;
    }
    if (openClubExportButton) {
      closeAllClubModals();
      setClubExportModalOpen(true);
      return;
    }
    if (closeClubExportButton) {
      setClubExportModalOpen(false);
      return;
    }
    if (selectAllExportClubsButton || clearExportClubsButton) {
      getExportClubCheckboxes().forEach((checkbox) => {
        checkbox.checked = Boolean(selectAllExportClubsButton);
      });
      updateClubExportSelection();
      return;
    }
    if (exportSelectedClubsButton) {
      const params = new URLSearchParams();
      getExportClubCheckboxes().forEach((checkbox) => {
        if (checkbox.checked) {
          params.append("club_id", checkbox.value);
        }
      });
      if (params.has("club_id")) {
        setClubExportModalOpen(false);
        window.location.assign(`/materialen/clubs/export-pdf?${params.toString()}`);
      }
      return;
    }
    if (removeMaterialButton) {
      const rows = getMaterialRows();
      if (rows.length > 1) {
        removeMaterialButton.closest("[data-material-row]").remove();
        recalculate();
      }
      return;
    }
    if (removeClubButton) {
      const clubRow = removeClubButton.closest("[data-club-row]");
      if (clubRow) {
        clubRow.remove();
        recalculate();
      }
      return;
    }
    if (openClubButton) {
      const clubRow = openClubButton.closest("[data-club-row]");
      if (clubRow) {
        closeAllClubModals();
        setModalOpen(clubRow, true);
      }
      return;
    }
    if (closeClubButton) {
      const clubRow = closeClubButton.closest("[data-club-row]");
      if (clubRow) {
        setModalOpen(clubRow, false);
      }
    }
  });

  form.addEventListener("change", (event) => {
    if (event.target.matches("[data-export-club-checkbox]")) {
      updateClubExportSelection();
      return;
    }
    const checkbox = event.target.closest("[data-club-material-toggle]");
    if (!checkbox) {
      return;
    }
    const field = checkbox.closest("[data-club-material-field]");
    updateChoiceState(field);
    const input = field.querySelector("[data-club-quantity]");
    if (checkbox.checked && input) {
      input.disabled = false;
      input.focus();
    }
    recalculate();
  });

  form.addEventListener("input", (event) => {
    if (
      event.target.matches('input[name="material_name"]') ||
      event.target.matches("[data-material-total-input]") ||
      event.target.matches("[data-club-quantity]") ||
      event.target.matches("[data-club-name-input]") ||
      event.target.matches("[data-club-material-search]")
    ) {
      if (event.target.matches("[data-club-material-search]")) {
        const clubRow = event.target.closest("[data-club-row]");
        if (clubRow) {
          applyClubMaterialFilter(clubRow);
        }
        return;
      }
      recalculate();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllClubModals();
      setClubExportModalOpen(false);
    }
  });

  recalculate();
  applyAllClubMaterialFilters();
  updateClubExportSelection();
})();
