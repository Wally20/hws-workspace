const agendaModal = document.querySelector("#agendaModal");
const openAgendaModal = document.querySelector("#openAgendaModal");
const closeAgendaModal = document.querySelector("#closeAgendaModal");
const agendaPlannerEditor = document.querySelector("#agendaPlannerEditor");
const toggleAgendaPlannerEdit = document.querySelector("#toggleAgendaPlannerEdit");
const cancelAgendaPlannerEdit = document.querySelector("#cancelAgendaPlannerEdit");
const agendaPlannerForm = document.querySelector("#agendaPlannerForm");
const agendaDayPlansInput = document.querySelector("#agendaDayPlansInput");
const dayPlanDropzones = document.querySelectorAll("[data-day-plan-dropzone]");
const dayPlanChips = document.querySelectorAll("[data-plan-option]");
const clearDayPlanButtons = document.querySelectorAll("[data-clear-day-plan]");
const agendaGrid = document.querySelector("#agendaGrid");

const agendaDayPlans = {};
let activeDraggedPlan = "";

function setModalOpen(isOpen) {
  if (!agendaModal) {
    return;
  }

  agendaModal.hidden = !isOpen;
  document.body.style.overflow = isOpen ? "hidden" : "";
}

function setPlannerEditOpen(isOpen) {
  if (!agendaPlannerEditor) {
    return;
  }

  agendaPlannerEditor.hidden = !isOpen;
  agendaGrid?.classList.toggle("agenda-grid-edit-mode", isOpen);
  if (toggleAgendaPlannerEdit) {
    toggleAgendaPlannerEdit.textContent = isOpen ? "Sluit dagplanning" : "Dagplanning";
    toggleAgendaPlannerEdit.classList.toggle("subtle-button-strong", isOpen);
    toggleAgendaPlannerEdit.setAttribute("aria-expanded", isOpen ? "true" : "false");
  }
}

function renderDayPlan(dropzone, planValue) {
  const valueNode = dropzone.querySelector(".agenda-day-plan-value");
  const clearButton = dropzone.querySelector(".agenda-day-plan-clear");
  const hasValue = Boolean(planValue);

  dropzone.dataset.dayPlanValue = planValue;
  dropzone.classList.toggle("agenda-day-plan-dropzone-filled", hasValue);
  if (valueNode) {
    valueNode.textContent = hasValue ? planValue : "";
    valueNode.setAttribute("aria-hidden", hasValue ? "false" : "true");
  }
  if (clearButton) {
    clearButton.hidden = !hasValue;
  }
}

function syncDayPlansInput() {
  if (!agendaDayPlansInput) {
    return;
  }
  agendaDayPlansInput.value = JSON.stringify(agendaDayPlans);
}

function setDayPlan(dateKey, planValue) {
  const normalizedDate = (dateKey || "").trim();
  const normalizedPlan = (planValue || "").trim();
  if (!normalizedDate) {
    return;
  }

  if (normalizedPlan) {
    agendaDayPlans[normalizedDate] = normalizedPlan;
  } else {
    delete agendaDayPlans[normalizedDate];
  }

  const dropzone = document.querySelector(`[data-day-plan-dropzone="${normalizedDate}"]`);
  if (dropzone) {
    renderDayPlan(dropzone, normalizedPlan);
  }
  syncDayPlansInput();
}

dayPlanDropzones.forEach((dropzone) => {
  const dateKey = dropzone.dataset.dayPlanDropzone || "";
  const currentPlan = dropzone.dataset.dayPlanValue || "";
  if (dateKey && currentPlan) {
    agendaDayPlans[dateKey] = currentPlan;
  }
  renderDayPlan(dropzone, currentPlan);

  dropzone.addEventListener("dragover", (event) => {
    if (!activeDraggedPlan) {
      return;
    }
    event.preventDefault();
    dropzone.classList.add("agenda-day-plan-dropzone-active");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("agenda-day-plan-dropzone-active");
  });

  dropzone.addEventListener("drop", (event) => {
    if (!activeDraggedPlan) {
      return;
    }
    event.preventDefault();
    dropzone.classList.remove("agenda-day-plan-dropzone-active");
    setDayPlan(dateKey, activeDraggedPlan);
  });
});

dayPlanChips.forEach((chip) => {
  chip.addEventListener("dragstart", () => {
    activeDraggedPlan = chip.dataset.planOption || "";
    chip.classList.add("agenda-plan-chip-dragging");
  });

  chip.addEventListener("dragend", () => {
    activeDraggedPlan = "";
    chip.classList.remove("agenda-plan-chip-dragging");
    dayPlanDropzones.forEach((dropzone) => {
      dropzone.classList.remove("agenda-day-plan-dropzone-active");
    });
  });

  chip.addEventListener("click", () => {
    const firstEmptyDropzone = Array.from(dayPlanDropzones).find((dropzone) => !dropzone.dataset.dayPlanValue);
    if (!firstEmptyDropzone) {
      return;
    }
    setDayPlan(firstEmptyDropzone.dataset.dayPlanDropzone || "", chip.dataset.planOption || "");
  });
});

clearDayPlanButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setDayPlan(button.dataset.clearDayPlan || "", "");
  });
});

syncDayPlansInput();

openAgendaModal?.addEventListener("click", () => setModalOpen(true));
closeAgendaModal?.addEventListener("click", () => setModalOpen(false));
toggleAgendaPlannerEdit?.addEventListener("click", () => setPlannerEditOpen(agendaPlannerEditor?.hidden));
cancelAgendaPlannerEdit?.addEventListener("click", () => setPlannerEditOpen(false));

agendaPlannerForm?.addEventListener("submit", () => {
  syncDayPlansInput();
});

agendaModal?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.dataset.closeModal === "1") {
    setModalOpen(false);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setModalOpen(false);
    setPlannerEditOpen(false);
  }
});
