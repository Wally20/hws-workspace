(() => {
  const uploadModal = document.querySelector("#contractUploadModal");
  const uploadFileInput = document.querySelector("[data-contract-file-input]");
  const uploadFileLabel = document.querySelector("[data-contract-file-label]");

  const setUploadModalOpen = (isOpen) => {
    if (!uploadModal) return;
    uploadModal.hidden = !isOpen;
    document.body.classList.toggle("contract-modal-open", isOpen);
    if (isOpen) {
      window.setTimeout(() => uploadFileInput?.focus(), 30);
    }
  };

  document.querySelectorAll("[data-open-contract-upload]").forEach((button) => {
    button.addEventListener("click", () => setUploadModalOpen(true));
  });
  uploadModal?.querySelectorAll("[data-close-contract-upload]").forEach((button) => {
    button.addEventListener("click", () => setUploadModalOpen(false));
  });
  if (uploadModal && !uploadModal.hidden) {
    document.body.classList.add("contract-modal-open");
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && uploadModal && !uploadModal.hidden) {
      setUploadModalOpen(false);
    }
  });

  uploadFileInput?.addEventListener("change", () => {
    const selectedFile = uploadFileInput.files?.[0];
    if (uploadFileLabel) {
      uploadFileLabel.textContent = selectedFile?.name || "Kies een PDF-bestand";
    }
  });

  const searchInput = document.querySelector("#contractSearch");
  const seasonFilter = document.querySelector("#contractSeasonFilter");
  const clubFilter = document.querySelector("#contractClubFilter");
  const contractTiles = Array.from(document.querySelectorAll("[data-contract-tile]"));
  const visibleCount = document.querySelector("#contractVisibleCount");
  const countSuffix = document.querySelector("#contractCountSuffix");
  const emptyState = document.querySelector("#contractEmptyState");
  const emptyTitle = emptyState?.querySelector("[data-contract-empty-title]");
  const emptyCopy = emptyState?.querySelector("[data-contract-empty-copy]");
  const resetFilters = document.querySelector("[data-reset-contract-filters]");

  const normalize = (value) => String(value || "").trim().toLocaleLowerCase("nl-NL");
  const applyFilters = () => {
    if (!contractTiles.length) return;
    const query = normalize(searchInput?.value);
    const season = normalize(seasonFilter?.value);
    const club = normalize(clubFilter?.value);
    let count = 0;
    contractTiles.forEach((tile) => {
      const matchesSearch = !query || normalize(tile.dataset.search).includes(query);
      const matchesSeason = !season || normalize(tile.dataset.season) === season;
      const matchesClub = !club || normalize(tile.dataset.club) === club;
      const visible = matchesSearch && matchesSeason && matchesClub;
      tile.hidden = !visible;
      if (visible) count += 1;
    });
    if (visibleCount) visibleCount.textContent = String(count);
    if (countSuffix) countSuffix.textContent = count === 1 ? "" : "en";
    if (emptyState) emptyState.hidden = count !== 0;
    if (emptyTitle) emptyTitle.textContent = "Geen overeenkomsten gevonden";
    if (emptyCopy) emptyCopy.textContent = "Pas je zoekopdracht of filters aan.";
    if (resetFilters) resetFilters.hidden = !(query || season || club);
  };

  [searchInput, seasonFilter, clubFilter].forEach((field) => {
    field?.addEventListener(field === searchInput ? "input" : "change", applyFilters);
  });
  resetFilters?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (seasonFilter) seasonFilter.value = "";
    if (clubFilter) clubFilter.value = "";
    applyFilters();
    searchInput?.focus();
  });

  const shareUrlInput = document.querySelector("[data-share-url]");
  const copyShareButton = document.querySelector("[data-copy-share-url]");
  const copyFeedback = document.querySelector("[data-copy-feedback]");
  copyShareButton?.addEventListener("click", async () => {
    if (!shareUrlInput) return;
    try {
      await navigator.clipboard.writeText(shareUrlInput.value);
    } catch (error) {
      shareUrlInput.select();
      document.execCommand("copy");
    }
    copyShareButton.textContent = "Gekopieerd";
    if (copyFeedback) copyFeedback.textContent = "De link staat op je klembord.";
    window.setTimeout(() => {
      copyShareButton.textContent = "Kopieer link";
    }, 2200);
  });

  const signatureCanvas = document.querySelector("[data-signature-canvas]");
  const signatureForm = document.querySelector("[data-contract-sign-form]");
  const signatureDataInput = document.querySelector("[data-signature-data]");
  const signatureError = document.querySelector("[data-signature-error]");
  const clearSignatureButton = document.querySelector("[data-clear-signature]");
  if (signatureCanvas instanceof HTMLCanvasElement && signatureForm && signatureDataInput) {
    const context = signatureCanvas.getContext("2d");
    let drawing = false;
    let hasInk = false;

    const pointFromEvent = (event) => {
      const rect = signatureCanvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * signatureCanvas.width,
        y: ((event.clientY - rect.top) / rect.height) * signatureCanvas.height,
      };
    };
    const startDrawing = (event) => {
      if (!context) return;
      drawing = true;
      const point = pointFromEvent(event);
      context.beginPath();
      context.moveTo(point.x, point.y);
      signatureCanvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };
    const draw = (event) => {
      if (!drawing || !context) return;
      const point = pointFromEvent(event);
      context.lineWidth = 4;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = "#151515";
      context.lineTo(point.x, point.y);
      context.stroke();
      hasInk = true;
      if (signatureError) signatureError.textContent = "";
      event.preventDefault();
    };
    const stopDrawing = (event) => {
      drawing = false;
      if (event?.pointerId !== undefined) {
        signatureCanvas.releasePointerCapture?.(event.pointerId);
      }
    };
    signatureCanvas.addEventListener("pointerdown", startDrawing);
    signatureCanvas.addEventListener("pointermove", draw);
    signatureCanvas.addEventListener("pointerup", stopDrawing);
    signatureCanvas.addEventListener("pointercancel", stopDrawing);
    signatureCanvas.addEventListener("pointerleave", stopDrawing);

    clearSignatureButton?.addEventListener("click", () => {
      context?.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
      hasInk = false;
      signatureDataInput.value = "";
      if (signatureError) signatureError.textContent = "";
    });

    signatureForm.addEventListener("submit", (event) => {
      if (!hasInk) {
        event.preventDefault();
        if (signatureError) signatureError.textContent = "Zet eerst je handtekening in het tekenveld.";
        signatureCanvas.focus();
        return;
      }
      signatureDataInput.value = signatureCanvas.toDataURL("image/png");
      const submitButton = signatureForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Ondertekening opslaan…";
      }
    });
  }
})();
