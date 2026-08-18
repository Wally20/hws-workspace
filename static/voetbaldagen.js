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
  const exportPdfButton = document.getElementById("exportFootballDaysPdf");
  const exportPptxButton = document.getElementById("exportFootballDaysPptx");
  const includeStaffSetupTasksInput = document.getElementById("includeStaffSetupTasks");
  const previousPlaybooksElement = document.getElementById("footballPreviousPlaybooks");
  const productSearchInput = document.getElementById("footballProductSearch");
  const productResults = document.getElementById("footballProductResults");
  const productIdInput = document.getElementById("footballEcwidProductId");
  const productNameInput = document.getElementById("footballEcwidProductName");
  const productSkuInput = document.getElementById("footballEcwidProductSku");
  const clearProductButton = document.getElementById("clearFootballProduct");
  const registrationCount = document.getElementById("footballRegistrationCount");
  const fieldBoard = document.getElementById("footballFieldBoard");
  const fieldLayoutInput = document.getElementById("footballFieldLayoutInput");
  const fieldTrainingsInput = document.getElementById("footballFieldTrainingsInput");
  const fieldTrainingNameInput = document.getElementById("footballFieldTrainingName");
  const fieldTrainingDateInput = document.getElementById("footballFieldTrainingDate");
  const fieldTrainingTabs = document.getElementById("footballFieldTrainingTabs");
  const fieldPeriodLabelInput = document.getElementById("footballFieldPeriodLabel");
  const fieldPeriodStartInput = document.getElementById("footballFieldPeriodStart");
  const fieldPeriodEndInput = document.getElementById("footballFieldPeriodEnd");
  const fieldPeriodTabs = document.getElementById("footballFieldPeriodTabs");
  const addFieldPeriodButton = document.getElementById("addFootballFieldPeriod");
  const duplicateFieldPeriodButton = document.getElementById("duplicateFootballFieldPeriod");
  const removeFieldPeriodButton = document.getElementById("removeFootballFieldPeriod");
  const addFieldTrainingButton = document.getElementById("addFootballFieldTraining");
  const duplicateFieldTrainingButton = document.getElementById("duplicateFootballFieldTraining");
  const removeFieldTrainingButton = document.getElementById("removeFootballFieldTraining");
  const addFieldBlockButton = document.getElementById("addFootballFieldBlock");
  const pasteFieldBlockButton = document.getElementById("pasteFootballFieldBlock");
  const addFieldArrowButton = document.getElementById("addFootballFieldArrow");
  const centerFieldBlocksButton = document.getElementById("centerFootballFieldBlocks");
  const clearFieldBlocksButton = document.getElementById("clearFootballFieldBlocks");
  const fieldBlockCount = document.getElementById("footballFieldBlockCount");
  const fieldBlockModal = document.getElementById("footballFieldBlockModal");
  const fieldBlockNameInput = document.getElementById("footballFieldBlockName");
  const fieldBlockColorInput = document.getElementById("footballFieldBlockColor");
  const copyFieldBlockButton = document.getElementById("copyFootballFieldBlock");
  const fieldColorSwatches = document.getElementById("footballFieldColorSwatches");
  const fieldArrowModal = document.getElementById("footballFieldArrowModal");
  const fieldArrowColorInput = document.getElementById("footballFieldArrowColor");
  const fieldArrowWidthInput = document.getElementById("footballFieldArrowWidth");
  const saveFieldArrowButton = document.getElementById("saveFootballFieldArrow");
  const deleteFieldArrowButton = document.getElementById("deleteFootballFieldArrow");
  const fieldExerciseSearchInput = document.getElementById("footballFieldExerciseSearch");
  const fieldExerciseSearchFeedback = document.getElementById("footballFieldExerciseSearchFeedback");
  const fieldExerciseList = document.getElementById("footballFieldExerciseList");
  const fieldExerciseCategoryFilter = document.getElementById("footballFieldExerciseCategoryFilter");
  const fieldExerciseKindFilter = document.getElementById("footballFieldExerciseKindFilter");
  const fieldExerciseAgeFilter = document.getElementById("footballFieldExerciseAgeFilter");
  const fieldExerciseDurationFilter = document.getElementById("footballFieldExerciseDurationFilter");
  const clearFieldExerciseFiltersButton = document.getElementById("clearFootballFieldExerciseFilters");
  const openFieldWizardButton = document.getElementById("openFootballFieldWizard");
  const fieldWizardModal = document.getElementById("footballFieldWizardModal");
  const fieldWizardAge = document.getElementById("footballFieldWizardAge");
  const fieldWizardAgeOptions = fieldWizardAge?.querySelector("[data-field-wizard-age-options]");
  const fieldWizardMatchRowsInput = document.getElementById("footballFieldWizardMatchRows");
  const fieldWizardFeedback = document.getElementById("footballFieldWizardFeedback");
  const fieldWizardRows = document.getElementById("footballFieldWizardRows");
  const fillFieldTrainingsButton = document.getElementById("fillFootballFieldTrainings");
  const sameExerciseExportInput = document.getElementById("footballFieldSameExerciseExport");
  const saveFieldBlockButton = document.getElementById("saveFootballFieldBlock");
  const deleteFieldBlockButton = document.getElementById("deleteFootballFieldBlock");
  const exerciseLibraryElement = document.getElementById("footballExerciseLibrary");
  const footballDaysForm = document.getElementById("footballDaysForm");
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const playbookType = footballDaysForm?.dataset.playbookType || "voetbaldagen";
  const supportsFieldTrainings = playbookType === "samenwerkende-amateurclubs" && Boolean(fieldTrainingsInput);
  const defaultPlaybookTitle = footballDaysForm?.dataset.defaultTitle || "Draaiboek Voetbaldagen";
  const pdfCoverTitle = footballDaysForm?.dataset.coverTitle || "HWS VOETBALDAG";
  const introSubject = footballDaysForm?.dataset.introSubject || "voetbaldag";
  const exportPdfApi = footballDaysForm?.dataset.exportPdfApi || "/api/voetbaldagen/export-pdf";
  const exportPptxApi = footballDaysForm?.dataset.exportPptxApi || "/api/voetbaldagen/export-pptx";
  const fallbackPdfFilename = footballDaysForm?.dataset.fallbackPdfFilename || "voetbaldag-draaiboek.pdf";
  const fallbackPptxFilename = footballDaysForm?.dataset.fallbackPptxFilename || "voetbaldag-draaiboek.pptx";
  let previousPlaybooks = [];
  let exerciseLibrary = [];
  let fieldLayout = [];
  let fieldTrainings = [];
  let footballAutosaveTimer = 0;
  let footballAutosaveController = null;
  let footballAutosaveToast = null;
  let footballAutosaveToastTimer = 0;
  let activeFieldTrainingId = "";
  let activeFieldPeriodId = "";
  let activeFieldBlockId = "";
  let activeFieldArrowId = "";
  let copiedFieldBlock = null;
  let selectedFieldExercise = null;
  let fieldPointerState = null;
  let fieldOpenModalTimer = 0;
  let productSearchTimer = null;
  let draggedProgramRow = null;
  let draggedFieldTrainingId = "";
  const fieldWizardSameExerciseValue = "__same_exercise__";

  const updateStaffSetupTaskVisibility = () => {
    const isVisible = includeStaffSetupTasksInput?.checked ?? true;
    staffRows?.classList.toggle("football-staff-table-no-setup-tasks", !isVisible);
  };

  if (previousPlaybooksElement) {
    try {
      previousPlaybooks = JSON.parse(previousPlaybooksElement.textContent || "[]");
    } catch (error) {
      previousPlaybooks = [];
    }
  }

  if (exerciseLibraryElement) {
    try {
      exerciseLibrary = JSON.parse(exerciseLibraryElement.textContent || "[]");
    } catch (error) {
      exerciseLibrary = [];
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

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const normalizeBlockColor = (value) => (/^#[0-9a-f]{6}$/i.test(String(value || "").trim()) ? String(value).trim().toUpperCase() : "#D5EFD3");

  const normalizeSearchText = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const getExerciseDurationLabel = (exercise) => {
    const rawDuration = String(exercise.duration || exercise.durationMinutes || exercise.duration_minutes || "").trim();
    if (!rawDuration) {
      return "";
    }
    const numberMatch = rawDuration.match(/\d+/);
    return numberMatch ? `${Number.parseInt(numberMatch[0], 10)} minuten` : rawDuration;
  };

  const normalizeAgeGroup = (value) => String(value || "").trim().toUpperCase().replace(/^JO/, "O").replace(/[^A-Z0-9]/g, "");

  const getExerciseAgeGroups = (exercise) =>
    Array.isArray(exercise?.ageGroups)
      ? exercise.ageGroups.map(normalizeAgeGroup).filter(Boolean).filter((age, index, items) => items.indexOf(age) === index)
      : [];

  const exerciseMatchesAge = (exercise, age) => {
    const normalizedAge = normalizeAgeGroup(age);
    const ageGroups = getExerciseAgeGroups(exercise);
    return !normalizedAge || ageGroups.includes(normalizedAge);
  };

  const exerciseMatchesAnyAge = (exercise, ages) => {
    const normalizedAges = Array.isArray(ages) ? ages.map(normalizeAgeGroup).filter(Boolean) : [];
    const ageGroups = getExerciseAgeGroups(exercise);
    return Boolean(ageGroups.length) && (!normalizedAges.length || normalizedAges.some((age) => ageGroups.includes(age)));
  };

  const getSelectedFieldWizardAges = () =>
    fieldWizardAge
      ? [...fieldWizardAge.querySelectorAll('input[type="checkbox"]:checked')]
          .map((option) => normalizeAgeGroup(option.value))
          .filter(Boolean)
      : [];

  const formatAgeList = (ages) =>
    ages.length > 2 ? `${ages.slice(0, -1).join(", ")} en ${ages[ages.length - 1]}` : ages.join(" en ");

  const populateSelectOptions = (select, values, defaultLabel) => {
    if (!select) {
      return;
    }
    const currentValue = select.value;
    select.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = defaultLabel;
    select.append(defaultOption);
    [...values]
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b), "nl", { numeric: true, sensitivity: "base" }))
      .forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.append(option);
      });
    select.value = [...select.options].some((option) => option.value === currentValue) ? currentValue : "";
  };

  const populateExerciseFilters = () => {
    populateSelectOptions(
      fieldExerciseCategoryFilter,
      new Set(exerciseLibrary.map((exercise) => String(exercise.category || "").trim())),
      "Alle categorieën"
    );
    populateSelectOptions(
      fieldExerciseKindFilter,
      new Set(exerciseLibrary.map((exercise) => String(exercise.trainingExercise || "").trim())),
      "Alle soorten"
    );
    populateSelectOptions(fieldExerciseAgeFilter, new Set(exerciseLibrary.flatMap(getExerciseAgeGroups)), "Alle leeftijden");
    populateSelectOptions(fieldExerciseDurationFilter, new Set(exerciseLibrary.map(getExerciseDurationLabel)), "Alle duren");
    populateFieldWizardAgeOptions(new Set(exerciseLibrary.flatMap(getExerciseAgeGroups)));
  };
  populateExerciseFilters();

  const getReadableTextColor = (hexColor) => {
    const color = normalizeBlockColor(hexColor).slice(1);
    const red = Number.parseInt(color.slice(0, 2), 16);
    const green = Number.parseInt(color.slice(2, 4), 16);
    const blue = Number.parseInt(color.slice(4, 6), 16);
    const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
    return luminance > 150 ? "#0f2f19" : "#ffffff";
  };

  const makeBlockId = () => `field-block-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const makeArrowId = () => `field-arrow-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const makeFieldPeriodId = () => `field-period-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const normalizeFieldBlock = (block = {}, index = 0) => {
    const width = clamp(Number.parseFloat(block.width) || 20, 8, 100);
    const height = clamp(Number.parseFloat(block.height) || 14, 6, 100);
    const parsedX = Number.parseFloat(block.x);
    const parsedY = Number.parseFloat(block.y);
    const fallbackX = 8 + (index % 4) * 8;
    const fallbackY = 8 + (index % 3) * 7;
    return {
      type: "block",
      id: String(block.id || makeBlockId()),
      x: clamp(Number.isFinite(parsedX) ? parsedX : fallbackX, 0, 100 - width),
      y: clamp(Number.isFinite(parsedY) ? parsedY : fallbackY, 0, 100 - height),
      width,
      height,
      title: String(block.title || "").trim(),
      exerciseId: Number.parseInt(block.exerciseId, 10) || 0,
      exerciseTitle: String(block.exerciseTitle || "").trim(),
      exerciseKind: String(block.exerciseKind || "").trim(),
      category: String(block.category || "").trim(),
      exerciseAgeGroups: Array.isArray(block.exerciseAgeGroups)
        ? block.exerciseAgeGroups.map(normalizeAgeGroup).filter(Boolean).filter((age, ageIndex, ages) => ages.indexOf(age) === ageIndex)
        : [],
      sameExerciseExport: Boolean(block.sameExerciseExport),
      sameExerciseKey: String(block.sameExerciseKey || "").trim(),
      color: normalizeBlockColor(block.color),
    };
  };

  const normalizeArrowColor = (value) => (/^#[0-9a-f]{6}$/i.test(String(value || "").trim()) ? String(value).trim().toUpperCase() : "#FFFFFF");

  const normalizeFieldArrow = (arrow = {}, index = 0) => {
    const parsedX1 = Number.parseFloat(arrow.x1);
    const parsedY1 = Number.parseFloat(arrow.y1);
    const parsedX2 = Number.parseFloat(arrow.x2);
    const parsedY2 = Number.parseFloat(arrow.y2);
    const strokeWidth = clamp(Number.parseFloat(arrow.strokeWidth) || Number.parseFloat(arrow.width) || 5, 2, 12);
    const fallbackY = 24 + (index % 4) * 12;
    return {
      type: "arrow",
      id: String(arrow.id || makeArrowId()),
      x1: clamp(Number.isFinite(parsedX1) ? parsedX1 : 22, 0, 100),
      y1: clamp(Number.isFinite(parsedY1) ? parsedY1 : fallbackY, 0, 100),
      x2: clamp(Number.isFinite(parsedX2) ? parsedX2 : 58, 0, 100),
      y2: clamp(Number.isFinite(parsedY2) ? parsedY2 : fallbackY + 10, 0, 100),
      color: normalizeArrowColor(arrow.color),
      strokeWidth,
    };
  };

  const normalizeFieldItem = (item = {}, index = 0) =>
    item.type === "arrow" || String(item.id || "").startsWith("field-arrow-")
      ? normalizeFieldArrow(item, index)
      : normalizeFieldBlock(item, index);

  const makeTrainingId = () => `training-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const normalizeTrainingAgeGroups = (value) =>
    Array.isArray(value)
      ? value.map(normalizeAgeGroup).filter(Boolean).filter((age, index, items) => items.indexOf(age) === index)
      : [];

  const normalizeFieldPeriod = (period = {}, index = 0, fallbackLayout = []) => ({
    id: String(period.id || makeFieldPeriodId()),
    label: String(period.label || period.name || `Plattegrond ${index + 1}`).trim() || `Plattegrond ${index + 1}`,
    startTime: String(period.startTime || period.start || "").trim(),
    endTime: String(period.endTime || period.end || "").trim(),
    fieldLayout: Array.isArray(period.fieldLayout) ? period.fieldLayout.map(normalizeFieldItem) : fallbackLayout.map(normalizeFieldItem),
  });

  const getExerciseExportKey = (block = {}) => {
    const exerciseId = Number.parseInt(block.exerciseId, 10) || 0;
    if (exerciseId) {
      return `exercise:${exerciseId}`;
    }
    const exerciseTitle = normalizeSearchText(block.exerciseTitle || "");
    return exerciseTitle ? `title:${exerciseTitle}` : "";
  };

  const normalizeFieldTraining = (training = {}, index = 0) => {
    const legacyLayout = Array.isArray(training.fieldLayout) ? training.fieldLayout.map(normalizeFieldItem) : [];
    const fieldPeriods = (Array.isArray(training.fieldPeriods) && training.fieldPeriods.length
      ? training.fieldPeriods.map((period, periodIndex) => normalizeFieldPeriod(period, periodIndex))
      : [normalizeFieldPeriod({}, 0, legacyLayout)]
    ).filter((period) => period.label || period.startTime || period.endTime || period.fieldLayout.length);
    const periods = fieldPeriods.length ? fieldPeriods : [normalizeFieldPeriod({}, 0, legacyLayout)];
    return {
      id: String(training.id || makeTrainingId()),
      name: String(training.name || training.title || `Training ${index + 1}`).trim() || `Training ${index + 1}`,
      date: String(training.date || "").trim(),
      ageGroups: normalizeTrainingAgeGroups(training.ageGroups),
      fieldPeriods: periods,
      fieldLayout: periods[0]?.fieldLayout || legacyLayout,
    };
  };

  const getFieldBlocks = () => fieldLayout.filter((item) => item.type !== "arrow");
  const getFieldArrows = () => fieldLayout.filter((item) => item.type === "arrow");

  const clearScheduledFieldModal = () => {
    if (fieldOpenModalTimer) {
      window.clearTimeout(fieldOpenModalTimer);
      fieldOpenModalTimer = 0;
    }
  };

  const syncFieldLayoutInput = () => {
    if (fieldLayoutInput) {
      fieldLayoutInput.value = JSON.stringify(fieldLayout.map((item, index) => normalizeFieldItem(item, index)));
    }
    if (supportsFieldTrainings) {
      syncActiveFieldTraining();
      syncFieldTrainingsInput();
    }
    if (fieldBlockCount) {
      const blockCount = getFieldBlocks().length;
      const arrowCount = getFieldArrows().length;
      fieldBlockCount.textContent = arrowCount ? `${blockCount} / ${arrowCount}` : String(blockCount);
    }
  };

  const syncFieldTrainingsInput = () => {
    if (fieldTrainingsInput) {
      fieldTrainingsInput.value = JSON.stringify(fieldTrainings.map((training, index) => normalizeFieldTraining(training, index)));
    }
  };

  const showFootballAutosaveToast = (message, state = "saved") => {
    if (!footballAutosaveToast) {
      footballAutosaveToast = document.createElement("div");
      footballAutosaveToast.className = "football-autosave-toast";
      footballAutosaveToast.setAttribute("role", "status");
      footballAutosaveToast.setAttribute("aria-live", "polite");
      document.body.append(footballAutosaveToast);
    }
    window.clearTimeout(footballAutosaveToastTimer);
    footballAutosaveToast.dataset.state = state;
    footballAutosaveToast.textContent = message;
    footballAutosaveToast.dataset.visible = "true";
    if (state !== "saving") {
      footballAutosaveToastTimer = window.setTimeout(() => {
        if (footballAutosaveToast) {
          footballAutosaveToast.dataset.visible = "false";
        }
      }, 2600);
    }
  };

  const autosaveFootballDaysForm = async () => {
    if (!footballDaysForm) {
      return false;
    }
    syncActiveFieldTraining();
    syncFieldLayoutInput();
    syncFieldTrainingsInput();
    if (footballAutosaveController) {
      footballAutosaveController.abort();
    }
    footballAutosaveController = new AbortController();
    showFootballAutosaveToast("Opslaan...", "saving");
    try {
      const response = await fetch(footballDaysForm.action || window.location.href, {
        method: "POST",
        body: new FormData(footballDaysForm),
        credentials: "same-origin",
        redirect: "follow",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          ...(csrfToken ? { "X-CSRFToken": csrfToken } : {}),
        },
        signal: footballAutosaveController.signal,
      });
      if (!response.ok) {
        throw new Error(`Autosave failed with status ${response.status}`);
      }
      if (response.redirected) {
        const redirectedUrl = new URL(response.url);
        if (redirectedUrl.origin === window.location.origin) {
          footballDaysForm.action = `${redirectedUrl.pathname}${redirectedUrl.search}`;
          if (window.location.pathname !== redirectedUrl.pathname) {
            window.history.replaceState({}, "", `${redirectedUrl.pathname}${redirectedUrl.search}`);
          }
        }
      }
      showFootballAutosaveToast("Opgeslagen", "saved");
      return true;
    } catch (error) {
      if (error?.name === "AbortError") {
        return false;
      }
      console.error("Automatisch opslaan mislukt", error);
      showFootballAutosaveToast("Opslaan mislukt", "error");
      return false;
    }
  };

  const scheduleFootballDaysAutosave = (delay = 500) => {
    if (!footballDaysForm) {
      return;
    }
    window.clearTimeout(footballAutosaveTimer);
    footballAutosaveTimer = window.setTimeout(() => {
      autosaveFootballDaysForm();
    }, delay);
  };

  const getActiveFieldTraining = () =>
    fieldTrainings.find((training) => training.id === activeFieldTrainingId) || fieldTrainings[0] || null;

  const getActiveFieldPeriod = (training = getActiveFieldTraining()) => {
    if (!training) {
      return null;
    }
    if (!Array.isArray(training.fieldPeriods) || !training.fieldPeriods.length) {
      training.fieldPeriods = [normalizeFieldPeriod({}, 0, training.fieldLayout || [])];
    }
    return training.fieldPeriods.find((period) => period.id === activeFieldPeriodId) || training.fieldPeriods[0];
  };

  const syncActiveFieldPeriod = () => {
    if (!supportsFieldTrainings || !activeFieldTrainingId) {
      return;
    }
    const activeTraining = getActiveFieldTraining();
    const activePeriod = getActiveFieldPeriod(activeTraining);
    if (!activeTraining || !activePeriod) {
      return;
    }
    activePeriod.label = String(fieldPeriodLabelInput?.value || activePeriod.label || "").trim() || activePeriod.label || "Plattegrond";
    activePeriod.startTime = String(fieldPeriodStartInput?.value || "").trim();
    activePeriod.endTime = String(fieldPeriodEndInput?.value || "").trim();
    activePeriod.fieldLayout = fieldLayout.map((item, index) => normalizeFieldItem(item, index));
    activeTraining.fieldLayout = activeTraining.fieldPeriods[0]?.fieldLayout || activePeriod.fieldLayout;
  };

  const syncActiveFieldTraining = () => {
    if (!supportsFieldTrainings || !activeFieldTrainingId) {
      return;
    }
    syncActiveFieldPeriod();
    const activeTraining = getActiveFieldTraining();
    if (!activeTraining) {
      return;
    }
    activeTraining.name = String(fieldTrainingNameInput?.value || activeTraining.name || "").trim() || activeTraining.name || "Training";
    activeTraining.date = String(fieldTrainingDateInput?.value || "").trim();
    activeTraining.ageGroups = normalizeTrainingAgeGroups(activeTraining.ageGroups);
    activeTraining.fieldLayout = activeTraining.fieldPeriods?.[0]?.fieldLayout || fieldLayout.map((item, index) => normalizeFieldItem(item, index));
  };

  const setFieldBlockLabel = (element, block) => {
    const title = block.title || `Blok ${getFieldBlocks().findIndex((item) => item.id === block.id) + 1}`;
    const exercise = block.exerciseTitle || "Geen oefening";
    element.querySelector("[data-field-block-title]").textContent = title;
    element.querySelector("[data-field-block-exercise]").textContent = exercise;
  };

  const appendFieldMarkings = () => {
    if (!fieldBoard) {
      return;
    }
    const markings = document.createElement("div");
    markings.className = "football-field-markings";
    markings.setAttribute("aria-hidden", "true");
    [
      "halfway",
      "center-circle",
      "center-spot",
      "penalty-box-top",
      "penalty-box-bottom",
      "goal-box-top",
      "goal-box-bottom",
      "goal-top",
      "goal-bottom",
      "penalty-spot-top",
      "penalty-spot-bottom",
      "corner-top-left",
      "corner-top-right",
      "corner-bottom-left",
      "corner-bottom-right",
    ].forEach((name) => {
      const line = document.createElement("span");
      line.className = `football-field-line football-field-${name}`;
      markings.append(line);
    });
    fieldBoard.append(markings);
  };

  const appendAlignmentGuides = () => {
    if (!fieldBoard) {
      return;
    }
    const guides = document.createElement("div");
    guides.className = "football-field-alignment-guides";
    guides.setAttribute("aria-hidden", "true");
    ["vertical", "horizontal"].forEach((direction) => {
      const line = document.createElement("span");
      line.className = `football-field-guide football-field-guide-${direction}`;
      line.dataset.fieldGuide = direction;
      guides.append(line);
    });
    ["horizontal", "vertical"].forEach((direction) => {
      const measurement = document.createElement("span");
      measurement.className = `football-field-distance football-field-distance-${direction}`;
      measurement.dataset.fieldDistance = direction;
      measurement.append(document.createElement("span"));
      guides.append(measurement);
    });
    fieldBoard.append(guides);
  };

  const hideFieldAlignmentGuides = () => {
    fieldBoard?.querySelectorAll("[data-field-guide]").forEach((guide) => {
      guide.classList.remove("football-field-guide-active");
    });
    fieldBoard?.querySelectorAll("[data-field-distance]").forEach((distance) => {
      distance.classList.remove("football-field-distance-active");
    });
  };

  const showFieldAlignmentGuide = (direction, value) => {
    const guide = fieldBoard?.querySelector(`[data-field-guide="${direction}"]`);
    if (!guide) {
      return;
    }
    if (direction === "vertical") {
      guide.style.left = `${value}%`;
    } else {
      guide.style.top = `${value}%`;
    }
    guide.classList.add("football-field-guide-active");
  };

  const formatFieldDistance = (value) => {
    if (value < 1) {
      return `${Math.round(value * 10) / 10}%`;
    }
    return `${Math.round(value)}%`;
  };

  const showFieldDistanceGuide = (direction, start, end, crossAxis, value) => {
    const measurement = fieldBoard?.querySelector(`[data-field-distance="${direction}"]`);
    if (!measurement || end <= start) {
      return;
    }
    if (direction === "horizontal") {
      measurement.style.left = `${start}%`;
      measurement.style.top = `${crossAxis}%`;
      measurement.style.width = `${end - start}%`;
      measurement.style.height = "";
    } else {
      measurement.style.left = `${crossAxis}%`;
      measurement.style.top = `${start}%`;
      measurement.style.width = "";
      measurement.style.height = `${end - start}%`;
    }
    const label = measurement.querySelector("span");
    if (label) {
      label.textContent = formatFieldDistance(value);
    }
    measurement.classList.add("football-field-distance-active");
  };

  const getGapOverlap = (firstStart, firstEnd, secondStart, secondEnd) =>
    Math.max(0, Math.min(firstEnd, secondEnd) - Math.max(firstStart, secondStart));

  const getClosestFieldDistance = (block, direction) => {
    const isHorizontal = direction === "horizontal";
    const candidates = [];
    getFieldBlocks().forEach((otherBlock) => {
      if (otherBlock.id === block.id) {
        return;
      }
      if (isHorizontal) {
        const verticalOverlap = getGapOverlap(block.y, block.y + block.height, otherBlock.y, otherBlock.y + otherBlock.height);
        if (verticalOverlap <= 0) {
          return;
        }
        if (otherBlock.x + otherBlock.width <= block.x) {
          candidates.push({
            start: otherBlock.x + otherBlock.width,
            end: block.x,
            crossAxis: Math.max(block.y, otherBlock.y) + verticalOverlap / 2,
          });
        } else if (block.x + block.width <= otherBlock.x) {
          candidates.push({
            start: block.x + block.width,
            end: otherBlock.x,
            crossAxis: Math.max(block.y, otherBlock.y) + verticalOverlap / 2,
          });
        }
      } else {
        const horizontalOverlap = getGapOverlap(block.x, block.x + block.width, otherBlock.x, otherBlock.x + otherBlock.width);
        if (horizontalOverlap <= 0) {
          return;
        }
        if (otherBlock.y + otherBlock.height <= block.y) {
          candidates.push({
            start: otherBlock.y + otherBlock.height,
            end: block.y,
            crossAxis: Math.max(block.x, otherBlock.x) + horizontalOverlap / 2,
          });
        } else if (block.y + block.height <= otherBlock.y) {
          candidates.push({
            start: block.y + block.height,
            end: otherBlock.y,
            crossAxis: Math.max(block.x, otherBlock.x) + horizontalOverlap / 2,
          });
        }
      }
    });
    return candidates
      .map((candidate) => ({ ...candidate, value: candidate.end - candidate.start }))
      .filter((candidate) => candidate.value >= 0)
      .sort((a, b) => a.value - b.value)[0] || null;
  };

  const getEqualSpacingMatch = (block, direction) => {
    const isHorizontal = direction === "horizontal";
    const threshold = 1.15;
    let closest = null;
    getFieldBlocks().forEach((anchorBlock) => {
      if (anchorBlock.id === block.id) {
        return;
      }
      getFieldBlocks().forEach((referenceBlock) => {
        if (referenceBlock.id === block.id || referenceBlock.id === anchorBlock.id) {
          return;
        }
        if (isHorizontal) {
          const referenceOverlap = getGapOverlap(anchorBlock.y, anchorBlock.y + anchorBlock.height, referenceBlock.y, referenceBlock.y + referenceBlock.height);
          const movingOverlap = getGapOverlap(block.y, block.y + block.height, anchorBlock.y, anchorBlock.y + anchorBlock.height);
          if (referenceOverlap <= 0 || movingOverlap <= 0) {
            return;
          }
          const referenceGap = referenceBlock.x >= anchorBlock.x + anchorBlock.width
            ? referenceBlock.x - (anchorBlock.x + anchorBlock.width)
            : anchorBlock.x - (referenceBlock.x + referenceBlock.width);
          const targets = [
            { value: anchorBlock.x - referenceGap - block.width, offset: 0 },
            { value: anchorBlock.x + anchorBlock.width + referenceGap, offset: 0 },
          ];
          targets.forEach((target) => {
            const distance = Math.abs(block.x - target.value);
            if (distance <= threshold && (!closest || distance < closest.distance)) {
              closest = { ...target, distance };
            }
          });
        } else {
          const referenceOverlap = getGapOverlap(anchorBlock.x, anchorBlock.x + anchorBlock.width, referenceBlock.x, referenceBlock.x + referenceBlock.width);
          const movingOverlap = getGapOverlap(block.x, block.x + block.width, anchorBlock.x, anchorBlock.x + anchorBlock.width);
          if (referenceOverlap <= 0 || movingOverlap <= 0) {
            return;
          }
          const referenceGap = referenceBlock.y >= anchorBlock.y + anchorBlock.height
            ? referenceBlock.y - (anchorBlock.y + anchorBlock.height)
            : anchorBlock.y - (referenceBlock.y + referenceBlock.height);
          const targets = [
            { value: anchorBlock.y - referenceGap - block.height, offset: 0 },
            { value: anchorBlock.y + anchorBlock.height + referenceGap, offset: 0 },
          ];
          targets.forEach((target) => {
            const distance = Math.abs(block.y - target.value);
            if (distance <= threshold && (!closest || distance < closest.distance)) {
              closest = { ...target, distance };
            }
          });
        }
      });
    });
    return closest;
  };

  const getAlignmentMatch = (block, direction) => {
    const isVertical = direction === "vertical";
    const threshold = 1.15;
    const blockValues = isVertical
      ? [
          { value: block.x, offset: 0 },
          { value: block.x + block.width / 2, offset: block.width / 2 },
          { value: block.x + block.width, offset: block.width },
        ]
      : [
          { value: block.y, offset: 0 },
          { value: block.y + block.height / 2, offset: block.height / 2 },
          { value: block.y + block.height, offset: block.height },
        ];
    const anchors = [{ value: 50, source: "field-center" }];
    getFieldBlocks().forEach((otherBlock) => {
      if (otherBlock.id === block.id) {
        return;
      }
      if (isVertical) {
        anchors.push(
          { value: otherBlock.x, source: otherBlock.id },
          { value: otherBlock.x + otherBlock.width / 2, source: otherBlock.id },
          { value: otherBlock.x + otherBlock.width, source: otherBlock.id }
        );
      } else {
        anchors.push(
          { value: otherBlock.y, source: otherBlock.id },
          { value: otherBlock.y + otherBlock.height / 2, source: otherBlock.id },
          { value: otherBlock.y + otherBlock.height, source: otherBlock.id }
        );
      }
    });

    let closest = null;
    blockValues.forEach((blockValue) => {
      anchors.forEach((anchor) => {
        const distance = Math.abs(blockValue.value - anchor.value);
        if (distance <= threshold && (!closest || distance < closest.distance)) {
          closest = { ...anchor, offset: blockValue.offset, distance };
        }
      });
    });
    return closest;
  };

  const applyFieldAlignmentGuides = (block, canSnap = false) => {
    hideFieldAlignmentGuides();
    const verticalMatch = getAlignmentMatch(block, "vertical");
    const horizontalMatch = getAlignmentMatch(block, "horizontal");
    if (canSnap && verticalMatch) {
      block.x = clamp(verticalMatch.value - verticalMatch.offset, 0, 100 - block.width);
    }
    if (canSnap && horizontalMatch) {
      block.y = clamp(horizontalMatch.value - horizontalMatch.offset, 0, 100 - block.height);
    }
    const equalHorizontal = canSnap ? getEqualSpacingMatch(block, "horizontal") : null;
    const equalVertical = canSnap ? getEqualSpacingMatch(block, "vertical") : null;
    if (equalHorizontal) {
      block.x = clamp(equalHorizontal.value, 0, 100 - block.width);
    }
    if (equalVertical) {
      block.y = clamp(equalVertical.value, 0, 100 - block.height);
    }
    if (verticalMatch) {
      showFieldAlignmentGuide("vertical", verticalMatch.value);
    }
    if (horizontalMatch) {
      showFieldAlignmentGuide("horizontal", horizontalMatch.value);
    }
    const horizontalDistance = getClosestFieldDistance(block, "horizontal");
    const verticalDistance = getClosestFieldDistance(block, "vertical");
    if (horizontalDistance) {
      showFieldDistanceGuide("horizontal", horizontalDistance.start, horizontalDistance.end, horizontalDistance.crossAxis, horizontalDistance.value);
    }
    if (verticalDistance) {
      showFieldDistanceGuide("vertical", verticalDistance.start, verticalDistance.end, verticalDistance.crossAxis, verticalDistance.value);
    }
  };

  const updateFieldBlockElement = (element, block) => {
    if (!element || !block) {
      return;
    }
    element.style.left = `${block.x}%`;
    element.style.top = `${block.y}%`;
    element.style.width = `${block.width}%`;
    element.style.height = `${block.height}%`;
    element.dataset.fieldBlockId = block.id;
    const blockColor = normalizeBlockColor(block.color);
    const textColor = getReadableTextColor(blockColor);
    element.style.backgroundColor = blockColor;
    element.style.color = textColor;
    element.style.setProperty("--field-block-muted-color", textColor === "#ffffff" ? "rgba(255, 255, 255, 0.82)" : "rgba(15, 47, 25, 0.72)");
    const boardBox = fieldBoard?.getBoundingClientRect();
    const blockPixels = boardBox
      ? Math.min((block.width / 100) * boardBox.width, (block.height / 100) * boardBox.height)
      : 96;
    const titleSize = clamp(blockPixels * 0.13, 9, 24);
    element.style.setProperty("--field-block-title-size", `${titleSize}px`);
    element.style.setProperty("--field-block-exercise-size", `${clamp(titleSize * 0.72, 7, 16)}px`);
    setFieldBlockLabel(element, block);
  };

  const getFieldBlock = (id) => getFieldBlocks().find((block) => block.id === id);
  const getFieldArrow = (id) => getFieldArrows().find((arrow) => arrow.id === id);

  const updateFieldArrowElement = (element, arrow) => {
    if (!element || !arrow) {
      return;
    }
    element.dataset.fieldArrowId = arrow.id;
    element.querySelector("[data-field-arrow-line]")?.setAttribute("x1", `${arrow.x1}`);
    element.querySelector("[data-field-arrow-line]")?.setAttribute("y1", `${arrow.y1}`);
    element.querySelector("[data-field-arrow-line]")?.setAttribute("x2", `${arrow.x2}`);
    element.querySelector("[data-field-arrow-line]")?.setAttribute("y2", `${arrow.y2}`);
    element.querySelector("[data-field-arrow-line]")?.setAttribute("stroke", arrow.color);
    element.querySelector("[data-field-arrow-line]")?.setAttribute("stroke-width", `${arrow.strokeWidth}`);
    element.querySelector("[data-field-arrow-start]")?.setAttribute("cx", `${arrow.x1}`);
    element.querySelector("[data-field-arrow-start]")?.setAttribute("cy", `${arrow.y1}`);
    element.querySelector("[data-field-arrow-end]")?.setAttribute("cx", `${arrow.x2}`);
    element.querySelector("[data-field-arrow-end]")?.setAttribute("cy", `${arrow.y2}`);
    element.querySelectorAll("[data-field-arrow-handle]").forEach((handle) => {
      handle.setAttribute("fill", arrow.color);
    });
  };

  const createFieldArrowElement = (arrow) => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.classList.add("football-field-arrow");
    group.dataset.fieldArrowId = arrow.id;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("football-field-arrow-line");
    line.dataset.fieldArrowLine = "1";
    line.setAttribute("marker-end", "url(#football-field-arrow-head)");
    const startHandle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    startHandle.classList.add("football-field-arrow-handle");
    startHandle.dataset.fieldArrowHandle = "start";
    startHandle.dataset.fieldArrowStart = "1";
    startHandle.setAttribute("r", "2.5");
    const endHandle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    endHandle.classList.add("football-field-arrow-handle");
    endHandle.dataset.fieldArrowHandle = "end";
    endHandle.dataset.fieldArrowEnd = "1";
    endHandle.setAttribute("r", "2.5");
    group.append(line, startHandle, endHandle);
    updateFieldArrowElement(group, arrow);
    return group;
  };

  const appendFieldArrows = () => {
    if (!fieldBoard) {
      return;
    }
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("football-field-arrows");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.innerHTML = `
      <defs>
        <marker id="football-field-arrow-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"></path>
        </marker>
      </defs>
    `;
    getFieldArrows().forEach((arrow) => {
      svg.append(createFieldArrowElement(arrow));
    });
    fieldBoard.append(svg);
  };

  const renderFieldBoard = () => {
    if (!fieldBoard) {
      return;
    }
    fieldBoard.innerHTML = "";
    appendFieldMarkings();
    fieldLayout = fieldLayout.map(normalizeFieldItem);
    appendFieldArrows();
    appendAlignmentGuides();
    getFieldBlocks().forEach((block) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "football-field-block";
      element.innerHTML = `
        <span class="football-field-block-title" data-field-block-title></span>
        <span class="football-field-block-exercise" data-field-block-exercise></span>
        <span class="football-field-resize-handle football-field-resize-nw" data-field-resize="nw" aria-hidden="true"></span>
        <span class="football-field-resize-handle football-field-resize-ne" data-field-resize="ne" aria-hidden="true"></span>
        <span class="football-field-resize-handle football-field-resize-sw" data-field-resize="sw" aria-hidden="true"></span>
        <span class="football-field-resize-handle football-field-resize-se" data-field-resize="se" aria-hidden="true"></span>
      `;
      updateFieldBlockElement(element, block);
      fieldBoard.append(element);
    });
    syncFieldLayoutInput();
  };

  const renderFieldTrainingTabs = () => {
    if (!supportsFieldTrainings || !fieldTrainingTabs) {
      return;
    }
    fieldTrainingTabs.innerHTML = "";
    fieldTrainings.forEach((training, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `subtle-button action-small${training.id === activeFieldTrainingId ? " football-field-training-tab-active" : ""}`;
      button.dataset.fieldTrainingId = training.id;
      button.draggable = true;
      button.setAttribute("aria-label", `${training.name || `Training ${index + 1}`} slepen`);
      button.title = "Sleep om de volgorde te wijzigen";
      button.textContent = `${training.name || `Training ${index + 1}`}${training.date ? ` - ${training.date}` : ""}`;
      fieldTrainingTabs.append(button);
    });
  };

  const reorderFieldTraining = (sourceTrainingId, targetTrainingId) => {
    if (!supportsFieldTrainings || !sourceTrainingId || !targetTrainingId || sourceTrainingId === targetTrainingId) {
      return;
    }
    syncActiveFieldTraining();
    const sourceIndex = fieldTrainings.findIndex((training) => training.id === sourceTrainingId);
    const targetIndex = fieldTrainings.findIndex((training) => training.id === targetTrainingId);
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }
    const [movedTraining] = fieldTrainings.splice(sourceIndex, 1);
    fieldTrainings.splice(targetIndex, 0, movedTraining);
    activeFieldTrainingId = movedTraining.id;
    renderFieldTrainingTabs();
    syncFieldTrainingsInput();
  };

  const getFieldPeriodTitle = (period, index) => {
    const label = String(period?.label || `Plattegrond ${index + 1}`).trim();
    const start = String(period?.startTime || "").trim();
    const end = String(period?.endTime || "").trim();
    return `${label}${start || end ? ` (${start || "--:--"}-${end || "--:--"})` : ""}`;
  };

  const renderFieldPeriodTabs = () => {
    if (!supportsFieldTrainings || !fieldPeriodTabs) {
      return;
    }
    const activeTraining = getActiveFieldTraining();
    fieldPeriodTabs.innerHTML = "";
    (activeTraining?.fieldPeriods || []).forEach((period, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `subtle-button action-small${period.id === activeFieldPeriodId ? " football-field-period-tab-active" : ""}`;
      button.dataset.fieldPeriodId = period.id;
      button.textContent = getFieldPeriodTitle(period, index);
      fieldPeriodTabs.append(button);
    });
  };

  const loadActiveFieldPeriod = () => {
    const activeTraining = getActiveFieldTraining();
    const activePeriod = getActiveFieldPeriod(activeTraining);
    if (!activePeriod) {
      return;
    }
    activeFieldPeriodId = activePeriod.id;
    fieldLayout = (activePeriod.fieldLayout || []).map(normalizeFieldItem);
    if (fieldPeriodLabelInput) {
      fieldPeriodLabelInput.value = activePeriod.label || "";
    }
    if (fieldPeriodStartInput) {
      fieldPeriodStartInput.value = activePeriod.startTime || "";
    }
    if (fieldPeriodEndInput) {
      fieldPeriodEndInput.value = activePeriod.endTime || "";
    }
    renderFieldPeriodTabs();
    renderFieldBoard();
  };

  const loadActiveFieldTraining = () => {
    if (!supportsFieldTrainings) {
      return;
    }
    const activeTraining = getActiveFieldTraining();
    if (!activeTraining) {
      return;
    }
    activeFieldTrainingId = activeTraining.id;
    if (!Array.isArray(activeTraining.fieldPeriods) || !activeTraining.fieldPeriods.length) {
      activeTraining.fieldPeriods = [normalizeFieldPeriod({}, 0, activeTraining.fieldLayout || [])];
    }
    activeFieldPeriodId = activeTraining.fieldPeriods[0]?.id || "";
    if (fieldTrainingNameInput) {
      fieldTrainingNameInput.value = activeTraining.name || "";
    }
    if (fieldTrainingDateInput) {
      fieldTrainingDateInput.value = activeTraining.date || "";
    }
    renderFieldTrainingTabs();
    loadActiveFieldPeriod();
  };

  const selectFieldTraining = (trainingId) => {
    if (!supportsFieldTrainings || trainingId === activeFieldTrainingId) {
      return;
    }
    syncActiveFieldTraining();
    activeFieldTrainingId = trainingId;
    loadActiveFieldTraining();
  };

  const addFieldTraining = () => {
    if (!supportsFieldTrainings) {
      return;
    }
    syncActiveFieldTraining();
    const nextIndex = fieldTrainings.length + 1;
    const training = normalizeFieldTraining({ id: makeTrainingId(), name: `Training ${nextIndex}`, date: "", fieldPeriods: [normalizeFieldPeriod({}, 0)] }, nextIndex - 1);
    fieldTrainings.push(training);
    activeFieldTrainingId = training.id;
    loadActiveFieldTraining();
  };

  const selectFieldPeriod = (periodId) => {
    if (!supportsFieldTrainings || periodId === activeFieldPeriodId) {
      return;
    }
    syncActiveFieldPeriod();
    activeFieldPeriodId = periodId;
    loadActiveFieldPeriod();
    syncFieldTrainingsInput();
  };

  const addFieldPeriod = () => {
    if (!supportsFieldTrainings) {
      return;
    }
    syncActiveFieldPeriod();
    const activeTraining = getActiveFieldTraining();
    if (!activeTraining) {
      return;
    }
    const nextIndex = (activeTraining.fieldPeriods || []).length;
    const period = normalizeFieldPeriod({ id: makeFieldPeriodId(), label: `Plattegrond ${nextIndex + 1}`, fieldLayout: [] }, nextIndex);
    activeTraining.fieldPeriods.push(period);
    activeFieldPeriodId = period.id;
    loadActiveFieldPeriod();
    syncFieldTrainingsInput();
  };

  const duplicateActiveFieldPeriod = () => {
    if (!supportsFieldTrainings || !activeFieldPeriodId) {
      return;
    }
    syncActiveFieldPeriod();
    const activeTraining = getActiveFieldTraining();
    const sourcePeriod = getActiveFieldPeriod(activeTraining);
    if (!activeTraining || !sourcePeriod) {
      return;
    }
    const nextIndex = activeTraining.fieldPeriods.length;
    const duplicatedLayout = (sourcePeriod.fieldLayout || []).map((item, index) => {
      if (item.type === "arrow") {
        return normalizeFieldArrow({ ...item, id: makeArrowId() }, index);
      }
      return normalizeFieldBlock({ ...item, id: makeBlockId() }, index);
    });
    const period = normalizeFieldPeriod(
      {
        id: makeFieldPeriodId(),
        label: `${String(sourcePeriod.label || `Plattegrond ${nextIndex}`).replace(/\s+kopie(?:\s+\d+)?$/i, "").trim()} kopie`,
        startTime: sourcePeriod.startTime || "",
        endTime: sourcePeriod.endTime || "",
        fieldLayout: duplicatedLayout,
      },
      nextIndex
    );
    activeTraining.fieldPeriods.push(period);
    activeFieldPeriodId = period.id;
    loadActiveFieldPeriod();
    syncFieldTrainingsInput();
  };

  const removeActiveFieldPeriod = () => {
    const activeTraining = getActiveFieldTraining();
    if (!supportsFieldTrainings || !activeTraining || activeTraining.fieldPeriods.length <= 1 || !activeFieldPeriodId) {
      return;
    }
    if (!window.confirm("Deze plattegrond uit de training verwijderen?")) {
      return;
    }
    const activeIndex = activeTraining.fieldPeriods.findIndex((period) => period.id === activeFieldPeriodId);
    activeTraining.fieldPeriods = activeTraining.fieldPeriods.filter((period) => period.id !== activeFieldPeriodId);
    activeFieldPeriodId = (activeTraining.fieldPeriods[Math.max(0, activeIndex - 1)] || activeTraining.fieldPeriods[0])?.id || "";
    loadActiveFieldPeriod();
    syncFieldTrainingsInput();
  };

  const getDuplicatedTrainingName = (sourceName, fallbackIndex) => {
    const existingNames = new Set(fieldTrainings.map((training) => normalizeSearchText(training.name)));
    const cleanName = String(sourceName || `Training ${fallbackIndex}`).replace(/\s+kopie(?:\s+\d+)?$/i, "").trim() || `Training ${fallbackIndex}`;
    const firstCopy = `${cleanName} kopie`;
    if (!existingNames.has(normalizeSearchText(firstCopy))) {
      return firstCopy;
    }
    for (let number = 2; number < 100; number += 1) {
      const candidate = `${cleanName} kopie ${number}`;
      if (!existingNames.has(normalizeSearchText(candidate))) {
        return candidate;
      }
    }
    return firstCopy;
  };

  const duplicateActiveFieldTraining = () => {
    if (!supportsFieldTrainings || !activeFieldTrainingId) {
      return;
    }
    syncActiveFieldTraining();
    const sourceTraining = fieldTrainings.find((training) => training.id === activeFieldTrainingId);
    if (!sourceTraining) {
      return;
    }
    const trainingIndex = fieldTrainings.length;
    const duplicatedPeriods = (sourceTraining.fieldPeriods || [normalizeFieldPeriod({}, 0, sourceTraining.fieldLayout || [])]).map((period, periodIndex) => {
      const duplicatedLayout = (period.fieldLayout || []).map((item, index) => {
        if (item.type === "arrow") {
          return normalizeFieldArrow({ ...item, id: makeArrowId() }, index);
        }
        return normalizeFieldBlock({ ...item, id: makeBlockId() }, index);
      });
      return normalizeFieldPeriod({ ...period, id: makeFieldPeriodId(), fieldLayout: duplicatedLayout }, periodIndex);
    });
    const training = normalizeFieldTraining(
      {
        id: makeTrainingId(),
        name: getDuplicatedTrainingName(sourceTraining.name, trainingIndex + 1),
        date: "",
        ageGroups: sourceTraining.ageGroups || [],
        fieldPeriods: duplicatedPeriods,
      },
      trainingIndex
    );
    fieldTrainings.push(training);
    activeFieldTrainingId = training.id;
    loadActiveFieldTraining();
  };

  const removeActiveFieldTraining = () => {
    if (!supportsFieldTrainings || fieldTrainings.length <= 1 || !activeFieldTrainingId) {
      return;
    }
    if (!window.confirm("Deze training uit de veldplattegrond verwijderen?")) {
      return;
    }
    const activeIndex = fieldTrainings.findIndex((training) => training.id === activeFieldTrainingId);
    fieldTrainings = fieldTrainings.filter((training) => training.id !== activeFieldTrainingId);
    activeFieldTrainingId = (fieldTrainings[Math.max(0, activeIndex - 1)] || fieldTrainings[0])?.id || "";
    loadActiveFieldTraining();
  };

  const openFieldBlockModal = (blockId) => {
    clearScheduledFieldModal();
    const block = getFieldBlock(blockId);
    if (!block || !fieldBlockModal) {
      return;
    }
    activeFieldBlockId = blockId;
    selectedFieldExercise = block.exerciseId
      ? { id: block.exerciseId, title: block.exerciseTitle, exerciseKind: block.exerciseKind, category: block.category, ageGroups: block.exerciseAgeGroups || [] }
      : null;
    if (fieldBlockNameInput) {
      fieldBlockNameInput.value = block.title || "";
    }
    if (fieldBlockColorInput) {
      fieldBlockColorInput.value = normalizeBlockColor(block.color).toLowerCase();
    }
    if (fieldExerciseSearchInput) {
      fieldExerciseSearchInput.value = block.exerciseTitle || "";
    }
    if (sameExerciseExportInput) {
      sameExerciseExportInput.checked = Boolean(block.sameExerciseExport);
      sameExerciseExportInput.disabled = !block.exerciseId && !block.exerciseTitle;
    }
    renderFieldExercises();
    fieldBlockModal.hidden = false;
    document.body.classList.add("modal-open");
    fieldBlockNameInput?.focus();
  };

  const closeFieldBlockModal = () => {
    if (!fieldBlockModal) {
      return;
    }
    fieldBlockModal.hidden = true;
    document.body.classList.remove("modal-open");
    activeFieldBlockId = "";
    selectedFieldExercise = null;
  };

  const openFieldArrowModal = (arrowId) => {
    clearScheduledFieldModal();
    const arrow = getFieldArrow(arrowId);
    if (!arrow || !fieldArrowModal) {
      return;
    }
    activeFieldArrowId = arrowId;
    if (fieldArrowColorInput) {
      fieldArrowColorInput.value = normalizeArrowColor(arrow.color).toLowerCase();
    }
    if (fieldArrowWidthInput) {
      fieldArrowWidthInput.value = String(arrow.strokeWidth || 5);
    }
    fieldArrowModal.hidden = false;
    document.body.classList.add("modal-open");
    fieldArrowColorInput?.focus();
  };

  const closeFieldArrowModal = () => {
    if (!fieldArrowModal) {
      return;
    }
    fieldArrowModal.hidden = true;
    document.body.classList.remove("modal-open");
    activeFieldArrowId = "";
  };

  const saveActiveFieldArrow = () => {
    const arrow = getFieldArrow(activeFieldArrowId);
    if (!arrow) {
      return;
    }
    arrow.color = normalizeArrowColor(fieldArrowColorInput?.value);
    arrow.strokeWidth = clamp(Number.parseFloat(fieldArrowWidthInput?.value) || 5, 2, 12);
    renderFieldBoard();
    closeFieldArrowModal();
  };

  const renderFieldExercises = () => {
    if (!fieldExerciseList) {
      return;
    }
    const query = normalizeSearchText(fieldExerciseSearchInput?.value || "");
    const queryParts = query.split(/\s+/).filter(Boolean);
    const categoryFilter = String(fieldExerciseCategoryFilter?.value || "").trim();
    const kindFilter = String(fieldExerciseKindFilter?.value || "").trim();
    const ageFilter = normalizeAgeGroup(fieldExerciseAgeFilter?.value || "");
    const durationFilter = String(fieldExerciseDurationFilter?.value || "").trim();
    const matches = exerciseLibrary
      .filter((exercise) => {
        if (categoryFilter && String(exercise.category || "").trim() !== categoryFilter) {
          return false;
        }
        if (kindFilter && String(exercise.trainingExercise || "").trim() !== kindFilter) {
          return false;
        }
        if (!exerciseMatchesAge(exercise, ageFilter)) {
          return false;
        }
        if (durationFilter && getExerciseDurationLabel(exercise) !== durationFilter) {
          return false;
        }
        const haystack = normalizeSearchText(
          [
            exercise.title,
            exercise.category,
            exercise.trainingExercise,
            getExerciseAgeGroups(exercise).join(" "),
            exercise.description,
            exercise.coaching,
            exercise.dimensions,
            exercise.materials,
          ].join(" ")
        );
        return !queryParts.length || queryParts.every((part) => haystack.includes(part));
      });
    fieldExerciseList.innerHTML = "";
    if (fieldExerciseSearchFeedback) {
      const hasFilters = Boolean(queryParts.length || categoryFilter || kindFilter || ageFilter || durationFilter);
      fieldExerciseSearchFeedback.textContent = hasFilters
        ? `${matches.length} oefeningen gevonden`
        : `${exerciseLibrary.length} oefeningen beschikbaar`;
    }
    if (!matches.length) {
      const empty = document.createElement("p");
      empty.className = "football-field-empty";
      empty.textContent = "Geen oefeningen gevonden";
      fieldExerciseList.append(empty);
      return;
    }
    const exerciseOptions = document.createDocumentFragment();
    matches.forEach((exercise) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "football-field-exercise-option";
      button.dataset.exerciseId = exercise.id || "";
      button.dataset.exerciseTitle = exercise.title || "";
      button.dataset.exerciseKind = exercise.trainingExercise || "";
      button.dataset.exerciseCategory = exercise.category || "";
      button.dataset.exerciseAgeGroups = JSON.stringify(getExerciseAgeGroups(exercise));
      button.classList.toggle("football-field-exercise-option-active", Number(selectedFieldExercise?.id || 0) === Number(exercise.id || 0));
      button.innerHTML = `
        <span class="football-field-exercise-preview"></span>
        <span class="football-field-exercise-copy">
          <strong></strong>
          <span></span>
        </span>
      `;
      const preview = button.querySelector(".football-field-exercise-preview");
      if (exercise.fieldSvg) {
        preview.innerHTML = exercise.fieldSvg;
      } else {
        preview.textContent = "Geen veldtekening";
        preview.classList.add("football-field-exercise-preview-empty");
      }
      button.querySelector("strong").textContent = exercise.title || "Naamloze oefening";
      button.querySelector(".football-field-exercise-copy span").textContent = [exercise.category, exercise.trainingExercise, getExerciseAgeGroups(exercise).join(", "), getExerciseDurationLabel(exercise)]
        .filter(Boolean)
        .join(" - ") || "Oefening";
      exerciseOptions.append(button);
    });
    fieldExerciseList.append(exerciseOptions);
    if (sameExerciseExportInput) {
      sameExerciseExportInput.disabled = !selectedFieldExercise && !String(fieldExerciseSearchInput?.value || "").trim();
    }
  };

  const saveActiveFieldBlock = () => {
    const block = getFieldBlock(activeFieldBlockId);
    if (!block) {
      return;
    }
    block.title = String(fieldBlockNameInput?.value || "").trim();
    block.color = normalizeBlockColor(fieldBlockColorInput?.value);
    const exerciseInputText = String(fieldExerciseSearchInput?.value || "").trim();
    if (!exerciseInputText) {
      block.exerciseId = 0;
      block.exerciseTitle = "";
      block.exerciseKind = "";
      block.category = "";
      block.exerciseAgeGroups = [];
      block.sameExerciseExport = false;
      block.sameExerciseKey = "";
    } else if (selectedFieldExercise) {
      block.exerciseId = Number.parseInt(selectedFieldExercise.id, 10) || 0;
      block.exerciseTitle = selectedFieldExercise.title || "";
      block.exerciseKind = selectedFieldExercise.exerciseKind || "";
      block.category = selectedFieldExercise.category || "";
      block.exerciseAgeGroups = getExerciseAgeGroups(selectedFieldExercise);
      block.sameExerciseExport = Boolean(sameExerciseExportInput?.checked);
      block.sameExerciseKey = block.sameExerciseExport ? getExerciseExportKey(block) : "";
    } else {
      block.sameExerciseExport = Boolean(sameExerciseExportInput?.checked);
      block.sameExerciseKey = block.sameExerciseExport ? getExerciseExportKey(block) : "";
    }
    renderFieldBoard();
    closeFieldBlockModal();
  };

  const addFieldBlock = () => {
    const index = getFieldBlocks().length;
    const block = normalizeFieldBlock(
      {
        title: `Blok ${index + 1}`,
        x: 6 + (index % 4) * 22,
        y: 7 + (Math.floor(index / 4) % 4) * 21,
        width: 18,
        height: 15,
        color: "#D5EFD3",
      },
      index
    );
    fieldLayout.push(block);
    renderFieldBoard();
    openFieldBlockModal(block.id);
  };

  const copyActiveFieldBlock = () => {
    const block = getFieldBlock(activeFieldBlockId);
    if (!block) {
      return;
    }
    copiedFieldBlock = { ...block };
    if (pasteFieldBlockButton instanceof HTMLButtonElement) {
      pasteFieldBlockButton.disabled = false;
    }
  };

  const getCopiedFieldBlockTitle = (sourceTitle, fallbackIndex) => {
    const existingTitles = new Set(getFieldBlocks().map((block) => normalizeSearchText(block.title)));
    const rawTitle = String(sourceTitle || "").trim();
    const title = rawTitle || `Blok ${fallbackIndex + 1}`;
    const numberedMatch = title.match(/^(.*?)(\d+)$/);
    if (numberedMatch) {
      const prefix = numberedMatch[1];
      const startNumber = Number.parseInt(numberedMatch[2], 10) + 1;
      for (let number = startNumber; number < startNumber + 100; number += 1) {
        const candidate = `${prefix}${number}`.trim();
        if (!existingTitles.has(normalizeSearchText(candidate))) {
          return candidate;
        }
      }
    }
    const cleanBase = title.replace(/\s+kopie(?:\s+\d+)?$/i, "").trim() || `Blok ${fallbackIndex + 1}`;
    const firstCopy = `${cleanBase} kopie`;
    if (!existingTitles.has(normalizeSearchText(firstCopy))) {
      return firstCopy;
    }
    for (let number = 2; number < 100; number += 1) {
      const candidate = `${cleanBase} kopie ${number}`;
      if (!existingTitles.has(normalizeSearchText(candidate))) {
        return candidate;
      }
    }
    return `${cleanBase} kopie`;
  };

  const createCopiedFieldBlock = (sourceBlock, { openModal = true } = {}) => {
    if (!sourceBlock) {
      return null;
    }
    const index = getFieldBlocks().length;
    const width = Number(sourceBlock.width || 18);
    const height = Number(sourceBlock.height || 15);
    const block = normalizeFieldBlock(
      {
        ...sourceBlock,
        id: makeBlockId(),
        title: getCopiedFieldBlockTitle(sourceBlock.title, index),
        x: clamp(Number(sourceBlock.x || 0) + 4, 0, 100 - width),
        y: clamp(Number(sourceBlock.y || 0) + 4, 0, 100 - height),
      },
      index
    );
    fieldLayout.push(block);
    renderFieldBoard();
    if (openModal) {
      openFieldBlockModal(block.id);
    }
    return block;
  };

  const pasteFieldBlock = () => {
    createCopiedFieldBlock(copiedFieldBlock);
  };

  const getCopiedFieldArrowOffset = (sourceArrow) => {
    const xValues = [Number(sourceArrow.x1 || 0), Number(sourceArrow.x2 || 0)];
    const yValues = [Number(sourceArrow.y1 || 0), Number(sourceArrow.y2 || 0)];
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);
    return {
      x: maxX <= 96 ? 4 : minX >= 4 ? -4 : 0,
      y: maxY <= 96 ? 4 : minY >= 4 ? -4 : 0,
    };
  };

  const createCopiedFieldArrow = (sourceArrow) => {
    if (!sourceArrow) {
      return null;
    }
    const offset = getCopiedFieldArrowOffset(sourceArrow);
    const arrow = normalizeFieldArrow({
      ...sourceArrow,
      id: makeArrowId(),
      x1: clamp(Number(sourceArrow.x1 || 0) + offset.x, 0, 100),
      y1: clamp(Number(sourceArrow.y1 || 0) + offset.y, 0, 100),
      x2: clamp(Number(sourceArrow.x2 || 0) + offset.x, 0, 100),
      y2: clamp(Number(sourceArrow.y2 || 0) + offset.y, 0, 100),
    });
    fieldLayout.push(arrow);
    renderFieldBoard();
    return arrow;
  };

  const addFieldArrow = () => {
    const index = getFieldArrows().length;
    const arrow = normalizeFieldArrow({}, index);
    fieldLayout.push(arrow);
    renderFieldBoard();
    openFieldArrowModal(arrow.id);
  };

  const centerFieldBlocks = () => {
    const blocks = getFieldBlocks();
    if (!blocks.length) {
      return;
    }
    const minX = Math.min(...blocks.map((block) => block.x));
    const minY = Math.min(...blocks.map((block) => block.y));
    const maxX = Math.max(...blocks.map((block) => block.x + block.width));
    const maxY = Math.max(...blocks.map((block) => block.y + block.height));
    const offsetX = 50 - (minX + (maxX - minX) / 2);
    const offsetY = 50 - (minY + (maxY - minY) / 2);
    blocks.forEach((block) => {
      block.x = clamp(block.x + offsetX, 0, 100 - block.width);
      block.y = clamp(block.y + offsetY, 0, 100 - block.height);
    });
    renderFieldBoard();
  };

  const setFieldWizardOpen = (isOpen) => {
    if (!fieldWizardModal) {
      return;
    }
    fieldWizardModal.hidden = !isOpen;
    document.body.classList.toggle("modal-open", isOpen);
  };

  const getFieldWizardCategoryOptions = () =>
    [...new Set(exerciseLibrary.map((exercise) => String(exercise.category || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "nl", { numeric: true, sensitivity: "base" }));

  const getFieldWizardExerciseOptions = (category = "") => {
    const ages = getSelectedFieldWizardAges();
    return exerciseLibrary
      .filter((exercise) => {
        if (!exerciseMatchesAnyAge(exercise, ages)) {
          return false;
        }
        if (category && String(exercise.category || "").trim() !== category) {
          return false;
        }
        return true;
      })
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || ""), "nl", { numeric: true, sensitivity: "base" }));
  };

  function updateFieldWizardFeedback() {
    if (!fieldWizardFeedback) {
      return;
    }
    const ages = getSelectedFieldWizardAges();
    const count = exerciseLibrary.filter((exercise) => exerciseMatchesAnyAge(exercise, ages)).length;
    if (!ages.length) {
      fieldWizardFeedback.textContent = `${count} oefeningen met leeftijdscategorie beschikbaar. Kies een of meer leeftijden.`;
      return;
    }
    fieldWizardFeedback.textContent = `${count} oefeningen beschikbaar voor ${formatAgeList(ages)}.`;
  }

  function populateFieldWizardAgeOptions(values) {
    if (!fieldWizardAgeOptions) {
      return;
    }
    const selectedAges = new Set(getSelectedFieldWizardAges());
    fieldWizardAgeOptions.innerHTML = "";
    [...values]
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b), "nl", { numeric: true, sensitivity: "base" }))
      .forEach((value) => {
        const normalizedValue = normalizeAgeGroup(value);
        const label = document.createElement("label");
        label.className = "football-field-wizard-age-option";
        label.innerHTML = `
          <input type="checkbox" value="">
          <span></span>
        `;
        const input = label.querySelector("input");
        input.value = normalizedValue;
        input.checked = selectedAges.has(normalizedValue);
        label.querySelector("span").textContent = normalizedValue;
        fieldWizardAgeOptions.append(label);
      });
    updateFieldWizardFeedback();
  }

  const getFieldWizardRowLabel = (training, period, block, fallbackIndex = 0) => {
    const parts = [];
    if (training?.name) {
      parts.push(training.name);
    }
    if (period?.label) {
      parts.push(period.label);
    }
    parts.push(getFieldWizardBlockDisplayTitle(block, fallbackIndex));
    return parts.filter(Boolean).join(" - ");
  };

  const getFieldWizardBlockExerciseNumber = (block) => {
    const title = String(block?.title || "").trim();
    const exerciseMatch = title.match(/\bO\s*([1-4])\b/i);
    if (exerciseMatch) {
      return Number.parseInt(exerciseMatch[1], 10);
    }
    const fieldMatch = title.match(/\bVeld\s*([1-4])\b/i);
    return fieldMatch ? Number.parseInt(fieldMatch[1], 10) : 0;
  };

  const getFieldWizardBlockSortKey = (block, fallbackIndex = 0) => {
    const exerciseNumber = getFieldWizardBlockExerciseNumber(block);
    return {
      exerciseNumber: exerciseNumber || 99,
      title: String(block?.title || "").trim(),
      fallbackIndex,
    };
  };

  const compareFieldWizardBlockOrder = (a, b) =>
    a.sortKey.exerciseNumber - b.sortKey.exerciseNumber
    || a.sortKey.title.localeCompare(b.sortKey.title, "nl", { numeric: true, sensitivity: "base" })
    || a.sortKey.fallbackIndex - b.sortKey.fallbackIndex;

  const getFieldWizardBlockDisplayTitle = (block, fallbackIndex = 0) => {
    const title = String(block?.title || "").trim();
    const fieldMatch = title.match(/^Veld\s*([1-4])(\b.*)?$/i);
    if (fieldMatch) {
      return `O${Number.parseInt(fieldMatch[1], 10)}${fieldMatch[2] || ""}`.trim();
    }
    return title || `Blok ${fallbackIndex + 1}`;
  };

  const getFieldWizardTargets = () => {
    if (supportsFieldTrainings) {
      syncActiveFieldTraining();
    }
    const trainings = supportsFieldTrainings && fieldTrainings.length
      ? fieldTrainings
      : [{ id: activeFieldTrainingId || "active-training", name: "Training", fieldPeriods: [normalizeFieldPeriod({}, 0, fieldLayout)] }];
    return trainings.map((training, trainingIndex) => {
      const normalizedTraining = normalizeFieldTraining(training, trainingIndex);
      const periods = Array.isArray(normalizedTraining.fieldPeriods) && normalizedTraining.fieldPeriods.length
        ? normalizedTraining.fieldPeriods
        : [normalizeFieldPeriod({}, 0, normalizedTraining.fieldLayout || [])];
      return {
        training,
        trainingIndex,
        periods: periods.map((period, periodIndex) => {
          const layout = Array.isArray(period.fieldLayout) ? period.fieldLayout.map(normalizeFieldItem) : [];
          const blocks = layout
            .filter((item) => item.type !== "arrow")
            .map((block, blockIndex) => ({ block, sortKey: getFieldWizardBlockSortKey(block, blockIndex) }))
            .sort(compareFieldWizardBlockOrder)
            .map(({ block }) => block);
          return {
            period,
            periodIndex,
            blocks,
            sortKey: blocks.length
              ? getFieldWizardBlockSortKey(blocks[0], periodIndex)
              : { exerciseNumber: 99, title: String(period?.label || ""), fallbackIndex: periodIndex },
          };
        }).sort(compareFieldWizardBlockOrder),
      };
    });
  };

  const getFieldWizardSourceOptions = (row) => {
    const container = row.closest(".football-field-wizard-training") || fieldWizardRows;
    return [...(container?.querySelectorAll("[data-wizard-block-id]") || [])]
      .filter((candidate) => candidate !== row)
      .map((candidate) => ({
        value: candidate.dataset.wizardBlockId || "",
        label: candidate.dataset.wizardLabel || candidate.querySelector(".football-field-wizard-block")?.textContent || "",
      }))
      .filter((option) => option.value && option.label);
  };

  const populateFieldWizardExerciseSelect = (row) => {
    const select = row?.querySelector("[data-wizard-exercise]");
    if (!select) {
      return;
    }
    const currentValue = select.value;
    const category = String(row.querySelector("[data-wizard-category]")?.value || "").trim();
    if (category === fieldWizardSameExerciseValue) {
      select.innerHTML = '<option value="">Kies gekoppelde oefening</option>';
      getFieldWizardSourceOptions(row).forEach((source) => {
        const option = document.createElement("option");
        option.value = source.value;
        option.textContent = source.label;
        select.append(option);
      });
      select.value = [...select.options].some((option) => option.value === currentValue) ? currentValue : "";
      return;
    }
    select.innerHTML = '<option value="">Willekeurig uit categorie</option>';
    getFieldWizardExerciseOptions(category).forEach((exercise) => {
      const option = document.createElement("option");
      option.value = String(exercise.id || "");
      option.textContent = exercise.title || "Naamloze oefening";
      select.append(option);
    });
    select.value = [...select.options].some((option) => option.value === currentValue) ? currentValue : "";
  };

  const refreshFieldWizardExerciseSelects = () => {
    fieldWizardRows?.querySelectorAll("[data-wizard-block-id]").forEach(populateFieldWizardExerciseSelect);
  };

  const renderFieldWizardRows = () => {
    if (!fieldWizardRows) {
      return;
    }
    const targetGroups = getFieldWizardTargets();
    const categoryOptions = getFieldWizardCategoryOptions();
    fieldWizardRows.innerHTML = "";
    if (!targetGroups.some((group) => group.periods.some((period) => period.blocks.length))) {
      const empty = document.createElement("p");
      empty.className = "football-field-empty";
      empty.textContent = "Voeg eerst blokken toe aan de veldplattegrond.";
      fieldWizardRows.append(empty);
      return;
    }
    fieldWizardRows.style.setProperty("--wizard-training-count", String(Math.max(1, targetGroups.length)));
    const grid = document.createElement("div");
    grid.className = "football-field-wizard-training-grid";
    targetGroups.forEach((group) => {
      const column = document.createElement("section");
      column.className = "football-field-wizard-training";
      column.dataset.wizardTrainingId = group.training.id || `training-${group.trainingIndex + 1}`;
      const heading = document.createElement("h3");
      heading.textContent = group.training.name || `Training ${group.trainingIndex + 1}`;
      column.append(heading);
      group.periods.forEach(({ period, periodIndex, blocks }) => {
        if (!blocks.length) {
          return;
        }
        const periodTitle = document.createElement("p");
        periodTitle.className = "football-field-wizard-period";
        periodTitle.textContent = period.label || `Plattegrond ${periodIndex + 1}`;
        column.append(periodTitle);
        blocks.forEach((block, index) => {
          const row = document.createElement("div");
          row.className = "football-field-wizard-row";
          row.dataset.wizardTrainingId = group.training.id || "";
          row.dataset.wizardPeriodId = period.id || "";
          row.dataset.wizardBlockId = block.id;
          row.dataset.wizardLabel = getFieldWizardRowLabel(group.training, period, block, index);
          row.innerHTML = `
            <span class="football-field-wizard-block"></span>
            <label>
              <span>Categorie oefening</span>
              <select data-wizard-category>
                <option value="">Kies categorie</option>
                <option value="${fieldWizardSameExerciseValue}">Zelfde oefening</option>
              </select>
            </label>
            <label>
              <span>Vaste oefening</span>
              <select data-wizard-exercise>
                <option value="">Willekeurig uit categorie</option>
              </select>
            </label>
          `;
          row.querySelector(".football-field-wizard-block").textContent = getFieldWizardBlockDisplayTitle(block, index);
          const select = row.querySelector("[data-wizard-category]");
          categoryOptions.forEach((category) => {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = category;
            select.append(option);
          });
          select.value = categoryOptions.includes(block.category) ? block.category : "";
          select.addEventListener("change", () => populateFieldWizardExerciseSelect(row));
          populateFieldWizardExerciseSelect(row);
          column.append(row);
        });
      });
      grid.append(column);
    });
    fieldWizardRows.append(grid);
  };

  const openFieldWizard = () => {
    if (!supportsFieldTrainings || !fieldWizardModal) {
      return;
    }
    renderFieldWizardRows();
    updateFieldWizardFeedback();
    setFieldWizardOpen(true);
    fieldWizardAge?.querySelector('input[type="checkbox"]')?.focus();
  };

  const getWizardExerciseUniqueKey = (exercise) => {
    const exerciseId = Number.parseInt(exercise?.id, 10) || 0;
    if (exerciseId) {
      return `exercise:${exerciseId}`;
    }
    const title = normalizeSearchText(exercise?.title || "");
    return title ? `title:${title}` : "";
  };

  const getWizardMatchedRowKey = (block = {}) => {
    const title = String(block.title || "").trim();
    if (!/\brij\s*[12]\b/i.test(title)) {
      return "";
    }
    const baseTitle = title
      .replace(/\s*[-–—]?\s*\brij\s*[12]\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return normalizeSearchText(baseTitle || title);
  };

  const findExerciseForWizardRow = (category, usedExerciseKeys) => {
    const ages = getSelectedFieldWizardAges();
    const matches = exerciseLibrary.filter((exercise) => {
      if (!exerciseMatchesAnyAge(exercise, ages)) {
        return false;
      }
      if (category && String(exercise.category || "").trim() !== category) {
        return false;
      }
      return true;
    });
    const unusedMatches = matches.filter((exercise) => {
      const exerciseKey = getWizardExerciseUniqueKey(exercise);
      return exerciseKey && !usedExerciseKeys.has(exerciseKey);
    });
    if (!unusedMatches.length) {
      return null;
    }
    return unusedMatches[Math.floor(Math.random() * unusedMatches.length)];
  };

  const getWizardFixedExercise = (exerciseId) => {
    const normalizedId = Number.parseInt(exerciseId, 10) || 0;
    if (!normalizedId) {
      return null;
    }
    return exerciseLibrary.find((exercise) => Number(exercise.id || 0) === normalizedId) || null;
  };

  const applyWizardExerciseToBlock = (block, exercise) => {
    block.exerciseId = Number.parseInt(exercise.id, 10) || 0;
    block.exerciseTitle = exercise.title || "";
    block.exerciseKind = exercise.trainingExercise || "";
    block.category = exercise.category || "";
    block.exerciseAgeGroups = getExerciseAgeGroups(exercise);
    block.sameExerciseKey = block.sameExerciseExport ? getExerciseExportKey(block) : "";
  };

  const fillFieldTrainingsFromWizard = () => {
    if (!fieldWizardRows) {
      return;
    }
    const ages = getSelectedFieldWizardAges();
    if (!ages.length) {
      if (fieldWizardFeedback) {
        fieldWizardFeedback.textContent = "Kies eerst minimaal een leeftijd waarvoor deze training is.";
      }
      fieldWizardAge?.querySelector('input[type="checkbox"]')?.focus();
      return;
    }
    syncActiveFieldTraining();
    const wizardChoiceList = [...fieldWizardRows.querySelectorAll("[data-wizard-block-id]")]
      .map((row) => ({
        blockId: String(row.dataset.wizardBlockId || ""),
        category: String(row.querySelector("[data-wizard-category]")?.value || "").trim(),
        exerciseId: String(row.querySelector("[data-wizard-exercise]")?.value || "").trim(),
        sameBlockId: String(row.querySelector("[data-wizard-category]")?.value || "").trim() === fieldWizardSameExerciseValue
          ? String(row.querySelector("[data-wizard-exercise]")?.value || "").trim()
          : "",
      }));
    const wizardChoices = new Map(wizardChoiceList.map((choice) => [choice.blockId, choice]));
    if (!wizardChoiceList.some((choice) => choice.category || choice.exerciseId || choice.sameBlockId)) {
      if (fieldWizardFeedback) {
        fieldWizardFeedback.textContent = "Kies per blok eerst een categorie of een vaste oefening.";
      }
      return;
    }
    let filledCount = 0;
    const missingBlocks = [];
    const shouldMatchRows = Boolean(fieldWizardMatchRowsInput?.checked);
    const trainingsToFill = supportsFieldTrainings && fieldTrainings.length
      ? fieldTrainings
      : [{ id: activeFieldTrainingId || "active-training", name: "Training", fieldLayout }];
    trainingsToFill.forEach((training, trainingIndex) => {
      const usedExerciseKeys = new Set();
      const matchedRowExercises = new Map();
      const resolvedExercises = new Map();
      training.ageGroups = ages;
      const periods = Array.isArray(training.fieldPeriods) && training.fieldPeriods.length
        ? training.fieldPeriods
        : [normalizeFieldPeriod({}, 0, training.fieldLayout || [])];
      const resolveExerciseForItem = (item, blockIndex, resolving = new Set()) => {
        const choice = wizardChoices.get(item.id) || {};
        if (!choice.category && !choice.exerciseId && !choice.sameBlockId) {
          return null;
        }
        if (choice.sameBlockId) {
          if (resolvedExercises.has(choice.sameBlockId)) {
            return resolvedExercises.get(choice.sameBlockId);
          }
          if (resolving.has(choice.sameBlockId)) {
            return null;
          }
          const sourceItem = periods
            .flatMap((period) => (Array.isArray(period.fieldLayout) ? period.fieldLayout : []))
            .map(normalizeFieldItem)
            .find((candidate) => candidate.id === choice.sameBlockId && candidate.type !== "arrow");
          if (!sourceItem) {
            return null;
          }
          resolving.add(item.id);
          const sourceExercise = resolveExerciseForItem(sourceItem, blockIndex, resolving);
          resolving.delete(item.id);
          if (sourceExercise) {
            resolvedExercises.set(choice.sameBlockId, sourceExercise);
          }
          return sourceExercise;
        }
        const matchedRowKey = shouldMatchRows ? getWizardMatchedRowKey(item) : "";
        const matchedRowExercise = matchedRowKey ? matchedRowExercises.get(matchedRowKey) : null;
        const exercise = matchedRowExercise || (choice.exerciseId
          ? getWizardFixedExercise(choice.exerciseId)
          : findExerciseForWizardRow(choice.category, usedExerciseKeys));
        const exerciseKey = getWizardExerciseUniqueKey(exercise);
        if (!exercise || !exerciseKey || (!matchedRowExercise && usedExerciseKeys.has(exerciseKey))) {
          return null;
        }
        if (!matchedRowExercise) {
          usedExerciseKeys.add(exerciseKey);
        }
        if (matchedRowKey && !matchedRowExercise) {
          matchedRowExercises.set(matchedRowKey, exercise);
        }
        resolvedExercises.set(item.id, exercise);
        return exercise;
      };
      periods.forEach((period, periodIndex) => {
        const layout = Array.isArray(period.fieldLayout) ? period.fieldLayout.map(normalizeFieldItem) : [];
        let blockIndex = 0;
        layout.forEach((item) => {
          if (item.type === "arrow") {
            return;
          }
          const choice = wizardChoices.get(item.id) || {};
          blockIndex += 1;
          if (!choice.category && !choice.exerciseId && !choice.sameBlockId) {
            return;
          }
          const exercise = resolveExerciseForItem(item, blockIndex);
          if (!exercise) {
            missingBlocks.push(`${training.name || `Training ${trainingIndex + 1}`} - ${period.label || `Plattegrond ${periodIndex + 1}`} - ${item.title || `Blok ${blockIndex}`}`);
            return;
          }
          applyWizardExerciseToBlock(item, exercise);
          filledCount += 1;
        });
        period.fieldLayout = layout;
      });
      training.fieldPeriods = periods;
      training.fieldLayout = periods[0]?.fieldLayout || [];
    });
    if (supportsFieldTrainings) {
      const activeTraining = fieldTrainings.find((training) => training.id === activeFieldTrainingId) || fieldTrainings[0];
      activeFieldPeriodId = activeTraining?.fieldPeriods?.[0]?.id || activeFieldPeriodId;
      fieldLayout = (getActiveFieldPeriod(activeTraining)?.fieldLayout || activeTraining?.fieldLayout || []).map(normalizeFieldItem);
      syncFieldTrainingsInput();
    } else {
      fieldLayout = trainingsToFill[0].fieldLayout || fieldLayout;
    }
    renderFieldBoard();
    if (fieldWizardFeedback) {
      fieldWizardFeedback.textContent = missingBlocks.length
        ? `${filledCount} blokken ingevuld. Geen unieke passende oefening voor: ${missingBlocks.join(", ")}.`
        : `${filledCount} blokken in alle trainingen ingevuld en opgeslagen in de veldplattegrond.`;
    }
    if (filledCount) {
      scheduleFootballDaysAutosave(250);
    }
    if (filledCount && !missingBlocks.length) {
      setFieldWizardOpen(false);
    }
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
    row.querySelector('[name="staff_setup_task"]').value = member.setupTask || "";
    staffRows.appendChild(row);
    updateStaffSetupTaskVisibility();
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

  const clearProgramDragState = () => {
    draggedProgramRow?.classList.remove("football-program-row-dragging");
    programRows?.querySelectorAll(".football-program-row-drop-target").forEach((row) => {
      row.classList.remove("football-program-row-drop-target");
    });
    draggedProgramRow = null;
  };

  const getProgramDragInsertBeforeRow = (container, pointerY) => {
    const rows = [...container.querySelectorAll("[data-football-program-row]:not(.football-program-row-dragging)")];
    return rows.reduce(
      (closest, row) => {
        const box = row.getBoundingClientRect();
        const offset = pointerY - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
          return { offset, row };
        }
        return closest;
      },
      { offset: Number.NEGATIVE_INFINITY, row: null }
    ).row;
  };

  const moveProgramRow = (row, direction) => {
    if (!programRows || !row) {
      return;
    }
    const sibling = direction < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (!sibling?.matches("[data-football-program-row]")) {
      return;
    }
    if (direction < 0) {
      programRows.insertBefore(row, sibling);
    } else {
      programRows.insertBefore(sibling, row);
    }
    row.querySelector("[data-football-program-drag-handle]")?.focus();
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
        @font-face {
          font-family: "Poppins";
          src: url("/static/assets/fonts/Poppins-Regular.ttf") format("truetype");
          font-weight: 400;
          font-style: normal;
        }

        @font-face {
          font-family: "Poppins";
          src: url("/static/assets/fonts/Poppins-Bold.ttf") format("truetype");
          font-weight: 700;
          font-style: normal;
        }

        @font-face {
          font-family: "Poppins";
          src: url("/static/assets/fonts/Poppins-ExtraBold.ttf") format("truetype");
          font-weight: 800;
          font-style: normal;
        }

        @font-face {
          font-family: "Poppins";
          src: url("/static/assets/fonts/Poppins-Black.ttf") format("truetype");
          font-weight: 900;
          font-style: normal;
        }

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
          color: #ffffff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body > *:not(.football-pdf-export) {
          display: none !important;
        }

        .football-pdf-export {
          display: block !important;
          font-family: Poppins, Arial, sans-serif;
          color: #ffffff;
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
          display: flex;
          align-items: center;
          min-height: 31mm;
          margin: 6mm 0 14mm 75mm;
        }

        .football-pdf-logo {
          width: 24mm;
          height: 24mm;
          object-fit: contain;
        }

        .football-pdf-header-title {
          margin: 0;
          color: #ffffff;
          font-size: 19mm;
          line-height: 1;
          font-weight: 900;
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
          padding: 23mm 20mm 9mm;
          border: 0.7mm solid rgba(255, 255, 255, 0.34);
          background: rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(2px);
          transform: translateY(12mm);
        }

        .football-pdf-cover-logo {
          width: 92mm;
          height: 92mm;
          object-fit: contain;
          margin: 0 auto 18mm;
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
          background: rgba(0, 0, 0, 0.62);
          backdrop-filter: blur(2px);
          box-shadow: 0 5mm 15mm rgba(0, 0, 0, 0.2);
        }

        .football-pdf-intro-panel {
          width: fit-content;
          max-width: 210mm;
          margin: 19mm auto 0;
          padding: 11mm 13mm;
          border-color: rgba(255, 255, 255, 0.58);
          background: rgba(255, 255, 255, 0.78);
        }

        .football-pdf-contingency-panel {
          width: min(210mm, 100%);
          margin: 19mm auto 0;
          padding: 11mm 13mm;
          border-color: rgba(255, 255, 255, 0.58);
          background: rgba(255, 255, 255, 0.78);
        }

        .football-pdf-copy {
          max-width: 176mm;
          margin: 0 0 7mm;
          color: #171717;
          font-size: 5.2mm;
          line-height: 1.45;
          font-weight: 400;
        }

        .football-pdf-copy:last-child {
          margin-bottom: 0;
        }

        .football-pdf-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, 71mm);
          gap: 4.8mm 8mm;
          margin-top: 8mm;
        }

        .football-pdf-detail {
          min-height: 13mm;
          padding: 3.8mm 4.6mm;
          background: rgba(255, 255, 255, 0.58);
        }

        .football-pdf-detail span {
          display: block;
          color: #303030;
          font-size: 3.5mm;
          line-height: 1.1;
          font-weight: 700;
          text-transform: uppercase;
        }

        .football-pdf-detail strong {
          display: block;
          margin-top: 1.4mm;
          color: #5f5f5f;
          font-size: 4.4mm;
          line-height: 1.2;
          font-weight: 400;
        }

        .football-pdf-training-dates-panel {
          width: min(210mm, 100%);
          margin: 15mm auto 0;
          padding: 9mm 11mm;
          border-color: rgba(255, 255, 255, 0.58);
          background: rgba(255, 255, 255, 0.78);
        }

        .football-pdf-training-dates-list {
          display: grid;
          gap: 2mm;
        }

        .football-pdf-training-dates-section + .football-pdf-training-dates-section {
          margin-top: 8mm;
        }

        .football-pdf-training-dates-heading {
          margin: 0 0 3mm;
          color: #303030;
          font-size: 3.6mm;
          line-height: 1.1;
          font-weight: 900;
          text-transform: uppercase;
        }

        .football-pdf-training-date-row {
          display: grid;
          grid-template-columns: 74mm 1fr;
          gap: 7mm;
          align-items: center;
          min-height: 12mm;
          padding: 2.6mm 4.8mm;
          background: rgba(255, 255, 255, 0.58);
        }

        .football-pdf-training-date-row:nth-child(even) {
          background: rgba(255, 255, 255, 0.46);
        }

        .football-pdf-training-date-row strong {
          color: #171717;
          font-size: 3.8mm;
          line-height: 1.18;
          font-weight: 700;
        }

        .football-pdf-training-date-row span {
          color: #5f5f5f;
          font-size: 3.8mm;
          line-height: 1.18;
          font-weight: 400;
        }

        .football-pdf-table {
          width: 100%;
          border-collapse: collapse;
          overflow: hidden;
          border: 0.35mm solid rgba(255, 255, 255, 0.38);
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(2px);
          box-shadow: 0 5mm 15mm rgba(0, 0, 0, 0.18);
        }

        .football-pdf-table th,
        .football-pdf-table td {
          padding: 3.3mm 3.8mm;
          border-bottom: 0.25mm solid rgba(255, 255, 255, 0.16);
          color: #ffffff;
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
          color: rgba(255, 255, 255, 0.72);
          font-weight: 300;
        }

        .football-pdf-program-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 11mm;
          height: 11mm;
          border: 0.35mm solid rgba(255, 255, 255, 0.82);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          flex: 0 0 auto;
        }

        .football-pdf-program-icon svg {
          width: 6.5mm;
          height: 6.5mm;
          stroke: currentColor;
          stroke-width: 1.8;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .football-pdf-program-list {
          display: grid;
          gap: 2.4mm;
          width: min(250mm, 100%);
        }

        .football-pdf-program-list-compact {
          gap: 1.6mm;
        }

        .football-pdf-program-list-dense {
          gap: 1.1mm;
        }

        .football-pdf-program-row {
          display: grid;
          grid-template-columns: 14mm 27mm 1fr;
          align-items: center;
          gap: 7mm;
          min-height: 12.2mm;
          padding: 2mm 5mm;
          border: 0.35mm solid rgba(255, 255, 255, 0.18);
          border-radius: 1.6mm;
          background: rgba(0, 0, 0, 0.52);
        }

        .football-pdf-program-list-compact .football-pdf-program-row {
          min-height: 10mm;
          padding: 1.4mm 5mm;
        }

        .football-pdf-program-list-dense .football-pdf-program-row {
          min-height: 8.2mm;
          padding: 1mm 5mm;
        }

        .football-pdf-program-row:nth-child(even) {
          background: rgba(0, 0, 0, 0.44);
        }

        .football-pdf-program-time {
          display: grid;
          gap: 0.6mm;
          color: #ffffff;
          line-height: 1;
        }

        .football-pdf-program-time strong {
          font-size: 4.7mm;
          font-weight: 900;
        }

        .football-pdf-program-list-compact .football-pdf-program-time strong {
          font-size: 4mm;
        }

        .football-pdf-program-list-dense .football-pdf-program-time strong {
          font-size: 3.4mm;
        }

        .football-pdf-program-time span {
          color: rgba(255, 255, 255, 0.72);
          font-size: 3.2mm;
          font-weight: 400;
        }

        .football-pdf-program-list-compact .football-pdf-program-time span,
        .football-pdf-program-list-dense .football-pdf-program-time span {
          font-size: 2.8mm;
        }

        .football-pdf-program-activity {
          align-self: center;
          color: #ffffff;
          font-size: 5.2mm;
          line-height: 1.18;
          font-weight: 700;
          overflow-wrap: anywhere;
        }

        .football-pdf-program-list-compact .football-pdf-program-activity {
          font-size: 4.4mm;
          line-height: 1.08;
        }

        .football-pdf-program-list-dense .football-pdf-program-activity {
          font-size: 3.25mm;
          line-height: 1.02;
          overflow-wrap: anywhere;
        }

        .football-pdf-staff-list {
          display: grid;
          gap: 2mm;
          width: min(250mm, 100%);
        }

        .football-pdf-staff-head,
        .football-pdf-staff-row {
          display: grid;
          grid-template-columns: 32% 25% 1fr;
          gap: 7mm;
          align-items: center;
          padding: 2.8mm 5mm;
          border-radius: 1.5mm;
        }

        .football-pdf-staff-list-no-setup-tasks .football-pdf-staff-head,
        .football-pdf-staff-list-no-setup-tasks .football-pdf-staff-row {
          grid-template-columns: 42% 1fr;
        }

        .football-pdf-staff-head {
          min-height: 10.5mm;
          background: rgba(0, 0, 0, 0.72);
          color: #ffffff;
          font-size: 3.6mm;
          font-weight: 900;
          text-transform: uppercase;
        }

        .football-pdf-staff-row {
          min-height: 12.5mm;
          border: 0.35mm solid rgba(255, 255, 255, 0.16);
          background: rgba(0, 0, 0, 0.52);
          color: rgba(255, 255, 255, 0.82);
          font-size: 4.1mm;
          line-height: 1.2;
          font-weight: 400;
        }

        .football-pdf-staff-row:nth-child(odd) {
          background: rgba(0, 0, 0, 0.44);
        }

        .football-pdf-staff-name {
          color: #ffffff;
          font-weight: 700;
        }

        .football-pdf-contingency {
          padding: 8mm 9mm;
        }

        .football-pdf-contingency-entry {
          margin: 0 0 6mm;
          color: #171717;
          font-size: 5mm;
          line-height: 1.38;
          font-weight: 400;
        }

        .football-pdf-contingency-entry:last-child {
          margin-bottom: 0;
        }

        .football-pdf-contingency-entry strong {
          display: block;
          margin-bottom: 1.4mm;
          color: #303030;
          font-size: 3.5mm;
          line-height: 1.1;
          font-weight: 900;
          text-transform: uppercase;
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
    const formatted = new Intl.DateTimeFormat("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(year, month - 1, day));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const parseDateList = (value) => {
    const dates = [];
    const seen = new Set();
    const text = String(value || "");
    const matches = [...text.matchAll(/\d{4}-\d{2}-\d{2}/g)];
    matches.forEach((match, index) => {
      const date = match[0];
      if (seen.has(date)) {
        return;
      }
      const nextStart = matches[index + 1]?.index ?? text.length;
      const description = text
        .slice((match.index ?? 0) + date.length, nextStart)
        .replace(/^[\s,;:-–—]+|[\s,;:-–—]+$/g, "")
        .trim();
      seen.add(date);
      dates.push({
        date,
        dateLabel: formatDate(date),
        description: description || "Geen training",
      });
    });
    return dates.sort((left, right) => left.date.localeCompare(right.date));
  };

  const cleanClubName = (value) => {
    const cleaned = String(value || "")
      .replace(/\|.*/g, "")
      .replace(/\bdraaiboek\b/gi, "")
      .replace(/\bvoetbaldag(?:en)?\b/gi, "")
      .replace(/\bsamenwerkende\s+amateurclubs?\b/gi, "")
      .replace(/\bhws\b/gi, "")
      .replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    return cleaned || "HWS";
  };

  const collectPlaybookData = () => {
    syncActiveFieldTraining();
    const title = getValue('input[name="title"]') || defaultPlaybookTitle;
    const eventDate = getValue('input[name="event_date"]');
    const cycleNumber = getValue('input[name="cycle_number"]');
    const cycleStartDate = getValue('input[name="cycle_start_date"]');
    const cycleEndDate = getValue('input[name="cycle_end_date"]');
    const cycleNoTrainingDatesText = getValue('textarea[name="cycle_no_training_dates"]');
    const cycleNoTrainingDates = parseDateList(cycleNoTrainingDatesText);
    const location = getValue('input[name="location"]');
    const productId = getValue('input[name="ecwid_product_id"]');
    const productName = getValue('input[name="ecwid_product_name"]');
    const productSku = getValue('input[name="ecwid_product_sku"]');
    const clubName = cleanClubName(productName || location || title);
    const currentRegistrationCount = String(registrationCount?.textContent || "0").trim();
    const includeStaff = document.querySelector('input[name="include_staff"][value="1"]')?.checked ?? true;
    const includeStaffSetupTasks = includeStaffSetupTasksInput?.checked ?? true;
    const includeProgram = document.querySelector('input[name="include_program"][value="1"]')?.checked ?? true;
    const cycleDateRangeLabel = cycleStartDate || cycleEndDate ? `${formatDate(cycleStartDate)} t/m ${formatDate(cycleEndDate)}` : "cyclus nog in te vullen";
    const cycleCoverLabel = cycleNumber ? `CYCLUS ${cycleNumber}` : "CYCLUS";

    const staff = [...document.querySelectorAll("[data-football-staff-row]")]
      .map((row) => ({
        name: String(row.querySelector('input[name="staff_name"]')?.value || "").trim(),
        role: String(row.querySelector('input[name="staff_role"]')?.value || "").trim(),
        setupTask: String(row.querySelector('[name="staff_setup_task"]')?.value || "").trim(),
      }))
      .filter((member) => member.name || member.role || member.setupTask);

    const program = [...document.querySelectorAll("[data-football-program-row]")]
      .map((row) => {
        const activity = String(row.querySelector('input[name="program_activity"]')?.value || "").trim();
        const selectedIcon = String(row.querySelector("[data-activity-icon]")?.dataset.activityIcon || "").trim();
        return {
          startTime: String(row.querySelector('input[name="program_start"]')?.value || "").trim(),
          endTime: String(row.querySelector('input[name="program_end"]')?.value || "").trim(),
          activity,
          icon: iconSvgs[selectedIcon] ? selectedIcon : inferIcon(activity),
        };
      })
      .filter((item) => item.activity || item.startTime || item.endTime);

    return {
      playbookType,
      title,
      eventDate,
      eventDateLabel: formatDate(eventDate),
      cycleNumber,
      cycleCoverLabel,
      cycleStartDate,
      cycleEndDate,
      cycleStartDateLabel: formatDate(cycleStartDate),
      cycleEndDateLabel: formatDate(cycleEndDate),
      cycleDateRangeLabel,
      cycleNoTrainingDates,
      cycleNoTrainingDatesText,
      location,
      productId,
      productName,
      productSku,
      clubName,
      coverTitle: playbookType === "samenwerkende-amateurclubs" ? title : pdfCoverTitle,
      introSubject,
      coverMeta: playbookType === "samenwerkende-amateurclubs" ? `${clubName.toUpperCase()} | ${cycleCoverLabel} | ${cycleDateRangeLabel}` : `${clubName.toUpperCase()} | ${currentRegistrationCount} AANMELDINGEN`,
      includeStaff,
      includeStaffSetupTasks,
      includeProgram,
      staff,
      program,
      fieldLayout,
      fieldTrainings,
      contingencies: getValue('textarea[name="contingencies"]'),
      registrationCount: currentRegistrationCount,
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
      header.append(makeElement("h2", "football-pdf-header-title", title));
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
    card.append(logo);
    card.append(makeElement("h1", "football-pdf-cover-title", String(data.coverTitle || "").toUpperCase()));
    card.append(makeElement("p", "football-pdf-cover-meta", data.coverMeta));
    content.append(card);
    return page;
  };

  const createIntroPage = (data, background) => {
    const { page, content } = createPage(background, "Inleiding");
    const panel = makeElement("div", "football-pdf-panel football-pdf-intro-panel");
    const isAmateurClubPlaybook = data.playbookType === "samenwerkende-amateurclubs";
    const dateText = isAmateurClubPlaybook ? `voor ${(data.cycleCoverLabel || "de cyclus").toLowerCase()}: ${data.cycleDateRangeLabel}` : `op ${data.eventDateLabel}`;
    panel.append(
      makeElement(
        "p",
        "football-pdf-copy",
        `In dit draaiboek vind je alle informatie voor de ${data.introSubject || "voetbaldag"} bij ${data.clubName} ${dateText}.`
      ),
      makeElement(
        "p",
        "football-pdf-copy",
        "Het document bevat de taakverdeling, het programma en de afspraken voor onvoorziene omstandigheden, zodat trainers en medewerkers de dag strak en overzichtelijk kunnen begeleiden."
      )
    );
    const details = makeElement("div", "football-pdf-detail-grid");
    const detailRows = isAmateurClubPlaybook ? [
      ["Club", data.clubName],
      ["Cyclus", data.cycleNumber || "Nog in te vullen"],
      ["Start cyclus", data.cycleStartDateLabel],
      ["Einde cyclus", data.cycleEndDateLabel],
    ] : [
      ["Club", data.clubName],
      ["Datum", data.eventDateLabel],
      ["Locatie", data.location || "Nog in te vullen"],
      ["Aanmeldingen", data.registrationCount || "0"],
    ];
    detailRows.forEach(([label, value]) => {
      const item = makeElement("div", "football-pdf-detail");
      item.append(makeElement("span", "", label), makeElement("strong", "", value));
      details.append(item);
    });
    panel.append(details);
    content.append(panel);
    return page;
  };

  const getSortedCycleTrainings = (trainings = []) =>
    trainings
      .filter((training) => training && typeof training === "object")
      .map((training, index) => ({ training, index }))
      .sort((left, right) => {
        const leftDate = String(left.training.date || "").trim();
        const rightDate = String(right.training.date || "").trim();
        const leftHasDate = /^\d{4}-\d{2}-\d{2}$/.test(leftDate);
        const rightHasDate = /^\d{4}-\d{2}-\d{2}$/.test(rightDate);
        if (leftHasDate && rightHasDate && leftDate !== rightDate) {
          return leftDate.localeCompare(rightDate);
        }
        if (leftHasDate !== rightHasDate) {
          return leftHasDate ? -1 : 1;
        }
        return left.index - right.index;
      })
      .map(({ training }) => training);

  const createTrainingDatesPage = (data, background) => {
    const { page, content } = createPage(background, "Trainingsdata");
    const panel = makeElement("div", "football-pdf-panel football-pdf-training-dates-panel");
    const appendTrainingDateSection = (title, rows, getName) => {
      if (!rows.length) {
        return;
      }
      const section = makeElement("div", "football-pdf-training-dates-section");
      section.append(makeElement("h3", "football-pdf-training-dates-heading", title));
      const list = makeElement("div", "football-pdf-training-dates-list");
      rows.forEach((rowData, index) => {
        const row = makeElement("div", "football-pdf-training-date-row");
        row.append(
          makeElement("strong", "", formatDate(rowData.date)),
          makeElement("span", "", getName(rowData, index))
        );
        list.append(row);
      });
      section.append(list);
      panel.append(section);
    };
    appendTrainingDateSection("Trainingen datum", getSortedCycleTrainings(data.fieldTrainings), (training, index) => training.name || `Training ${index + 1}`);
    appendTrainingDateSection("Geen training datum", data.cycleNoTrainingDates || [], (row) => row.description || "Geen training");
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
    const list = makeElement("div", "football-pdf-staff-list");
    if (!data.includeStaffSetupTasks) {
      list.classList.add("football-pdf-staff-list-no-setup-tasks");
    }
    const headRow = makeElement("div", "football-pdf-staff-head");
    const labels = data.includeStaffSetupTasks ? ["Naam", "Rol", "Taak bij uitzetten"] : ["Naam", "Rol"];
    labels.forEach((label) => headRow.append(makeElement("span", "", label)));
    list.append(headRow);
    const rows = data.staff.length ? data.staff : [{ name: "Nog in te vullen", role: "", setupTask: "" }];
    rows.forEach((member) => {
      const row = makeElement("div", "football-pdf-staff-row");
      row.append(
        makeElement("span", "football-pdf-staff-name", member.name || "-"),
        makeElement("span", "", member.role || "-")
      );
      if (data.includeStaffSetupTasks) {
        row.append(makeElement("span", "", member.setupTask || "-"));
      }
      list.append(row);
    });
    content.append(list);
    return page;
  };

  const createProgramPage = (rows, background, layoutRowCount = rows.length) => {
    const { page, content } = createPage(background, "Programma");
    const list = makeElement("div", "football-pdf-program-list");
    if (layoutRowCount > 12) {
      list.classList.add("football-pdf-program-list-dense");
    } else if (layoutRowCount > 9) {
      list.classList.add("football-pdf-program-list-compact");
    }
    rows.forEach((item) => {
      const row = makeElement("div", "football-pdf-program-row");
      const icon = makeElement("span", "football-pdf-program-icon");
      icon.innerHTML = iconSvgs[item.icon] || iconSvgs.clock;
      const time = makeElement("span", "football-pdf-program-time");
      time.append(makeElement("strong", "", item.startTime || "--:--"));
      time.append(makeElement("span", "", item.endTime || "--:--"));
      row.append(icon, time, makeElement("span", "football-pdf-program-activity", item.activity || "Nog in te vullen"));
      list.append(row);
    });
    content.append(list);
    return page;
  };

  const createProgramPages = (data, backgrounds, startIndex) => {
    const rows = data.program.length ? data.program : [{ startTime: "", endTime: "", activity: "Nog in te vullen", icon: "clock" }];
    const chunkSize = rows.length <= 14 ? 14 : 12;
    const layoutRowCount = rows.length > chunkSize ? chunkSize : rows.length;
    const pages = [];
    for (let index = 0; index < rows.length; index += chunkSize) {
      pages.push(createProgramPage(rows.slice(index, index + chunkSize), backgrounds[(startIndex + pages.length) % backgrounds.length], layoutRowCount));
    }
    return pages;
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
    const { page, content } = createPage(background, "Onvoorziene omstandigheden");
    const panel = makeElement("div", "football-pdf-panel football-pdf-contingency-panel");
    createContingencyRows(data.contingencies).forEach(([scenario, solution]) => {
      const entry = makeElement("p", "football-pdf-contingency-entry");
      if (scenario && !/^(scenario|algemeen)$/i.test(scenario)) {
        entry.append(makeElement("strong", "", scenario));
      }
      entry.append(document.createTextNode(solution || "Nog in te vullen"));
      panel.append(entry);
    });
    content.append(panel);
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
    const shouldShowTrainingDates =
      data.playbookType === "samenwerkende-amateurclubs" &&
      ((Array.isArray(data.fieldTrainings) && data.fieldTrainings.length > 1) ||
        (Array.isArray(data.cycleNoTrainingDates) && data.cycleNoTrainingDates.length > 0));
    const afterIntroPages = shouldShowTrainingDates ? [createTrainingDatesPage(data, backgrounds[2])] : [];
    const staffBackgroundIndex = shouldShowTrainingDates ? 3 : 2;
    const programBackgroundStartIndex = shouldShowTrainingDates ? 4 : 3;
    printRoot = makeElement("div", "football-pdf-export");
    printRoot.append(
      createCoverPage(data, backgrounds[0]),
      createIntroPage(data, backgrounds[1]),
      ...afterIntroPages,
      createStaffPage(data, backgrounds[staffBackgroundIndex]),
      ...createProgramPages(data, backgrounds, programBackgroundStartIndex),
      createContingenciesPage(data, backgrounds[4])
    );
    document.body.append(printRoot);
  };

  const getDownloadFilename = (response, fallbackFilename) => {
    const disposition = response.headers.get("Content-Disposition") || "";
    const filenameStar = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (filenameStar) {
      return decodeURIComponent(filenameStar[1].replace(/"/g, ""));
    }
    const filename = disposition.match(/filename="?([^";]+)"?/i);
    return filename ? filename[1] : fallbackFilename;
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportFootballDays = async (button, endpoint, fallbackFilename, formatLabel) => {
    if (!button) {
      return;
    }
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = `${formatLabel} maken...`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify(collectPlaybookData()),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `${formatLabel} exporteren mislukt.`);
      }
      downloadBlob(await response.blob(), getDownloadFilename(response, fallbackFilename));
    } catch (error) {
      window.alert(error.message || `${formatLabel} exporteren mislukt.`);
      console.error(`${formatLabel} exporteren mislukt`, error);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  };

  const exportFootballDaysPdf = () => {
    exportFootballDays(exportPdfButton, exportPdfApi, fallbackPdfFilename, "PDF");
  };

  const exportFootballDaysPptx = () => {
    exportFootballDays(exportPptxButton, exportPptxApi, fallbackPptxFilename, "PowerPoint");
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
    if (event.key === "Escape" && fieldBlockModal && !fieldBlockModal.hidden) {
      closeFieldBlockModal();
    }
    if (event.key === "Escape" && fieldArrowModal && !fieldArrowModal.hidden) {
      closeFieldArrowModal();
    }
    if (event.key === "Escape" && fieldWizardModal && !fieldWizardModal.hidden) {
      setFieldWizardOpen(false);
    }
  });

  programRows?.addEventListener("dragstart", (event) => {
    const handle = event.target.closest("[data-football-program-drag-handle]");
    const row = handle?.closest("[data-football-program-row]");
    if (!row) {
      return;
    }
    draggedProgramRow = row;
    row.classList.add("football-program-row-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", "");
  });

  programRows?.addEventListener("dragover", (event) => {
    if (!draggedProgramRow) {
      return;
    }
    event.preventDefault();
    const insertBeforeRow = getProgramDragInsertBeforeRow(programRows, event.clientY);
    programRows.querySelectorAll(".football-program-row-drop-target").forEach((row) => {
      row.classList.remove("football-program-row-drop-target");
    });
    if (insertBeforeRow) {
      insertBeforeRow.classList.add("football-program-row-drop-target");
      programRows.insertBefore(draggedProgramRow, insertBeforeRow);
    } else {
      programRows.appendChild(draggedProgramRow);
    }
  });

  programRows?.addEventListener("drop", (event) => {
    if (!draggedProgramRow) {
      return;
    }
    event.preventDefault();
    clearProgramDragState();
  });

  programRows?.addEventListener("dragend", clearProgramDragState);

  programRows?.addEventListener("keydown", (event) => {
    const handle = event.target.closest("[data-football-program-drag-handle]");
    const row = handle?.closest("[data-football-program-row]");
    if (!row || !["ArrowUp", "ArrowDown"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    moveProgramRow(row, event.key === "ArrowUp" ? -1 : 1);
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

  exportPdfButton?.addEventListener("click", exportFootballDaysPdf);
  exportPptxButton?.addEventListener("click", exportFootballDaysPptx);

  window.addEventListener("afterprint", removePrintRoot);

  if (fieldLayoutInput) {
    try {
      fieldLayout = JSON.parse(fieldLayoutInput.value || "[]").map(normalizeFieldItem);
    } catch (error) {
      fieldLayout = [];
    }
  }
  if (supportsFieldTrainings) {
    try {
      fieldTrainings = JSON.parse(fieldTrainingsInput.value || "[]").map(normalizeFieldTraining);
    } catch (error) {
      fieldTrainings = [];
    }
    if (!fieldTrainings.length) {
      fieldTrainings = [normalizeFieldTraining({ name: "Training 1", fieldLayout }, 0)];
    }
    activeFieldTrainingId = fieldTrainings[0].id;
    loadActiveFieldTraining();
  }
  if (pasteFieldBlockButton instanceof HTMLButtonElement) {
    pasteFieldBlockButton.disabled = true;
  }

  addFieldBlockButton?.addEventListener("click", addFieldBlock);
  addFieldTrainingButton?.addEventListener("click", addFieldTraining);
  duplicateFieldTrainingButton?.addEventListener("click", duplicateActiveFieldTraining);
  removeFieldTrainingButton?.addEventListener("click", removeActiveFieldTraining);
  addFieldPeriodButton?.addEventListener("click", addFieldPeriod);
  duplicateFieldPeriodButton?.addEventListener("click", duplicateActiveFieldPeriod);
  removeFieldPeriodButton?.addEventListener("click", removeActiveFieldPeriod);
  fieldTrainingNameInput?.addEventListener("input", () => {
    syncActiveFieldTraining();
    renderFieldTrainingTabs();
    syncFieldTrainingsInput();
  });
  fieldTrainingDateInput?.addEventListener("input", () => {
    syncActiveFieldTraining();
    renderFieldTrainingTabs();
    syncFieldTrainingsInput();
  });
  [fieldPeriodLabelInput, fieldPeriodStartInput, fieldPeriodEndInput].forEach((input) => {
    input?.addEventListener("input", () => {
      syncActiveFieldPeriod();
      renderFieldPeriodTabs();
      syncFieldTrainingsInput();
    });
  });
  fieldTrainingTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-field-training-id]");
    if (button && !draggedFieldTrainingId) {
      selectFieldTraining(button.dataset.fieldTrainingId || "");
    }
  });
  fieldTrainingTabs?.addEventListener("dragstart", (event) => {
    const button = event.target.closest("[data-field-training-id]");
    if (!button) {
      return;
    }
    draggedFieldTrainingId = button.dataset.fieldTrainingId || "";
    button.classList.add("football-field-training-tab-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedFieldTrainingId);
  });
  fieldTrainingTabs?.addEventListener("dragover", (event) => {
    const button = event.target.closest("[data-field-training-id]");
    if (!button || !draggedFieldTrainingId || button.dataset.fieldTrainingId === draggedFieldTrainingId) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    fieldTrainingTabs.querySelectorAll(".football-field-training-tab-drop-target").forEach((tab) => {
      tab.classList.remove("football-field-training-tab-drop-target");
    });
    button.classList.add("football-field-training-tab-drop-target");
  });
  fieldTrainingTabs?.addEventListener("dragleave", (event) => {
    const button = event.target.closest("[data-field-training-id]");
    if (button && !button.contains(event.relatedTarget)) {
      button.classList.remove("football-field-training-tab-drop-target");
    }
  });
  fieldTrainingTabs?.addEventListener("drop", (event) => {
    const button = event.target.closest("[data-field-training-id]");
    if (!button || !draggedFieldTrainingId) {
      return;
    }
    event.preventDefault();
    button.classList.remove("football-field-training-tab-drop-target");
    reorderFieldTraining(draggedFieldTrainingId, button.dataset.fieldTrainingId || "");
  });
  fieldTrainingTabs?.addEventListener("dragend", () => {
    fieldTrainingTabs.querySelectorAll(".football-field-training-tab-dragging, .football-field-training-tab-drop-target").forEach((tab) => {
      tab.classList.remove("football-field-training-tab-dragging", "football-field-training-tab-drop-target");
    });
    window.setTimeout(() => {
      draggedFieldTrainingId = "";
    }, 0);
  });
  fieldPeriodTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-field-period-id]");
    if (button) {
      selectFieldPeriod(button.dataset.fieldPeriodId || "");
    }
  });
  pasteFieldBlockButton?.addEventListener("click", pasteFieldBlock);
  addFieldArrowButton?.addEventListener("click", addFieldArrow);
  centerFieldBlocksButton?.addEventListener("click", centerFieldBlocks);
  clearFieldBlocksButton?.addEventListener("click", () => {
    if (!fieldLayout.length || !window.confirm("Alle blokken en pijlen van de veldplattegrond verwijderen?")) {
      return;
    }
    fieldLayout = [];
    renderFieldBoard();
  });

  fieldBoard?.addEventListener("pointerdown", (event) => {
    clearScheduledFieldModal();
    const target = event.target instanceof Element ? event.target : null;
    const arrowElement = target?.closest("[data-field-arrow-id]");
    if (arrowElement) {
      const arrow = getFieldArrow(arrowElement.dataset.fieldArrowId || "");
      if (!arrow) {
        return;
      }
      const boardBox = fieldBoard.getBoundingClientRect();
      const handle = target.closest("[data-field-arrow-handle]");
      fieldPointerState = {
        id: arrow.id,
        mode: handle ? `arrow-${handle.dataset.fieldArrowHandle}` : "arrow-move",
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startArrow: { ...arrow },
        boardWidth: boardBox.width || 1,
        boardHeight: boardBox.height || 1,
        moved: false,
      };
      arrowElement.classList.add("football-field-arrow-active");
      hideFieldAlignmentGuides();
      event.preventDefault();
      return;
    }
    const blockElement = target?.closest("[data-field-block-id]");
    if (!blockElement) {
      return;
    }
    const block = getFieldBlock(blockElement.dataset.fieldBlockId || "");
    if (!block) {
      return;
    }
    const boardBox = fieldBoard.getBoundingClientRect();
    const resizeHandle = target.closest("[data-field-resize]");
    fieldPointerState = {
      id: block.id,
      mode: resizeHandle ? "resize" : "move",
      corner: resizeHandle?.dataset.fieldResize || "",
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBlock: { ...block },
      boardWidth: boardBox.width || 1,
      boardHeight: boardBox.height || 1,
      moved: false,
    };
    blockElement.setPointerCapture?.(event.pointerId);
    blockElement.classList.add("football-field-block-active");
    hideFieldAlignmentGuides();
    event.preventDefault();
  });

  fieldBoard?.addEventListener("pointermove", (event) => {
    if (!fieldPointerState) {
      return;
    }
    const deltaX = ((event.clientX - fieldPointerState.startClientX) / fieldPointerState.boardWidth) * 100;
    const deltaY = ((event.clientY - fieldPointerState.startClientY) / fieldPointerState.boardHeight) * 100;
    if (Math.abs(deltaX) > 0.2 || Math.abs(deltaY) > 0.2) {
      fieldPointerState.moved = true;
    }
    if (fieldPointerState.mode.startsWith("arrow")) {
      const arrow = getFieldArrow(fieldPointerState.id);
      if (!arrow) {
        return;
      }
      const start = fieldPointerState.startArrow;
      if (fieldPointerState.mode === "arrow-move") {
        arrow.x1 = clamp(start.x1 + deltaX, 0, 100);
        arrow.y1 = clamp(start.y1 + deltaY, 0, 100);
        arrow.x2 = clamp(start.x2 + deltaX, 0, 100);
        arrow.y2 = clamp(start.y2 + deltaY, 0, 100);
      } else if (fieldPointerState.mode === "arrow-start") {
        arrow.x1 = clamp(start.x1 + deltaX, 0, 100);
        arrow.y1 = clamp(start.y1 + deltaY, 0, 100);
      } else if (fieldPointerState.mode === "arrow-end") {
        arrow.x2 = clamp(start.x2 + deltaX, 0, 100);
        arrow.y2 = clamp(start.y2 + deltaY, 0, 100);
      }
      updateFieldArrowElement(fieldBoard.querySelector(`[data-field-arrow-id="${arrow.id}"]`), arrow);
      syncFieldLayoutInput();
      return;
    }
    const block = getFieldBlock(fieldPointerState.id);
    if (!block) {
      return;
    }
    const start = fieldPointerState.startBlock;
    if (fieldPointerState.mode === "move") {
      block.x = clamp(start.x + deltaX, 0, 100 - block.width);
      block.y = clamp(start.y + deltaY, 0, 100 - block.height);
    } else {
      const corner = fieldPointerState.corner;
      let x = start.x;
      let y = start.y;
      let width = start.width;
      let height = start.height;
      if (corner.includes("e")) {
        width = clamp(start.width + deltaX, 8, 100 - start.x);
      }
      if (corner.includes("s")) {
        height = clamp(start.height + deltaY, 6, 100 - start.y);
      }
      if (corner.includes("w")) {
        const nextX = clamp(start.x + deltaX, 0, start.x + start.width - 8);
        width = start.width + start.x - nextX;
        x = nextX;
      }
      if (corner.includes("n")) {
        const nextY = clamp(start.y + deltaY, 0, start.y + start.height - 6);
        height = start.height + start.y - nextY;
        y = nextY;
      }
      block.x = x;
      block.y = y;
      block.width = width;
      block.height = height;
    }
    applyFieldAlignmentGuides(block, fieldPointerState.mode === "move");
    updateFieldBlockElement(fieldBoard.querySelector(`[data-field-block-id="${block.id}"]`), block);
    syncFieldLayoutInput();
  });

  const finishFieldPointer = (event) => {
    if (!fieldPointerState) {
      return;
    }
    const itemId = fieldPointerState.id;
    const isArrow = fieldPointerState.mode.startsWith("arrow");
    const shouldOpen = !fieldPointerState.moved && (fieldPointerState.mode === "move" || fieldPointerState.mode === "arrow-move");
    fieldBoard?.querySelectorAll(".football-field-block-active").forEach((element) => {
      element.classList.remove("football-field-block-active");
    });
    fieldBoard?.querySelectorAll(".football-field-arrow-active").forEach((element) => {
      element.classList.remove("football-field-arrow-active");
    });
    hideFieldAlignmentGuides();
    if (event?.target?.releasePointerCapture) {
      event.target.releasePointerCapture(fieldPointerState.pointerId);
    }
    fieldPointerState = null;
    syncFieldLayoutInput();
    if (shouldOpen) {
      fieldOpenModalTimer = window.setTimeout(() => {
        fieldOpenModalTimer = 0;
        if (isArrow) {
          openFieldArrowModal(itemId);
        } else {
          openFieldBlockModal(itemId);
        }
      }, 240);
    }
  };

  fieldBoard?.addEventListener("pointerup", finishFieldPointer);
  fieldBoard?.addEventListener("pointercancel", finishFieldPointer);
  fieldBoard?.addEventListener("dblclick", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const arrowElement = target?.closest("[data-field-arrow-id]");
    if (arrowElement) {
      const arrow = getFieldArrow(arrowElement.dataset.fieldArrowId || "");
      if (!arrow) {
        return;
      }
      clearScheduledFieldModal();
      fieldBoard?.querySelectorAll(".football-field-arrow-active").forEach((element) => {
        element.classList.remove("football-field-arrow-active");
      });
      fieldPointerState = null;
      createCopiedFieldArrow(arrow);
      event.preventDefault();
      return;
    }
    const blockElement = target?.closest("[data-field-block-id]");
    if (!blockElement || target?.closest("[data-field-resize]")) {
      return;
    }
    const block = getFieldBlock(blockElement.dataset.fieldBlockId || "");
    if (!block) {
      return;
    }
    clearScheduledFieldModal();
    fieldBoard?.querySelectorAll(".football-field-block-active").forEach((element) => {
      element.classList.remove("football-field-block-active");
    });
    fieldPointerState = null;
    createCopiedFieldBlock(block, { openModal: false });
    event.preventDefault();
  });

  fieldBlockModal?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-football-field-modal]")) {
      closeFieldBlockModal();
    }
  });

  fieldArrowModal?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-football-field-arrow-modal]")) {
      closeFieldArrowModal();
    }
  });

  fieldWizardModal?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-football-field-wizard]")) {
      setFieldWizardOpen(false);
    }
  });

  openFieldWizardButton?.addEventListener("click", openFieldWizard);
  fieldWizardAge?.addEventListener("change", () => {
    updateFieldWizardFeedback();
    refreshFieldWizardExerciseSelects();
  });
  fillFieldTrainingsButton?.addEventListener("click", fillFieldTrainingsFromWizard);

  fieldExerciseSearchInput?.addEventListener("input", () => {
    const exerciseInputText = String(fieldExerciseSearchInput?.value || "").trim();
    if (!exerciseInputText || normalizeSearchText(exerciseInputText) !== normalizeSearchText(selectedFieldExercise?.title || "")) {
      selectedFieldExercise = null;
    }
    if (sameExerciseExportInput && !exerciseInputText) {
      sameExerciseExportInput.checked = false;
      sameExerciseExportInput.disabled = true;
    }
    renderFieldExercises();
  });
  fieldExerciseSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    const firstOption = fieldExerciseList?.querySelector("[data-exercise-id]");
    if (!firstOption) {
      return;
    }
    event.preventDefault();
    firstOption.click();
  });

  [fieldExerciseCategoryFilter, fieldExerciseKindFilter, fieldExerciseAgeFilter, fieldExerciseDurationFilter].forEach((select) => {
    select?.addEventListener("change", renderFieldExercises);
  });

  clearFieldExerciseFiltersButton?.addEventListener("click", () => {
    if (fieldExerciseCategoryFilter) {
      fieldExerciseCategoryFilter.value = "";
    }
    if (fieldExerciseKindFilter) {
      fieldExerciseKindFilter.value = "";
    }
    if (fieldExerciseAgeFilter) {
      fieldExerciseAgeFilter.value = "";
    }
    if (fieldExerciseDurationFilter) {
      fieldExerciseDurationFilter.value = "";
    }
    renderFieldExercises();
  });

  fieldColorSwatches?.addEventListener("click", (event) => {
    const swatch = event.target.closest("[data-field-color]");
    if (!swatch || !fieldBlockColorInput) {
      return;
    }
    fieldBlockColorInput.value = normalizeBlockColor(swatch.dataset.fieldColor).toLowerCase();
  });

  fieldExerciseList?.addEventListener("click", (event) => {
    const option = event.target.closest("[data-exercise-id]");
    if (!option) {
      return;
    }
    selectedFieldExercise = {
      id: option.dataset.exerciseId || "",
      title: option.dataset.exerciseTitle || "",
      exerciseKind: option.dataset.exerciseKind || "",
      category: option.dataset.exerciseCategory || "",
      ageGroups: JSON.parse(option.dataset.exerciseAgeGroups || "[]"),
    };
    if (fieldExerciseSearchInput) {
      fieldExerciseSearchInput.value = selectedFieldExercise.title;
    }
    if (sameExerciseExportInput) {
      sameExerciseExportInput.disabled = false;
    }
    renderFieldExercises();
  });

  saveFieldBlockButton?.addEventListener("click", saveActiveFieldBlock);
  copyFieldBlockButton?.addEventListener("click", copyActiveFieldBlock);
  deleteFieldBlockButton?.addEventListener("click", () => {
    fieldLayout = fieldLayout.filter((item) => item.id !== activeFieldBlockId);
    renderFieldBoard();
    closeFieldBlockModal();
  });
  saveFieldArrowButton?.addEventListener("click", saveActiveFieldArrow);
  deleteFieldArrowButton?.addEventListener("click", () => {
    fieldLayout = fieldLayout.filter((item) => item.id !== activeFieldArrowId);
    renderFieldBoard();
    closeFieldArrowModal();
  });

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
  includeStaffSetupTasksInput?.addEventListener("change", updateStaffSetupTaskVisibility);

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
      if (section === "fieldLayout") {
        if (supportsFieldTrainings) {
          syncActiveFieldTraining();
          fieldTrainings = (playbook.fieldTrainings?.length ? playbook.fieldTrainings : [{ name: "Training 1", fieldLayout: playbook.fieldLayout || [] }]).map(normalizeFieldTraining);
          activeFieldTrainingId = fieldTrainings[0]?.id || "";
          loadActiveFieldTraining();
        } else {
          fieldLayout = (playbook.fieldLayout || []).map((item, index) => normalizeFieldItem(item, index));
          renderFieldBoard();
        }
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
  footballDaysForm?.addEventListener("submit", () => {
    syncActiveFieldTraining();
    syncFieldLayoutInput();
    syncFieldTrainingsInput();
  });
  refreshRemoveButtons(staffRows, "[data-football-staff-row]");
  refreshRemoveButtons(programRows, "[data-football-program-row]");
  updateStaffSetupTaskVisibility();
  renderFieldBoard();
})();
