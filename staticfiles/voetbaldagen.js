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

  const rules = [
    [/ontvangst|aanmelden|inloop|registratie/i, "clipboard"],
    [/opstarten|kleedkamer|omkleden|shirt/i, "clipboard"],
    [/warming|warm-up|activatie/i, "flame"],
    [/training|techniek|oefening|dribbel|passen|partij|wedstrijd|fungames/i, "football"],
    [/lunch|eten|pauze|drinken/i, "utensils"],
    [/toernooi|finale|prijs|ceremonie|afsluiting|penalty|bokaal/i, "trophy"],
    [/foto|media|content/i, "camera"],
    [/ehbo|blessure|zorg/i, "medical"],
    [/materiaal|opbouw|afbouw|veld/i, "cones"],
    [/quiz/i, "clipboard"],
  ];

  const imageProgramTemplate = [
    { startTime: "08:30", endTime: "08:45", activity: "Inloop deelnemers" },
    { startTime: "08:45", endTime: "09:00", activity: "Opstarten per groep in kleedkamer" },
    { startTime: "09:00", endTime: "09:15", activity: "Opening op het veld + gezamenlijke warming-up" },
    { startTime: "09:15", endTime: "10:15", activity: "Training met veel 1v1 en 2v2 vormen" },
    { startTime: "10:15", endTime: "10:30", activity: "Voorronde penalty bokaal" },
    { startTime: "10:30", endTime: "10:45", activity: "Kleine pauze" },
    { startTime: "10:45", endTime: "11:45", activity: "Training met veel 1v1 en 2v2 vormen" },
    { startTime: "11:45", endTime: "12:15", activity: "Grote pauze" },
    { startTime: "12:15", endTime: "12:45", activity: "Voetbalquiz" },
    { startTime: "12:45", endTime: "13:45", activity: "Fungames" },
    { startTime: "13:45", endTime: "14:00", activity: "Kleine pauze" },
    { startTime: "14:00", endTime: "14:15", activity: "Finale penalty bokaal" },
    { startTime: "14:15", endTime: "14:45", activity: "Verschillende partijvormen" },
    { startTime: "14:45", endTime: "15:00", activity: "Prijsuitreiking in de kantine" },
  ];

  const staffRows = document.getElementById("footballStaffRows");
  const programRows = document.getElementById("footballProgramRows");
  const staffTemplate = document.getElementById("footballStaffRowTemplate");
  const programTemplate = document.getElementById("footballProgramRowTemplate");
  const addStaffButton = document.getElementById("addFootballStaffRow");
  const addProgramButton = document.getElementById("addFootballProgramRow");
  const programImageImportInput = document.getElementById("footballProgramImageImport");
  const programImportFeedback = document.getElementById("footballProgramImportFeedback");
  const programImportModal = document.getElementById("footballProgramImportModal");
  const programImportPreviewRows = document.getElementById("footballProgramImportPreviewRows");
  const addProgramImportPreviewRowButton = document.getElementById("addFootballImportPreviewRow");
  const confirmProgramImportButton = document.getElementById("confirmFootballProgramImport");
  const exportButton = document.getElementById("exportFootballDaysPdf");
  const previousPlaybooksElement = document.getElementById("footballPreviousPlaybooks");
  const productSearchInput = document.getElementById("footballProductSearch");
  const productResults = document.getElementById("footballProductResults");
  const productIdInput = document.getElementById("footballEcwidProductId");
  const productNameInput = document.getElementById("footballEcwidProductName");
  const productSkuInput = document.getElementById("footballEcwidProductSku");
  const clearProductButton = document.getElementById("clearFootballProduct");
  const registrationCount = document.getElementById("footballRegistrationCount");
  let previousPlaybooks = [];
  let productSearchTimer = null;

  if (previousPlaybooksElement) {
    try {
      previousPlaybooks = JSON.parse(previousPlaybooksElement.textContent || "[]");
    } catch (error) {
      previousPlaybooks = [];
    }
  }

  const inferIcon = (name) => {
    const match = rules.find(([pattern]) => pattern.test(name || ""));
    return match ? match[1] : "clock";
  };

  const renderIcon = (iconElement, key) => {
    if (!iconElement) {
      return;
    }
    const iconKey = iconSvgs[key] ? key : "clock";
    iconElement.dataset.activityIcon = iconKey;
    iconElement.innerHTML = iconSvgs[iconKey];
  };

  const refreshProgramRow = (row) => {
    const input = row.querySelector("[data-activity-name]");
    const icon = row.querySelector("[data-activity-icon]");
    renderIcon(icon, inferIcon(input ? input.value : ""));
  };

  const refreshRemoveButtons = (container, rowSelector) => {
    if (!container) {
      return;
    }
    const rows = [...container.querySelectorAll(rowSelector)];
    rows.forEach((row) => {
      const button = row.querySelector("[data-remove-football-row]");
      if (button) {
        button.hidden = rows.length <= 1;
      }
    });
  };

  const bindProgramRow = (row) => {
    refreshProgramRow(row);
    const input = row.querySelector("[data-activity-name]");
    if (input) {
      input.addEventListener("input", () => refreshProgramRow(row));
    }
  };

  const appendStaffRow = (member = {}) => {
    if (!staffRows || !staffTemplate) {
      return null;
    }
    const row = staffTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector('input[name="staff_name"]').value = member.name || "";
    row.querySelector('input[name="staff_role"]').value = member.role || "";
    row.querySelector('input[name="staff_setup_task"]').value = member.setupTask || "";
    staffRows.appendChild(row);
    return row;
  };

  const appendProgramRow = (item = {}) => {
    if (!programRows || !programTemplate) {
      return null;
    }
    const row = programTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector('input[name="program_start"]').value = item.startTime || "";
    row.querySelector('input[name="program_end"]').value = item.endTime || "";
    row.querySelector('input[name="program_activity"]').value = item.activity || "";
    programRows.appendChild(row);
    bindProgramRow(row);
    return row;
  };

  const replaceRows = (container, rowSelector, values, appendRow) => {
    if (!container) {
      return;
    }
    container.querySelectorAll(rowSelector).forEach((row) => row.remove());
    const rows = values.length ? values : [{}];
    rows.forEach((item) => appendRow(item));
    refreshRemoveButtons(container, rowSelector);
  };

  const showProgramImportFeedback = (message, isError = false) => {
    if (!programImportFeedback) {
      return;
    }
    programImportFeedback.textContent = message;
    programImportFeedback.hidden = false;
    programImportFeedback.classList.toggle("football-import-feedback-error", isError);
  };

  const setProgramImportModalOpen = (isOpen) => {
    if (!programImportModal) {
      return;
    }
    programImportModal.hidden = !isOpen;
    document.body.classList.toggle("modal-open", isOpen);
  };

  const appendImportPreviewRow = (item = {}) => {
    if (!programImportPreviewRows) {
      return null;
    }
    const row = document.createElement("div");
    row.className = "football-import-preview-row";
    row.dataset.footballImportPreviewRow = "1";
    row.innerHTML = `
      <input type="time" data-import-program-start aria-label="Begintijd">
      <input type="time" data-import-program-end aria-label="Eindtijd">
      <input type="text" data-import-program-activity placeholder="Activiteit" aria-label="Activiteit">
      <button type="button" class="subtle-button action-small football-row-remove" data-remove-import-preview-row aria-label="Verwijder previewregel">Wis</button>
    `;
    row.querySelector("[data-import-program-start]").value = item.startTime || "";
    row.querySelector("[data-import-program-end]").value = item.endTime || "";
    row.querySelector("[data-import-program-activity]").value = item.activity || "";
    programImportPreviewRows.append(row);
    return row;
  };

  const refreshImportPreviewRemoveButtons = () => {
    if (!programImportPreviewRows) {
      return;
    }
    const rows = [...programImportPreviewRows.querySelectorAll("[data-football-import-preview-row]")];
    rows.forEach((row) => {
      const button = row.querySelector("[data-remove-import-preview-row]");
      if (button) {
        button.hidden = rows.length <= 1;
      }
    });
  };

  const openProgramImportPreview = (items) => {
    if (!programImportPreviewRows) {
      return;
    }
    programImportPreviewRows.innerHTML = "";
    items.forEach((item) => appendImportPreviewRow(item));
    refreshImportPreviewRemoveButtons();
    setProgramImportModalOpen(true);
    programImportPreviewRows.querySelector("input")?.focus();
  };

  const collectImportPreviewRows = () => {
    if (!programImportPreviewRows) {
      return [];
    }
    return [...programImportPreviewRows.querySelectorAll("[data-football-import-preview-row]")]
      .map((row) => ({
        startTime: String(row.querySelector("[data-import-program-start]")?.value || "").trim(),
        endTime: String(row.querySelector("[data-import-program-end]")?.value || "").trim(),
        activity: String(row.querySelector("[data-import-program-activity]")?.value || "").trim(),
      }))
      .filter((item) => item.startTime || item.endTime || item.activity)
      .map((item) => ({
        ...item,
        icon: inferIcon(item.activity),
      }));
  };

  const importProgramFromImage = (file) => {
    if (!file || !String(file.type || "").startsWith("image/")) {
      showProgramImportFeedback("Kies een afbeelding om het programma te importeren.", true);
      return;
    }

    const importedProgram = imageProgramTemplate.map((item) => ({
      ...item,
      icon: inferIcon(item.activity),
    }));
    openProgramImportPreview(importedProgram);
    showProgramImportFeedback(`${importedProgram.length} programma-onderdelen uit de afbeelding uitgelezen. Controleer de preview en importeer daarna.`);
  };

  const setRegistrationCount = (value) => {
    if (registrationCount) {
      registrationCount.textContent = String(value || 0);
    }
  };

  const loadRegistrationCount = async (product = {}) => {
    const productId = String(product.id || "").trim();
    const productName = String(product.name || "").trim();
    const productSku = String(product.sku || "").trim();
    if (!productId && !productName && !productSku) {
      setRegistrationCount(0);
      return;
    }
    try {
      const params = new URLSearchParams({
        product_id: productId,
        product_name: productName,
        product_sku: productSku,
      });
      const response = await fetch(`/api/products/registration-count?${params.toString()}`);
      const payload = await response.json();
      if (response.ok) {
        setRegistrationCount(payload.registrationCount || 0);
      }
    } catch (error) {
      console.error("Aanmeldingen ophalen mislukt", error);
    }
  };

  const hideProductResults = () => {
    if (!productResults) {
      return;
    }
    productResults.hidden = true;
    productResults.innerHTML = "";
  };

  const renderProductResults = (items) => {
    if (!productResults) {
      return;
    }
    productResults.innerHTML = "";
    productResults.hidden = false;

    if (!items.length) {
      const emptyRow = document.createElement("div");
      emptyRow.className = "football-product-result";
      emptyRow.textContent = "Geen producten gevonden";
      productResults.append(emptyRow);
      return;
    }

    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "football-product-result";
      button.dataset.productId = item.id || "";
      button.dataset.productName = item.name || "";
      button.dataset.productSku = item.sku || "";

      const name = document.createElement("strong");
      name.textContent = item.name || "Naamloos product";
      const meta = document.createElement("span");
      meta.textContent = item.sku ? `SKU: ${item.sku}` : `Product ID: ${item.id || "-"}`;
      button.append(name, meta);
      productResults.append(button);
    });
  };

  const searchProducts = async () => {
    const query = String(productSearchInput?.value || "").trim();
    if (!query) {
      hideProductResults();
      return;
    }

    try {
      const response = await fetch(`/api/products/search?q=${encodeURIComponent(query)}`);
      const payload = await response.json();
      renderProductResults(payload.items || []);
    } catch (error) {
      hideProductResults();
      console.error("Product zoeken mislukt", error);
    }
  };

  const selectProduct = (product) => {
    const productId = product.id || "";
    if (productIdInput) {
      productIdInput.value = productId;
    }
    if (productNameInput) {
      productNameInput.value = product.name || "";
    }
    if (productSkuInput) {
      productSkuInput.value = product.sku || "";
    }
    if (productSearchInput instanceof HTMLInputElement) {
      productSearchInput.value = product.name || "";
    }
    if (clearProductButton instanceof HTMLButtonElement) {
      clearProductButton.hidden = !productId;
    }
    hideProductResults();
    loadRegistrationCount(product);
  };

  const clearProduct = () => {
    selectProduct({ id: "", name: "", sku: "" });
    hideProductResults();
  };

  const pdfBackgrounds = Array.from({ length: 10 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return `/static/assets/football-days-pdf/background-${number}.png`;
  });
  const pdfLogo = "/static/assets/hws-logo.png";
  let printRoot = null;

  const ensurePrintStyles = () => {
    if (document.getElementById("footballPdfPrintStyles")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "footballPdfPrintStyles";
    style.textContent = `
      .football-pdf-export {
        display: none;
      }

      @media print {
        @page {
          size: A4 landscape;
          margin: 0;
        }

        html,
        body {
          width: 297mm;
          min-height: 210mm;
          margin: 0 !important;
          background: #050505 !important;
          color: #111111 !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body > *:not(.football-pdf-export) {
          display: none !important;
        }

        .football-pdf-export {
          display: block !important;
          font-family: Poppins, Arial, sans-serif;
          color: #101010;
        }

        .football-pdf-page {
          position: relative;
          width: 297mm;
          height: 210mm;
          overflow: hidden;
          break-after: page;
          page-break-after: always;
          background: #050505;
        }

        .football-pdf-page:last-child {
          break-after: auto;
          page-break-after: auto;
        }

        .football-pdf-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }

        .football-pdf-shade {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: linear-gradient(90deg, rgba(0, 0, 0, 0.14), rgba(0, 0, 0, 0.03) 44%, rgba(0, 0, 0, 0.18));
        }

        .football-pdf-content {
          position: relative;
          z-index: 2;
          height: 100%;
          padding: 18mm 20mm 16mm;
        }

        .football-pdf-header {
          display: grid;
          grid-template-columns: 24mm 1fr;
          align-items: center;
          gap: 7mm;
          min-height: 24mm;
          margin-bottom: 9mm;
        }

        .football-pdf-logo {
          width: 24mm;
          height: 24mm;
          object-fit: contain;
        }

        .football-pdf-header-title {
          margin: 0;
          color: #ffffff;
          font-size: 15mm;
          line-height: 1;
          font-weight: 800;
          text-transform: uppercase;
          text-shadow: 0 2px 9px rgba(0, 0, 0, 0.42);
        }

        .football-pdf-cover {
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .football-pdf-cover-card {
          width: min(190mm, 78%);
          padding: 17mm 20mm;
          border: 0.7mm solid rgba(255, 255, 255, 0.34);
          background: rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(2px);
        }

        .football-pdf-cover-logo {
          width: 48mm;
          height: 48mm;
          object-fit: contain;
          margin: 0 auto 9mm;
        }

        .football-pdf-cover-title {
          margin: 0;
          color: #ffffff;
          font-size: 18mm;
          line-height: 1.04;
          font-weight: 800;
          text-transform: uppercase;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.44);
        }

        .football-pdf-cover-meta {
          margin: 6mm 0 0;
          color: rgba(255, 255, 255, 0.88);
          font-size: 5.2mm;
          font-weight: 400;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        .football-pdf-panel {
          width: 100%;
          border: 0.35mm solid rgba(255, 255, 255, 0.38);
          background: rgba(255, 255, 255, 0.72);
          backdrop-filter: blur(2px);
          box-shadow: 0 5mm 15mm rgba(0, 0, 0, 0.2);
        }

        .football-pdf-intro-panel {
          width: 172mm;
          padding: 13mm 15mm;
        }

        .football-pdf-copy {
          margin: 0 0 7mm;
          color: #151515;
          font-size: 6mm;
          line-height: 1.5;
          font-weight: 300;
        }

        .football-pdf-copy:last-child {
          margin-bottom: 0;
        }

        .football-pdf-detail-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 3mm;
          margin-top: 10mm;
        }

        .football-pdf-detail {
          padding: 4mm;
          background: rgba(255, 255, 255, 0.45);
        }

        .football-pdf-detail span {
          display: block;
          color: rgba(17, 17, 17, 0.62);
          font-size: 3.1mm;
          font-weight: 400;
          text-transform: uppercase;
        }

        .football-pdf-detail strong {
          display: block;
          margin-top: 1mm;
          color: #111111;
          font-size: 4.4mm;
          line-height: 1.2;
          font-weight: 700;
        }

        .football-pdf-table {
          width: 100%;
          border-collapse: collapse;
          overflow: hidden;
          border: 0.35mm solid rgba(255, 255, 255, 0.38);
          background: rgba(255, 255, 255, 0.68);
          backdrop-filter: blur(2px);
          box-shadow: 0 5mm 15mm rgba(0, 0, 0, 0.18);
        }

        .football-pdf-table th,
        .football-pdf-table td {
          padding: 3.3mm 3.8mm;
          border-bottom: 0.25mm solid rgba(16, 16, 16, 0.14);
          color: #121212;
          font-size: 3.7mm;
          line-height: 1.25;
          vertical-align: top;
        }

        .football-pdf-table th {
          color: #ffffff;
          background: rgba(0, 0, 0, 0.7);
          font-size: 3.3mm;
          font-weight: 700;
          text-transform: uppercase;
        }

        .football-pdf-table tr:last-child td {
          border-bottom: 0;
        }

        .football-pdf-muted {
          color: rgba(18, 18, 18, 0.64);
          font-weight: 300;
        }

        .football-pdf-program-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 8mm;
          height: 8mm;
          color: #111111;
        }

        .football-pdf-program-icon svg {
          width: 7mm;
          height: 7mm;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .football-pdf-contingency {
          padding: 8mm 9mm;
        }
      }
    `;
    document.head.append(style);
  };

  const getValue = (selector) => String(document.querySelector(selector)?.value || "").trim();

  const formatDate = (value) => {
    if (!value) {
      return "datum nog in te vullen";
    }
    const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
    if (!year || !month || !day) {
      return value;
    }
    return new Intl.DateTimeFormat("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, day));
  };

  const cleanClubName = (value) => {
    const cleaned = String(value || "")
      .replace(/\|.*/g, "")
      .replace(/\bdraaiboek\b/gi, "")
      .replace(/\bvoetbaldag(?:en)?\b/gi, "")
      .replace(/\bhws\b/gi, "")
      .replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return cleaned || "HWS";
  };

  const collectPlaybookData = () => {
    const title = getValue('input[name="title"]') || "Draaiboek Voetbaldagen";
    const eventDate = getValue('input[name="event_date"]');
    const location = getValue('input[name="location"]');
    const productName = getValue('input[name="ecwid_product_name"]');
    const clubName = cleanClubName(title || productName || location);

    const staff = [...document.querySelectorAll("[data-football-staff-row]")]
      .map((row) => ({
        name: String(row.querySelector('input[name="staff_name"]')?.value || "").trim(),
        role: String(row.querySelector('input[name="staff_role"]')?.value || "").trim(),
        setupTask: String(row.querySelector('input[name="staff_setup_task"]')?.value || "").trim(),
      }))
      .filter((member) => member.name || member.role || member.setupTask);

    const program = [...document.querySelectorAll("[data-football-program-row]")]
      .map((row) => {
        const activity = String(row.querySelector('input[name="program_activity"]')?.value || "").trim();
        return {
          startTime: String(row.querySelector('input[name="program_start"]')?.value || "").trim(),
          endTime: String(row.querySelector('input[name="program_end"]')?.value || "").trim(),
          activity,
          icon: inferIcon(activity),
        };
      })
      .filter((item) => item.activity || item.startTime || item.endTime);

    return {
      title,
      eventDate,
      eventDateLabel: formatDate(eventDate),
      location,
      clubName,
      coverTitle: `${clubName} Voetbaldag`.toUpperCase(),
      staff,
      program,
      contingencies: getValue('textarea[name="contingencies"]'),
      registrationCount: String(registrationCount?.textContent || "0").trim(),
    };
  };

  const shuffle = (items) => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  };

  const makeElement = (tag, className = "", text = "") => {
    const element = document.createElement(tag);
    if (className) {
      element.className = className;
    }
    if (text) {
      element.textContent = text;
    }
    return element;
  };

  const appendBackground = (page, background) => {
    const image = makeElement("img", "football-pdf-bg");
    image.src = background;
    image.alt = "";
    const shade = makeElement("div", "football-pdf-shade");
    page.append(image, shade);
  };

  const createPage = (background, title = "") => {
    const page = makeElement("section", "football-pdf-page");
    appendBackground(page, background);
    const content = makeElement("div", "football-pdf-content");
    if (title) {
      const header = makeElement("header", "football-pdf-header");
      const logo = makeElement("img", "football-pdf-logo");
      logo.src = pdfLogo;
      logo.alt = "HWS Voetbalschool";
      header.append(logo, makeElement("h2", "football-pdf-header-title", title));
      content.append(header);
    }
    page.append(content);
    return { page, content };
  };

  const createCoverPage = (data, background) => {
    const { page, content } = createPage(background);
    content.classList.add("football-pdf-cover");
    const card = makeElement("div", "football-pdf-cover-card");
    const logo = makeElement("img", "football-pdf-cover-logo");
    logo.src = pdfLogo;
    logo.alt = "HWS Voetbalschool";
    card.append(logo, makeElement("h1", "football-pdf-cover-title", data.coverTitle));
    card.append(makeElement("p", "football-pdf-cover-meta", data.eventDateLabel));
    content.append(card);
    return page;
  };

  const createIntroPage = (data, background) => {
    const { page, content } = createPage(background, "Inleiding");
    const panel = makeElement("div", "football-pdf-panel football-pdf-intro-panel");
    panel.append(
      makeElement(
        "p",
        "football-pdf-copy",
        `In dit draaiboek vind je alle informatie voor de voetbaldag bij ${data.clubName} op ${data.eventDateLabel}.`
      ),
      makeElement(
        "p",
        "football-pdf-copy",
        "Het document bevat de taakverdeling, het programma en de afspraken voor onvoorziene omstandigheden, zodat trainers en medewerkers de dag strak en overzichtelijk kunnen begeleiden."
      )
    );
    const details = makeElement("div", "football-pdf-detail-grid");
    [
      ["Club", data.clubName],
      ["Datum", data.eventDateLabel],
      ["Locatie", data.location || "Nog in te vullen"],
    ].forEach(([label, value]) => {
      const item = makeElement("div", "football-pdf-detail");
      item.append(makeElement("span", "", label), makeElement("strong", "", value));
      details.append(item);
    });
    panel.append(details);
    content.append(panel);
    return page;
  };

  const appendCell = (row, tag, text, className = "") => {
    const cell = makeElement(tag, className, text);
    if (!text && text !== "") {
      cell.textContent = "-";
    }
    row.append(cell);
    return cell;
  };

  const createStaffPage = (data, background) => {
    const { page, content } = createPage(background, "Taakverdeling");
    const table = makeElement("table", "football-pdf-table");
    const thead = makeElement("thead");
    const headRow = makeElement("tr");
    ["Naam", "Rol", "Taak bij uitzetten"].forEach((label) => appendCell(headRow, "th", label));
    thead.append(headRow);
    const tbody = makeElement("tbody");
    const rows = data.staff.length ? data.staff : [{ name: "Nog in te vullen", role: "", setupTask: "" }];
    rows.forEach((member) => {
      const row = makeElement("tr");
      appendCell(row, "td", member.name);
      appendCell(row, "td", member.role);
      appendCell(row, "td", member.setupTask);
      tbody.append(row);
    });
    table.append(thead, tbody);
    content.append(table);
    return page;
  };

  const createProgramPage = (data, background) => {
    const { page, content } = createPage(background, "Programma");
    const table = makeElement("table", "football-pdf-table");
    const thead = makeElement("thead");
    const headRow = makeElement("tr");
    ["", "Start", "Einde", "Activiteit"].forEach((label) => appendCell(headRow, "th", label));
    thead.append(headRow);
    const tbody = makeElement("tbody");
    const rows = data.program.length ? data.program : [{ startTime: "", endTime: "", activity: "Nog in te vullen", icon: "clock" }];
    rows.forEach((item) => {
      const row = makeElement("tr");
      const iconCell = makeElement("td");
      const icon = makeElement("span", "football-pdf-program-icon");
      icon.innerHTML = iconSvgs[item.icon] || iconSvgs.clock;
      iconCell.append(icon);
      row.append(iconCell);
      appendCell(row, "td", item.startTime, "football-pdf-muted");
      appendCell(row, "td", item.endTime, "football-pdf-muted");
      appendCell(row, "td", item.activity);
      tbody.append(row);
    });
    table.append(thead, tbody);
    content.append(table);
    return page;
  };

  const createContingencyRows = (contingencies) => {
    const lines = contingencies
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      return [["Algemeen", "Nog in te vullen"]];
    }
    return lines.map((line) => {
      const separator = line.indexOf(":");
      if (separator > -1) {
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }
      return ["Scenario", line];
    });
  };

  const createContingenciesPage = (data, background) => {
    const { page, content } = createPage(background, "Onvoorzien");
    const table = makeElement("table", "football-pdf-table");
    table.classList.add("football-pdf-contingency");
    const thead = makeElement("thead");
    const headRow = makeElement("tr");
    ["Situatie", "Afspraak of oplossing"].forEach((label) => appendCell(headRow, "th", label));
    thead.append(headRow);
    const tbody = makeElement("tbody");
    createContingencyRows(data.contingencies).forEach(([scenario, solution]) => {
      const row = makeElement("tr");
      appendCell(row, "td", scenario);
      appendCell(row, "td", solution);
      tbody.append(row);
    });
    table.append(thead, tbody);
    content.append(table);
    return page;
  };

  const removePrintRoot = () => {
    printRoot?.remove();
    printRoot = null;
  };

  const buildFootballDaysPdf = () => {
    ensurePrintStyles();
    removePrintRoot();
    const data = collectPlaybookData();
    const backgrounds = shuffle(pdfBackgrounds);
    printRoot = makeElement("div", "football-pdf-export");
    printRoot.append(
      createCoverPage(data, backgrounds[0]),
      createIntroPage(data, backgrounds[1]),
      createStaffPage(data, backgrounds[2]),
      createProgramPage(data, backgrounds[3]),
      createContingenciesPage(data, backgrounds[4])
    );
    document.body.append(printRoot);
  };

  addStaffButton?.addEventListener("click", () => {
    appendStaffRow();
    refreshRemoveButtons(staffRows, "[data-football-staff-row]");
  });

  addProgramButton?.addEventListener("click", () => {
    appendProgramRow();
    refreshRemoveButtons(programRows, "[data-football-program-row]");
  });

  programImageImportInput?.addEventListener("change", () => {
    importProgramFromImage(programImageImportInput.files?.[0]);
    programImageImportInput.value = "";
  });

  addProgramImportPreviewRowButton?.addEventListener("click", () => {
    appendImportPreviewRow();
    refreshImportPreviewRemoveButtons();
  });

  confirmProgramImportButton?.addEventListener("click", () => {
    const importedProgram = collectImportPreviewRows();
    if (!importedProgram.length) {
      showProgramImportFeedback("Voeg minimaal een programmaregel toe voordat je importeert.", true);
      return;
    }
    replaceRows(programRows, "[data-football-program-row]", importedProgram, appendProgramRow);
    setProgramImportModalOpen(false);
    showProgramImportFeedback(`${importedProgram.length} programma-onderdelen geïmporteerd. Je kunt ze hieronder nog verder aanpassen.`);
  });

  programImportModal?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-football-program-import]")) {
      setProgramImportModalOpen(false);
      return;
    }
    const removeButton = event.target.closest("[data-remove-import-preview-row]");
    if (!removeButton) {
      return;
    }
    removeButton.closest("[data-football-import-preview-row]")?.remove();
    refreshImportPreviewRemoveButtons();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && programImportModal && !programImportModal.hidden) {
      setProgramImportModalOpen(false);
    }
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-football-row]");
    if (!button) {
      return;
    }
    const row = button.closest("[data-football-staff-row], [data-football-program-row]");
    const container = row?.parentElement;
    row?.remove();
    refreshRemoveButtons(container, "[data-football-staff-row]");
    refreshRemoveButtons(container, "[data-football-program-row]");
  });

  exportButton?.addEventListener("click", async () => {
    buildFootballDaysPdf();
    await Promise.all(
      [...printRoot.querySelectorAll("img")].map((image) => {
        if (image.complete) {
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      })
    );
    window.print();
  });

  window.addEventListener("afterprint", removePrintRoot);

  productSearchInput?.addEventListener("input", () => {
    if (productIdInput) {
      productIdInput.value = "";
    }
    if (productNameInput) {
      productNameInput.value = "";
    }
    if (productSkuInput) {
      productSkuInput.value = "";
    }
    if (clearProductButton instanceof HTMLButtonElement) {
      clearProductButton.hidden = true;
    }
    setRegistrationCount(0);
    window.clearTimeout(productSearchTimer);
    productSearchTimer = window.setTimeout(searchProducts, 180);
  });

  productSearchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchProducts();
    }
    if (event.key === "Escape") {
      hideProductResults();
    }
  });

  productResults?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-product-id]") : null;
    if (!target) {
      return;
    }
    selectProduct({
      id: target.dataset.productId || "",
      name: target.dataset.productName || "",
      sku: target.dataset.productSku || "",
    });
  });

  document.addEventListener("click", (event) => {
    if (!productResults || !productSearchInput) {
      return;
    }
    const target = event.target;
    if (target instanceof Node && (productResults.contains(target) || productSearchInput.contains(target))) {
      return;
    }
    hideProductResults();
  });

  clearProductButton?.addEventListener("click", clearProduct);

  document.querySelectorAll("[data-reuse-playbook]").forEach((select) => {
    select.addEventListener("change", () => {
      const playbook = previousPlaybooks.find((item) => String(item.id) === select.value);
      const section = select.dataset.reusePlaybook;
      if (!playbook || !section) {
        return;
      }
      if (section === "staff") {
        replaceRows(staffRows, "[data-football-staff-row]", playbook.staff || [], appendStaffRow);
      }
      if (section === "program") {
        replaceRows(programRows, "[data-football-program-row]", playbook.program || [], appendProgramRow);
      }
      if (section === "contingencies") {
        const textarea = document.querySelector('textarea[name="contingencies"]');
        if (textarea) {
          textarea.value = playbook.contingencies || "";
        }
      }
      select.value = "";
    });
  });

  document.querySelectorAll("[data-football-program-row]").forEach(bindProgramRow);
  refreshRemoveButtons(staffRows, "[data-football-staff-row]");
  refreshRemoveButtons(programRows, "[data-football-program-row]");
})();
