(function () {
  const modal = document.getElementById("dressingRoomImportModal");
  const openButtons = Array.from(document.querySelectorAll("[data-open-dressing-room-import]"));
  const closeButtons = Array.from(document.querySelectorAll("[data-close-dressing-room-import]"));
  const form = document.querySelector("[data-dressing-room-import-form]");
  const dropZone = document.querySelector("[data-dressing-room-drop-zone]");
  const fileInput = document.querySelector("[data-dressing-room-file-input]");
  const fileLabel = document.querySelector("[data-dressing-room-file-label]");
  const feedback = document.querySelector("[data-dressing-room-import-feedback]");
  const submitButton = document.querySelector("[data-dressing-room-import-submit]");
  let lastTrigger = null;

  const setModalOpen = (isOpen, trigger) => {
    if (!modal) {
      return;
    }
    if (isOpen) {
      lastTrigger = trigger || document.activeElement;
    }
    modal.hidden = !isOpen;
    document.body.classList.toggle("dressing-room-modal-open", isOpen);
    openButtons.forEach((button) => button.setAttribute("aria-expanded", isOpen ? "true" : "false"));
    if (isOpen) {
      window.requestAnimationFrame(() => form?.querySelector('input[name="title"]')?.focus());
    } else if (lastTrigger instanceof HTMLElement) {
      lastTrigger.focus();
    }
  };

  const setFeedback = (message, isError) => {
    if (!feedback) {
      return;
    }
    feedback.textContent = message || "";
    feedback.classList.toggle("is-error", Boolean(isError));
  };

  const validateFile = (file) => {
    if (!file) {
      setFeedback("Kies eerst een Excel-bestand.", true);
      return false;
    }
    if (!/\.(xlsx|xlsm)$/i.test(file.name || "")) {
      setFeedback("Gebruik een Excel-bestand in .xlsx- of .xlsm-formaat.", true);
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFeedback("Het Excel-bestand is groter dan 10 MB.", true);
      return false;
    }
    if (file.size === 0) {
      setFeedback("Het gekozen Excel-bestand is leeg.", true);
      return false;
    }
    if (fileLabel) {
      fileLabel.textContent = file.name;
    }
    dropZone?.classList.add("has-file");
    setFeedback("Bestand klaar om te importeren.", false);
    return true;
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

  fileInput?.addEventListener("change", () => validateFile(fileInput.files?.[0]));

  if (dropZone && fileInput) {
    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropZone.classList.add("is-dragging");
      });
    });
    ["dragleave", "dragend"].forEach((eventName) => {
      dropZone.addEventListener(eventName, () => dropZone.classList.remove("is-dragging"));
    });
    dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropZone.classList.remove("is-dragging");
      const file = event.dataTransfer?.files?.[0];
      if (!file || !validateFile(file)) {
        return;
      }
      const transfer = new DataTransfer();
      transfer.items.add(file);
      fileInput.files = transfer.files;
    });
  }

  form?.addEventListener("submit", (event) => {
    if (!validateFile(fileInput?.files?.[0])) {
      event.preventDefault();
      return;
    }
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Excel lezen en bordjes maken…";
    }
    setFeedback("De teamindeling wordt verwerkt.", false);
  });

  document.querySelector("[data-delete-dressing-room-document]")?.addEventListener("submit", (event) => {
    if (!window.confirm("Weet je zeker dat je deze opgeslagen kleedkamerbordjes wilt verwijderen?")) {
      event.preventDefault();
    }
  });

  if (document.querySelector(".dressing-room-notice-error") && !document.querySelector(".dressing-room-detail")) {
    setModalOpen(true);
  }
})();
