(function () {
  const editor = document.querySelector("[data-checklist-editor]");
  if (!editor) {
    return;
  }

  const itemTemplate = document.getElementById("checklistItemTemplate");
  const dataInput = editor.querySelector("[data-checklist-data]");
  const countLabels = Array.from(editor.querySelectorAll("[data-checklist-count]"));

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
  };

  const serialize = () =>
    getSections().map((section, sectionIndex) => ({
      key: section.dataset.sectionKey || `program-${sectionIndex + 1}`,
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
      return;
    }

    const colorOption = event.target.closest("[data-color-value]");
    if (colorOption) {
      const item = colorOption.closest("[data-checklist-item]");
      if (item) {
        selectColor(item, colorOption);
      }
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
  });

  getSections().forEach(updateSectionEmptyState);
  updateCount();
})();
