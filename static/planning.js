(() => {
  const iconSvgs = {
    clipboard: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 5h6M9 9h6M8 13h8M8 17h5"></path><path d="M8 4h8l2 3v13H6V7l2-3Z"></path></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 21c4 0 7-2.8 7-6.8 0-3.1-1.9-5.4-4-7.7-.2 2-1 3.4-2.4 4.6.1-2.8-1.3-5-3.8-7.1C8.7 7.4 5 9.9 5 14.2 5 18.2 8 21 12 21Z"></path></svg>',
    football: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5"></circle><path d="m12 8 3 2.2-1.2 3.6h-3.6L9 10.2 12 8Z"></path><path d="M12 8V4M15 10.2l3.8-1.1M13.8 13.8l2.3 3.3M10.2 13.8l-2.3 3.3M9 10.2 5.2 9.1"></path></svg>',
    utensils: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 4v7M5 4v7M9 4v7M5 11h4l-.5 9h-3L5 11Z"></path><path d="M16 4c2 1.5 3 3.7 3 6.5V20h-3V4Z"></path></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 5h8v4a4 4 0 0 1-8 0V5Z"></path><path d="M8 7H5a3 3 0 0 0 3 4M16 7h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4"></path></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 8h4l1.5-2h5L16 8h4v11H4V8Z"></path><circle cx="12" cy="13.5" r="3"></circle></svg>',
    medical: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4Z"></path></svg>',
    cones: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 4h6l3 15H6L9 4Z"></path><path d="M8 14h8M9 9h6M5 20h14"></path></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8"></circle><path d="M12 8v4l3 2"></path></svg>',
  };

  const iconRules = [
    [/ontvangst|aanmelden|inloop|registratie/i, "clipboard"],
    [/opstarten|kleedkamer|omkleden|shirt/i, "clipboard"],
    [/warming|warm-up|activatie/i, "flame"],
    [/training|techniek|oefening|dribbel|passen|partij|wedstrijd|fungames|voetbal/i, "football"],
    [/lunch|eten|pauze|drinken/i, "utensils"],
    [/toernooi|finale|prijs|ceremonie|afsluiting|penalty|bokaal/i, "trophy"],
    [/foto|media|content/i, "camera"],
    [/ehbo|blessure|zorg/i, "medical"],
    [/materiaal|opbouw|afbouw|veld/i, "cones"],
    [/quiz|overleg|bespreking/i, "clipboard"],
  ];

  const rowTemplate = document.getElementById("planningRowTemplate");
  const dayTemplate = document.getElementById("planningDayTemplate");
  const taskRowTemplate = document.getElementById("planningTaskRowTemplate");
  const bulletSlideTemplate = document.getElementById("planningBulletSlideTemplate");
  const bulletRowTemplate = document.getElementById("planningBulletRowTemplate");
  const planningModal = document.getElementById("planningModal");
  const openModalButton = document.getElementById("openPlanningModal");
  const editorForm = document.getElementById("planningEditorForm");
  const titleEditor = document.querySelector('textarea[name="title"][form="planningEditorForm"]');
  const pdfExportButton = document.getElementById("exportPlanningPdf");
  const pngExportButton = document.getElementById("exportPlanningPng");
  const taskRowsContainer = editorForm?.querySelector("[data-planning-task-rows]");
  const taskEnabledInput = editorForm?.querySelector("[data-planning-task-enabled]");
  const taskPositionSelect = editorForm?.querySelector("[data-planning-task-position]");
  const bulletSlidesContainer = editorForm?.querySelector("[data-planning-bullet-slides]");
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";
  let draggedRow = null;

  const resizeTitleEditor = () => {
    if (!titleEditor) {
      return;
    }
    titleEditor.style.height = "auto";
    titleEditor.style.height = `${titleEditor.scrollHeight}px`;
  };

  titleEditor?.addEventListener("input", resizeTitleEditor);
  resizeTitleEditor();

  const inferIcon = (activity) => {
    const match = iconRules.find(([pattern]) => pattern.test(String(activity || "")));
    return match ? match[1] : "clock";
  };

  const renderRowIcon = (row) => {
    const activity = row.querySelector("[data-planning-activity]")?.value || "";
    const icon = row.querySelector("[data-planning-icon]");
    if (!icon) {
      return;
    }
    const key = inferIcon(activity);
    icon.dataset.icon = key;
    icon.innerHTML = iconSvgs[key];
  };

  const refreshRemoveButtons = (container) => {
    const rows = [...container.querySelectorAll("[data-planning-row]")];
    rows.forEach((row) => {
      const removeButton = row.querySelector("[data-remove-planning-row]");
      if (removeButton) {
        removeButton.hidden = rows.length <= 1;
      }
    });
  };

  const bindRow = (row) => {
    renderRowIcon(row);
    row.querySelector("[data-planning-activity]")?.addEventListener("input", () => renderRowIcon(row));
  };

  const appendRow = (container, values = {}) => {
    const row = rowTemplate?.content.firstElementChild?.cloneNode(true);
    if (!row) {
      return null;
    }
    row.querySelector('[data-program-start], input[name="program_start"]').value = values.startTime || "";
    row.querySelector('[data-program-end], input[name="program_end"]').value = values.endTime || "";
    row.querySelector('[data-planning-activity], input[name="program_activity"]').value = values.activity || "";
    row.querySelector('[data-program-details], input[name="program_details"]').value = values.details || "";
    container.append(row);
    bindRow(row);
    refreshRemoveButtons(container);
    return row;
  };

  const resetDragState = (container) => {
    container.querySelectorAll(".is-drop-target, .is-dragging").forEach((row) => {
      row.classList.remove("is-drop-target", "is-dragging");
    });
    draggedRow = null;
  };

  const bindRowsContainer = (container) => {
    if (!container || container.dataset.planningRowsBound === "1") {
      return;
    }
    container.dataset.planningRowsBound = "1";
    container.querySelectorAll("[data-planning-row]").forEach(bindRow);
    refreshRemoveButtons(container);

    container.addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-remove-planning-row]");
      if (!removeButton) {
        return;
      }
      const rows = container.querySelectorAll("[data-planning-row]");
      if (rows.length <= 1) {
        return;
      }
      removeButton.closest("[data-planning-row]")?.remove();
      refreshRemoveButtons(container);
    });

    container.addEventListener("dragstart", (event) => {
      const handle = event.target.closest("[data-planning-drag]");
      if (!handle) {
        event.preventDefault();
        return;
      }
      draggedRow = handle.closest("[data-planning-row]");
      draggedRow?.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", "planning-row");
      }
    });

    container.addEventListener("dragover", (event) => {
      if (!draggedRow || draggedRow.parentElement !== container) {
        return;
      }
      event.preventDefault();
      const targetRow = event.target.closest("[data-planning-row]");
      container.querySelectorAll(".is-drop-target").forEach((row) => row.classList.remove("is-drop-target"));
      if (!targetRow || targetRow === draggedRow) {
        return;
      }
      targetRow.classList.add("is-drop-target");
      const targetRect = targetRow.getBoundingClientRect();
      const insertAfter = event.clientY > targetRect.top + targetRect.height / 2;
      container.insertBefore(draggedRow, insertAfter ? targetRow.nextElementSibling : targetRow);
    });

    container.addEventListener("drop", (event) => {
      event.preventDefault();
      resetDragState(container);
    });

    container.addEventListener("dragend", () => resetDragState(container));
  };

  document.querySelectorAll("[data-planning-rows]").forEach(bindRowsContainer);

  const refreshTaskRemoveButtons = () => {
    const rows = [...(taskRowsContainer?.querySelectorAll("[data-planning-task-row]") || [])];
    rows.forEach((row) => {
      const removeButton = row.querySelector("[data-remove-planning-task]");
      if (removeButton) {
        removeButton.hidden = rows.length <= 1;
      }
    });
  };

  const appendTaskRow = (values = {}) => {
    const row = taskRowTemplate?.content.firstElementChild?.cloneNode(true);
    if (!row || !taskRowsContainer) {
      return null;
    }
    row.querySelector("[data-planning-task-name]").value = values.name || "";
    row.querySelector("[data-planning-task-role]").value = values.role || "";
    row.querySelector("[data-planning-task-text]").value = values.task || "";
    taskRowsContainer.append(row);
    refreshTaskRemoveButtons();
    return row;
  };

  const replacePositionOptions = (select, dayCount, requestedPosition) => {
    if (!select) {
      return;
    }
    const parsedPosition = Number.parseInt(String(requestedPosition ?? select.value), 10);
    const currentPosition = Math.max(0, Math.min(dayCount, Number.isNaN(parsedPosition) ? dayCount : parsedPosition));
    select.replaceChildren();
    for (let position = 0; position <= dayCount; position += 1) {
      const option = document.createElement("option");
      option.value = String(position);
      if (position === 0) {
        option.textContent = "Voor dag 1";
      } else if (position < dayCount) {
        option.textContent = `Tussen dag ${position} en dag ${position + 1}`;
      } else {
        option.textContent = `Na dag ${dayCount}`;
      }
      option.selected = position === currentPosition;
      select.append(option);
    }
  };

  const refreshTaskPositionOptions = (dayCount) => {
    replacePositionOptions(taskPositionSelect, dayCount, taskPositionSelect?.value || "1");
  };

  const refreshBulletRemoveButtons = (slide) => {
    const rows = [...slide.querySelectorAll("[data-planning-bullet-row]")];
    rows.forEach((row) => {
      const removeButton = row.querySelector("[data-remove-planning-bullet]");
      if (removeButton) {
        removeButton.hidden = rows.length <= 1;
      }
    });
    const addButton = slide.querySelector("[data-add-planning-bullet]");
    if (addButton) {
      addButton.disabled = rows.length >= 30;
    }
  };

  const appendBulletRow = (slide, value = "") => {
    const row = bulletRowTemplate?.content.firstElementChild?.cloneNode(true);
    const list = slide?.querySelector("[data-planning-bullet-list]");
    if (!row || !list || list.querySelectorAll("[data-planning-bullet-row]").length >= 30) {
      return null;
    }
    row.querySelector("[data-planning-bullet-text]").value = value;
    list.append(row);
    refreshBulletRemoveButtons(slide);
    return row;
  };

  const refreshBulletSlides = (dayCount) => {
    const slides = [...(bulletSlidesContainer?.querySelectorAll("[data-planning-bullet-slide]") || [])];
    slides.forEach((slide, index) => {
      const label = slide.querySelector("[data-planning-bullet-slide-label]");
      if (label) {
        label.textContent = `Slide ${index + 1}`;
      }
      const positionSelect = slide.querySelector("[data-planning-bullet-position]");
      replacePositionOptions(positionSelect, dayCount, positionSelect?.value);
      refreshBulletRemoveButtons(slide);
    });
    const addButton = editorForm?.querySelector("[data-add-planning-bullet-slide]");
    if (addButton) {
      addButton.disabled = slides.length >= 20;
    }
  };

  const appendBulletSlide = (values = {}) => {
    const slide = bulletSlideTemplate?.content.firstElementChild?.cloneNode(true);
    if (!slide || !bulletSlidesContainer || bulletSlidesContainer.querySelectorAll("[data-planning-bullet-slide]").length >= 20) {
      return null;
    }
    const titleInput = slide.querySelector("[data-planning-bullet-title]");
    if (titleInput) {
      titleInput.value = values.title || "Nieuwe slide";
    }
    bulletSlidesContainer.append(slide);
    const dayCount = editorForm?.querySelectorAll("[data-planning-day]").length || 1;
    replacePositionOptions(
      slide.querySelector("[data-planning-bullet-position]"),
      dayCount,
      values.insertAfterDay ?? dayCount,
    );
    const bullets = Array.isArray(values.bullets) && values.bullets.length ? values.bullets : [""];
    bullets.slice(0, 30).forEach((bullet) => appendBulletRow(slide, bullet));
    refreshBulletSlides(dayCount);
    return slide;
  };

  const refreshDays = () => {
    const daysContainer = editorForm?.querySelector("[data-planning-days]");
    const days = [...(daysContainer?.querySelectorAll("[data-planning-day]") || [])];
    days.forEach((day, index) => {
      const label = day.querySelector("[data-planning-day-label]");
      const removeButton = day.querySelector("[data-remove-planning-day]");
      if (label) {
        label.textContent = `Dag ${index + 1}`;
      }
      if (removeButton) {
        removeButton.hidden = days.length <= 1;
      }
    });
    const addDayButton = editorForm?.querySelector("[data-add-planning-day]");
    if (addDayButton) {
      addDayButton.disabled = days.length >= 31;
    }
    refreshTaskPositionOptions(days.length);
    refreshBulletSlides(days.length);
  };

  const nextDayDate = () => {
    const dates = [...(editorForm?.querySelectorAll("[data-planning-day-date]") || [])]
      .map((input) => input.value)
      .filter(Boolean);
    const lastDate = dates.at(-1);
    if (!lastDate) {
      const now = new Date();
      return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    }
    const nextDate = new Date(`${lastDate}T12:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    return nextDate.toISOString().slice(0, 10);
  };

  document.addEventListener("click", (event) => {
    const addBulletSlideButton = event.target.closest("[data-add-planning-bullet-slide]");
    if (addBulletSlideButton) {
      const slide = appendBulletSlide();
      slide?.querySelector("[data-planning-bullet-title]")?.select();
      return;
    }

    const removeBulletSlideButton = event.target.closest("[data-remove-planning-bullet-slide]");
    if (removeBulletSlideButton) {
      removeBulletSlideButton.closest("[data-planning-bullet-slide]")?.remove();
      const dayCount = editorForm?.querySelectorAll("[data-planning-day]").length || 1;
      refreshBulletSlides(dayCount);
      return;
    }

    const addBulletButton = event.target.closest("[data-add-planning-bullet]");
    if (addBulletButton) {
      const slide = addBulletButton.closest("[data-planning-bullet-slide]");
      const row = appendBulletRow(slide);
      row?.querySelector("[data-planning-bullet-text]")?.focus();
      return;
    }

    const removeBulletButton = event.target.closest("[data-remove-planning-bullet]");
    if (removeBulletButton) {
      const slide = removeBulletButton.closest("[data-planning-bullet-slide]");
      if (slide?.querySelectorAll("[data-planning-bullet-row]").length > 1) {
        removeBulletButton.closest("[data-planning-bullet-row]")?.remove();
        refreshBulletRemoveButtons(slide);
      }
      return;
    }

    const addTaskButton = event.target.closest("[data-add-planning-task]");
    if (addTaskButton) {
      const row = appendTaskRow();
      if (taskEnabledInput) {
        taskEnabledInput.checked = true;
        taskEnabledInput.dispatchEvent(new Event("change"));
      }
      row?.querySelector("[data-planning-task-name]")?.focus();
      return;
    }

    const removeTaskButton = event.target.closest("[data-remove-planning-task]");
    if (removeTaskButton) {
      if (taskRowsContainer?.querySelectorAll("[data-planning-task-row]").length > 1) {
        removeTaskButton.closest("[data-planning-task-row]")?.remove();
        refreshTaskRemoveButtons();
      }
      return;
    }

    const addRowButton = event.target.closest("[data-add-planning-row]");
    if (addRowButton) {
      const scope = addRowButton.closest("[data-planning-day], .planning-program-section, form") || document;
      const container = scope.querySelector("[data-planning-rows]");
      const row = container ? appendRow(container) : null;
      row?.querySelector('[data-program-start], input[name="program_start"]')?.focus();
      return;
    }

    const removeDayButton = event.target.closest("[data-remove-planning-day]");
    if (removeDayButton) {
      const daysContainer = removeDayButton.closest("[data-planning-days]");
      if (daysContainer?.querySelectorAll("[data-planning-day]").length > 1) {
        removeDayButton.closest("[data-planning-day]")?.remove();
        refreshDays();
      }
      return;
    }

    const addDayButton = event.target.closest("[data-add-planning-day]");
    if (!addDayButton || !dayTemplate || !editorForm) {
      return;
    }
    const daysContainer = editorForm.querySelector("[data-planning-days]");
    const day = dayTemplate.content.firstElementChild?.cloneNode(true);
    if (!daysContainer || !day || daysContainer.querySelectorAll("[data-planning-day]").length >= 31) {
      return;
    }
    const dateInput = day.querySelector("[data-planning-day-date]");
    if (dateInput) {
      dateInput.value = nextDayDate();
    }
    const titleInput = day.querySelector("[data-planning-day-title]");
    if (titleInput) {
      titleInput.value = String(titleEditor?.value || "Planning").trim() || "Planning";
    }
    daysContainer.append(day);
    const rowsContainer = day.querySelector("[data-planning-rows]");
    bindRowsContainer(rowsContainer);
    const row = appendRow(rowsContainer);
    refreshDays();
    row?.querySelector('[data-program-start], input[name="program_start"]')?.focus();
  });

  refreshDays();
  refreshTaskRemoveButtons();

  document.querySelectorAll('.planning-switch input[type="checkbox"]').forEach((checkbox) => {
    const updateLabel = () => {
      const label = checkbox.closest(".planning-switch")?.querySelector(".planning-switch-label");
      if (label) {
        label.textContent = checkbox.checked ? "Tonen" : "Verbergen";
      }
    };
    checkbox.addEventListener("change", updateLabel);
    updateLabel();
  });

  const closeModal = () => {
    if (planningModal?.open) {
      planningModal.close();
    }
  };

  openModalButton?.addEventListener("click", () => {
    if (!planningModal) {
      return;
    }
    const dateInput = planningModal.querySelector('input[name="planning_date"]');
    if (dateInput && !dateInput.value) {
      const now = new Date();
      const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      dateInput.value = localDate;
    }
    planningModal.showModal();
    document.body.classList.add("planning-modal-open");
    planningModal.querySelector('input[name="title"]')?.select();
  });

  planningModal?.querySelectorAll("[data-close-planning-modal]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  planningModal?.addEventListener("click", (event) => {
    if (event.target === planningModal) {
      closeModal();
    }
  });

  planningModal?.addEventListener("close", () => document.body.classList.remove("planning-modal-open"));

  const collectRows = (container) =>
    [...container.querySelectorAll("[data-planning-row]")]
      .map((row) => {
        const activity = String(row.querySelector('[data-planning-activity], input[name="program_activity"]')?.value || "").trim();
        return {
          startTime: String(row.querySelector('[data-program-start], input[name="program_start"]')?.value || "").trim(),
          endTime: String(row.querySelector('[data-program-end], input[name="program_end"]')?.value || "").trim(),
          activity,
          details: String(row.querySelector('[data-program-details], input[name="program_details"]')?.value || "").trim(),
          icon: inferIcon(activity),
        };
      })
      .filter((row) => row.startTime || row.endTime || row.activity || row.details);

  const collectDays = () =>
    [...editorForm.querySelectorAll("[data-planning-day]")].map((day) => ({
      title: String(day.querySelector("[data-planning-day-title]")?.value || titleEditor?.value || "Planning").trim(),
      date: String(day.querySelector("[data-planning-day-date]")?.value || "").trim(),
      program: collectRows(day.querySelector("[data-planning-rows]")),
    }));

  const collectTaskAssignment = () => ({
    enabled: Boolean(taskEnabledInput?.checked),
    insertAfterDay: Number.parseInt(taskPositionSelect?.value || "1", 10) || 0,
    rows: [...(taskRowsContainer?.querySelectorAll("[data-planning-task-row]") || [])]
      .map((row) => ({
        name: String(row.querySelector("[data-planning-task-name]")?.value || "").trim(),
        role: String(row.querySelector("[data-planning-task-role]")?.value || "").trim(),
        task: String(row.querySelector("[data-planning-task-text]")?.value || "").trim(),
      }))
      .filter((member) => member.name || member.role || member.task),
  });

  const collectBulletSlides = () =>
    [...(bulletSlidesContainer?.querySelectorAll("[data-planning-bullet-slide]") || [])].map((slide) => ({
      title: String(slide.querySelector("[data-planning-bullet-title]")?.value || "Nieuwe slide").trim(),
      insertAfterDay: Number.parseInt(slide.querySelector("[data-planning-bullet-position]")?.value || "1", 10) || 0,
      bullets: [...slide.querySelectorAll("[data-planning-bullet-row]")]
        .map((row) => String(row.querySelector("[data-planning-bullet-text]")?.value || "").trim())
        .filter(Boolean),
    }));

  const collectPlanning = () => {
    const days = collectDays();
    return {
      title: String(editorForm.elements.namedItem("title")?.value || "Planning").trim(),
      planningDate: days[0]?.date || "",
      location: String(editorForm.querySelector('input[name="location"]')?.value || "").trim(),
      includeIcons: Boolean(editorForm.querySelector('input[name="include_icons"][value="1"]')?.checked),
      program: days[0]?.program || [],
      days,
      taskAssignment: collectTaskAssignment(),
      bulletSlides: collectBulletSlides(),
    };
  };

  editorForm?.addEventListener("submit", () => {
    const daysField = editorForm.querySelector("[data-planning-days-json]");
    if (daysField) {
      daysField.value = JSON.stringify(collectDays());
    }
    const taskAssignmentField = editorForm.querySelector("[data-planning-task-assignment-json]");
    if (taskAssignmentField) {
      taskAssignmentField.value = JSON.stringify(collectTaskAssignment());
    }
    const bulletSlidesField = editorForm.querySelector("[data-planning-bullet-slides-json]");
    if (bulletSlidesField) {
      bulletSlidesField.value = JSON.stringify(collectBulletSlides());
    }
  });

  const downloadPlanningExport = async (button, endpoint, fallbackFilename, progressLabel) => {
    if (!editorForm?.reportValidity()) {
      return;
    }
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = progressLabel;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(collectPlanning()),
      });
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "De export kon niet worden gemaakt.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
      const filename = filenameMatch?.[1] || fallbackFilename;
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "De export kon niet worden gemaakt.");
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  };

  pdfExportButton?.addEventListener("click", () => {
    downloadPlanningExport(pdfExportButton, "/api/planning/export-pdf", "planning.pdf", "PDF maken...");
  });

  pngExportButton?.addEventListener("click", () => {
    downloadPlanningExport(pngExportButton, "/api/planning/export-png", "planning.png", "PNG maken...");
  });
})();
