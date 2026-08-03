(function () {
  const form = document.querySelector("[data-trainers-information-form]");
  const playbookSelect = document.querySelector("[data-trainers-information-playbook]");
  const groupsSelect = document.querySelector("[data-trainers-information-groups]");
  const loadButton = document.querySelector("[data-trainers-information-load]");
  const programHelp = document.querySelector("[data-program-selection-help]");
  const groupHelp = document.querySelector("[data-group-selection-help]");

  if (!form || !playbookSelect || !groupsSelect || !loadButton) {
    return;
  }

  const pluralize = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`;

  const updateSelection = () => {
    const playbookOption = playbookSelect.selectedOptions[0];
    const groupsOption = groupsSelect.selectedOptions[0];
    const hasPlaybook = Boolean(playbookSelect.value);
    const hasGroups = Boolean(groupsSelect.value);
    loadButton.disabled = !(hasPlaybook && hasGroups);

    if (programHelp) {
      const count = Number.parseInt(playbookOption?.dataset.programCount || "0", 10);
      programHelp.textContent = hasPlaybook
        ? `${pluralize(count, "programmaonderdeel", "programmaonderdelen")} worden op iedere pagina geplaatst.`
        : "Kies de dag waarvan het programma op iedere pagina moet komen.";
    }
    if (groupHelp) {
      const groupCount = Number.parseInt(groupsOption?.dataset.groupCount || "0", 10);
      const participantCount = Number.parseInt(groupsOption?.dataset.participantCount || "0", 10);
      groupHelp.textContent = hasGroups
        ? `${pluralize(groupCount, "groep", "groepen")} en ${pluralize(participantCount, "deelnemer", "deelnemers")}: de PDF krijgt ${pluralize(groupCount, "pagina", "pagina's")}.`
        : "Elke ingeladen groep wordt één afzonderlijke A4-pagina.";
    }
  };

  playbookSelect.addEventListener("change", updateSelection);
  groupsSelect.addEventListener("change", updateSelection);
  form.addEventListener("submit", () => {
    loadButton.disabled = true;
    loadButton.textContent = "Selectie laden…";
  });
  updateSelection();
})();
