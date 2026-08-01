(function () {
  const importModal = document.getElementById("checklistImportModal");
  const importTriggers = Array.from(document.querySelectorAll("[data-open-checklist-import]"));
  const importCloseButtons = Array.from(document.querySelectorAll("[data-close-checklist-import]"));
  let lastImportTrigger = null;

  const setImportModalOpen = (isOpen, trigger) => {
    if (!importModal) {
      return;
    }
    if (isOpen) {
      lastImportTrigger = trigger || document.activeElement;
    }
    importModal.hidden = !isOpen;
    document.body.classList.toggle("checklist-modal-open", isOpen);
    importTriggers.forEach((button) => button.setAttribute("aria-expanded", isOpen ? "true" : "false"));
    if (isOpen) {
      window.requestAnimationFrame(() => importModal.querySelector("[data-checklist-import-select]")?.focus());
    } else if (lastImportTrigger instanceof HTMLElement) {
      lastImportTrigger.focus();
    }
  };

  importTriggers.forEach((button) => {
    button.addEventListener("click", () => setImportModalOpen(true, button));
  });
  importCloseButtons.forEach((button) => {
    button.addEventListener("click", () => setImportModalOpen(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && importModal && !importModal.hidden) {
      setImportModalOpen(false);
    }
  });
  importModal?.querySelector("[data-checklist-import-form]")?.addEventListener("submit", (event) => {
    const submitButton = event.currentTarget.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Importeren…";
    }
  });

  const editor = document.querySelector("[data-checklist-editor]");
  if (!editor) {
    return;
  }

  const itemTemplate = document.getElementById("checklistItemTemplate");
  const dataInput = editor.querySelector("[data-checklist-data]");
  const countLabels = Array.from(editor.querySelectorAll("[data-checklist-count]"));
  const saveState = editor.querySelector("[data-checklist-save-state]");
  let hasUnsavedChanges = false;

  const getSections = () => Array.from(editor.querySelectorAll("[data-checklist-section]"));

  const updateSectionEmptyState = (section) => {
    const emptyMessage = section.querySelector("[data-checklist-empty]");
    if (!emptyMessage) {
      return;
    }
    emptyMessage.hidden = Boolean(section.querySelector("[data-checklist-item]"));
  };

  const updateCount = () => {
    const count = editor.querySelectorAll("[data-checklist-item]").length;
    const label = `${count} checklistpunt${count === 1 ? "" : "en"}`;
    countLabels.forEach((element) => {
      element.textContent = label;
    });
  };

  const markUnsaved = (message = "Niet-opgeslagen wijzigingen") => {
    hasUnsavedChanges = true;
    editor.classList.add("has-unsaved-changes");
    if (saveState) {
      saveState.textContent = message;
    }
  };

  const selectColor = (item, option) => {
    const colorInput = item.querySelector("[data-checklist-color]");
    const colorValue = option.dataset.colorValue || "gold";
    const colorHex = option.dataset.colorHex || "#d6a34f";
    if (colorInput) {
      colorInput.value = colorValue;
    }
    item.style.setProperty("--checklist-item-color", colorHex);
    item.querySelectorAll("[data-color-value]").forEach((button) => {
      const isSelected = button === option;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
  };

  const addChecklistItem = (section) => {
    if (!itemTemplate) {
      return;
    }
    const items = section.querySelector("[data-checklist-items]");
    if (!items) {
      return;
    }
    const fragment = itemTemplate.content.cloneNode(true);
    const newItem = fragment.querySelector("[data-checklist-item]");
    items.appendChild(fragment);
    updateSectionEmptyState(section);
    updateCount();
    newItem?.querySelector(".checklist-item-text")?.focus();
    markUnsaved("Nieuw punt toegevoegd — nog opslaan");
  };

  const serialize = () =>
    getSections().map((section, sectionIndex) => ({
      key: section.dataset.sectionKey || `program-${sectionIndex + 1}`,
      dayIndex: Number.parseInt(section.dataset.dayIndex || "0", 10) || 0,
      dayTitle: section.dataset.dayTitle || "",
      dayDate: section.dataset.dayDate || "",
      startTime: section.dataset.startTime || "",
      endTime: section.dataset.endTime || "",
      activity: section.dataset.activity || "Programmaonderdeel",
      items: Array.from(section.querySelectorAll("[data-checklist-item]"))
        .map((item) => ({
          text: String(item.querySelector(".checklist-item-text")?.value || "").trim(),
          color: item.querySelector("[data-checklist-color]")?.value || "gold",
        }))
        .filter((item) => item.text),
    }));

  editor.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add-checklist-item]");
    if (addButton) {
      const section = addButton.closest("[data-checklist-section]");
      if (section) {
        addChecklistItem(section);
      }
      return;
    }

    const removeButton = event.target.closest("[data-remove-checklist-item]");
    if (removeButton) {
      const section = removeButton.closest("[data-checklist-section]");
      removeButton.closest("[data-checklist-item]")?.remove();
      if (section) {
        updateSectionEmptyState(section);
      }
      updateCount();
      markUnsaved("Punt verwijderd — nog opslaan");
      return;
    }

    const colorOption = event.target.closest("[data-color-value]");
    if (colorOption) {
      const item = colorOption.closest("[data-checklist-item]");
      if (item) {
        selectColor(item, colorOption);
        markUnsaved();
      }
    }
  });

  editor.addEventListener("input", (event) => {
    if (event.target.matches(".checklist-item-text, input[name='checklist_title']")) {
      markUnsaved();
    }
  });

  editor.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || !event.target.matches(".checklist-item-text")) {
      return;
    }
    event.preventDefault();
    const section = event.target.closest("[data-checklist-section]");
    if (section) {
      addChecklistItem(section);
    }
  });

  editor.addEventListener("submit", () => {
    if (dataInput) {
      dataInput.value = JSON.stringify(serialize());
    }
    hasUnsavedChanges = false;
    editor.classList.remove("has-unsaved-changes");
    if (saveState) {
      saveState.textContent = "Bezig met opslaan…";
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedChanges) {
      return;
    }
    event.preventDefault();
    event.returnValue = "";
  });

  getSections().forEach(updateSectionEmptyState);
  updateCount();
})();
