(function () {
  const modal = document.getElementById("trainersInformationCreateModal");
  const openButtons = Array.from(document.querySelectorAll("[data-open-trainers-information-create]"));
  const closeButtons = Array.from(document.querySelectorAll("[data-close-trainers-information-create]"));
  const form = document.querySelector("[data-trainers-information-form]");
  const playbookSelect = document.querySelector("[data-trainers-information-playbook]");
  const groupsSelect = document.querySelector("[data-trainers-information-groups]");
  const loadButton = document.querySelector("[data-trainers-information-load]");
  const programHelp = document.querySelector("[data-program-selection-help]");
  const groupHelp = document.querySelector("[data-group-selection-help]");
  let lastTrigger = null;

  const pluralize = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`;

  const setModalOpen = (isOpen, trigger) => {
    if (!modal) {
      return;
    }
    if (isOpen) {
      lastTrigger = trigger || document.activeElement;
    }
    modal.hidden = !isOpen;
    document.body.classList.toggle("trainers-information-modal-open", isOpen);
    openButtons.forEach((button) => button.setAttribute("aria-expanded", isOpen ? "true" : "false"));
    if (isOpen) {
      window.requestAnimationFrame(() => form?.querySelector('input[name="title"]')?.focus());
    } else if (lastTrigger instanceof HTMLElement) {
      lastTrigger.focus();
    }
  };

  const updateSelection = () => {
    if (!playbookSelect || !groupsSelect || !loadButton) {
      return;
    }
    const playbookOption = playbookSelect.selectedOptions[0];
    const groupsOption = groupsSelect.selectedOptions[0];
    const hasPlaybook = Boolean(playbookSelect.value);
    const hasGroups = Boolean(groupsSelect.value);
    loadButton.disabled = !(hasPlaybook && hasGroups);

    if (programHelp) {
      const count = Number.parseInt(playbookOption?.dataset.programCount || "0", 10);
      programHelp.textContent = hasPlaybook
        ? `${pluralize(count, "programmaonderdeel", "programmaonderdelen")} worden opgeslagen.`
        : "Kies het programma dat op iedere A4 moet komen.";
    }
    if (groupHelp) {
      const groupCount = Number.parseInt(groupsOption?.dataset.groupCount || "0", 10);
      const participantCount = Number.parseInt(groupsOption?.dataset.participantCount || "0", 10);
      groupHelp.textContent = hasGroups
        ? `${pluralize(groupCount, "groep", "groepen")} en ${pluralize(participantCount, "deelnemer", "deelnemers")}: de PDF krijgt ${pluralize(groupCount, "pagina", "pagina's")}.`
        : "Iedere groep wordt één afzonderlijke A4-pagina.";
    }
  };

  openButtons.forEach((button) => {
    button.addEventListener("click", () => setModalOpen(true, button));
  });
  closeButtons.forEach((button) => {
    button.addEventListener("click", () => setModalOpen(false));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal && !modal.hidden) {
      setModalOpen(false);
    }
  });

  playbookSelect?.addEventListener("change", updateSelection);
  groupsSelect?.addEventListener("change", updateSelection);
  form?.addEventListener("submit", () => {
    if (loadButton) {
      loadButton.disabled = true;
      loadButton.textContent = "Opslaan…";
    }
  });

  document.querySelector("[data-delete-trainers-information]")?.addEventListener("submit", (event) => {
    if (!window.confirm("Weet je zeker dat je deze opgeslagen Trainers Informatie wilt verwijderen?")) {
      event.preventDefault();
    }
  });

  updateSelection();
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get("create") === "1") {
    setModalOpen(true);
  }
})();
