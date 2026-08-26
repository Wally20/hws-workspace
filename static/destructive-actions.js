(() => {
  const confirmationFieldName = "delete_confirmation";

  document.addEventListener("submit", (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
    const confirmationSource = submitter?.hasAttribute("data-confirm-submit")
      ? submitter
      : form.hasAttribute("data-confirm-submit")
        ? form
        : null;
    if (!confirmationSource) {
      return;
    }

    const confirmationValue = String(confirmationSource.dataset.confirmValue || "").trim();
    if (!confirmationValue) {
      event.preventDefault();
      return;
    }

    const existingConfirmation = form.elements.namedItem(confirmationFieldName);
    if (
      existingConfirmation instanceof HTMLInputElement
      && existingConfirmation.value === confirmationValue
    ) {
      return;
    }

    const message = String(
      confirmationSource.dataset.confirmMessage
      || "Weet je zeker dat je dit wilt verwijderen?"
    ).trim();
    if (!window.confirm(message)) {
      event.preventDefault();
      return;
    }

    const confirmationField = existingConfirmation instanceof HTMLInputElement
      ? existingConfirmation
      : document.createElement("input");
    confirmationField.type = "hidden";
    confirmationField.name = confirmationFieldName;
    confirmationField.value = confirmationValue;
    if (!confirmationField.isConnected) {
      form.appendChild(confirmationField);
    }
  });
})();
