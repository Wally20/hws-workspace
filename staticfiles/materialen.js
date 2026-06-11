(function () {
  const form = document.querySelector("[data-materials-form]");
  if (!form) {
    return;
  }

  const materialList = form.querySelector("[data-material-list]");
  const clubList = form.querySelector("[data-club-list]");
  const materialTemplate = document.getElementById("materialRowTemplate");
  const clubTemplate = document.getElementById("clubRowTemplate");
  const totalOutput = document.querySelector("[data-materials-total]");
  const allocatedOutput = document.querySelector("[data-materials-allocated]");
  const availableOutput = document.querySelector("[data-materials-available]");

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

  const buildClubMaterialField = (clubKey, materialKey, materialName) => {
    const label = document.createElement("label");
    label.setAttribute("data-club-material-field", "");
    label.dataset.materialKey = materialKey;

    const span = document.createElement("span");
    span.textContent = materialName || "Materiaal";

    const input = document.createElement("input");
    input.type = "number";
    input.name = `quantity__${clubKey}__${materialKey}`;
    input.value = "0";
    input.min = "0";
    input.step = "1";
    input.inputMode = "numeric";
    input.setAttribute("data-club-quantity", "");

    label.append(span, input);
    return label;
  };

  const syncClubMaterialFields = () => {
    const materials = getMaterialRows().map((row) => ({
      key: row.dataset.materialKey,
      name: getMaterialName(row),
    }));

    getClubRows().forEach((clubRow) => {
      const clubKey = clubRow.dataset.clubKey;
      const fieldsWrap = clubRow.querySelector(".materials-club-materials");
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
        const label = field.querySelector("span");
        if (label) {
          label.textContent = material.name;
        }
        const input = field.querySelector("[data-club-quantity]");
        if (input) {
          input.name = `quantity__${clubKey}__${material.key}`;
        }
      });
    });
  };

  const recalculate = () => {
    syncClubMaterialFields();

    let grandTotal = 0;
    let grandAllocated = 0;
    let grandAvailable = 0;

    getClubRows().forEach((clubRow) => {
      let clubTotal = 0;
      clubRow.querySelectorAll("[data-club-quantity]").forEach((input) => {
        clubTotal += parseCount(input.value);
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
        allocated += parseCount(input ? input.value : 0);
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

      grandTotal += total;
      grandAllocated += allocated;
      grandAvailable += available;
    });

    if (totalOutput) {
      totalOutput.textContent = String(grandTotal);
    }
    if (allocatedOutput) {
      allocatedOutput.textContent = String(grandAllocated);
    }
    if (availableOutput) {
      availableOutput.textContent = String(grandAvailable);
      availableOutput.classList.toggle("materials-negative", grandAvailable < 0);
    }
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
    row.querySelector('input[name="club_name"]').focus();
  };

  form.addEventListener("click", (event) => {
    const addMaterialButton = event.target.closest("[data-add-material]");
    const addClubButton = event.target.closest("[data-add-club]");
    const removeMaterialButton = event.target.closest("[data-remove-material]");
    const removeClubButton = event.target.closest("[data-remove-club]");

    if (addMaterialButton) {
      addMaterial();
      return;
    }
    if (addClubButton) {
      addClub();
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
      removeClubButton.closest("[data-club-row]").remove();
      recalculate();
    }
  });

  form.addEventListener("input", (event) => {
    if (
      event.target.matches('input[name="material_name"]') ||
      event.target.matches("[data-material-total-input]") ||
      event.target.matches("[data-club-quantity]")
    ) {
      recalculate();
    }
  });

  recalculate();
})();
