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
const agendaPlanSurfaces = document.querySelectorAll("[data-agenda-plan-surface]");
const agendaLabelsRoot = document.querySelector("[data-agenda-school-region]");
const agendaSummaryCopyButtons = document.querySelectorAll("[data-agenda-summary-copy-button]");

const agendaDayPlans = {};
let activeDraggedPlan = "";

const SCHOOL_HOLIDAY_CACHE_PREFIX = "agenda-school-holidays-v3";
const PUBLIC_HOLIDAY_CACHE_PREFIX = "agenda-public-holidays-v3";
const HOLIDAY_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

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
  agendaPlanSurfaces.forEach((surface) => {
    surface.classList.toggle("agenda-plan-surface-edit-mode", isOpen);
  });
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

  document.querySelectorAll(`[data-day-plan-dropzone="${normalizedDate}"]`).forEach((dropzone) => {
    renderDayPlan(dropzone, normalizedPlan);
  });
  syncDayPlansInput();
}

function getStorageItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function setStorageItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    // Ignore storage failures so the agenda still renders without caching.
  }
}

function readCachedPayload(cacheKey) {
  const rawValue = getStorageItem(cacheKey);
  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    const cachedAt = Number(parsedValue?.cachedAt || 0);
    if (!cachedAt || Date.now() - cachedAt > HOLIDAY_CACHE_TTL_MS) {
      return null;
    }
    return parsedValue.data ?? null;
  } catch (error) {
    return null;
  }
}

function writeCachedPayload(cacheKey, data) {
  setStorageItem(
    cacheKey,
    JSON.stringify({
      cachedAt: Date.now(),
      data,
    }),
  );
}

async function fetchWithCache(url, cacheKey) {
  const cachedPayload = readCachedPayload(cacheKey);
  if (cachedPayload) {
    return cachedPayload;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const payload = await response.json();
  writeCachedPayload(cacheKey, payload);
  return payload;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function copyTextWithFallback(value) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.top = "-1000px";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  textArea.remove();
  return Promise.resolve();
}

function setSummaryCopyState(button, stateText) {
  const defaultLabel = button.dataset.defaultAriaLabel || button.getAttribute("aria-label") || "";
  if (!button.dataset.defaultAriaLabel) {
    button.dataset.defaultAriaLabel = defaultLabel;
  }
  button.setAttribute("aria-label", stateText || defaultLabel);
  if (!stateText) {
    return;
  }
  window.setTimeout(() => {
    button.setAttribute("aria-label", button.dataset.defaultAriaLabel || defaultLabel);
  }, 1600);
}

async function copyAgendaSummaryDays(button) {
  const card = button.closest("[data-agenda-summary-card]");
  const copyText = card?.dataset.agendaSummaryCopy || "";
  const summaryLabel = card?.dataset.agendaSummaryLabel || "deze tegel";
  if (!copyText.trim()) {
    return;
  }

  try {
    await copyTextWithFallback(copyText);
    setSummaryCopyState(button, `Dagen voor ${summaryLabel} gekopieerd`);
  } catch (error) {
    console.error("Dagen konden niet worden gekopieerd.", error);
    setSummaryCopyState(button, "Kopieren mislukt");
  }
}

function normalizeRegion(value) {
  return normalizeText(value).toLowerCase();
}

function formatSchoolHolidayLabel(label, region) {
  const normalizedLabel = normalizeText(label);
  const normalizedRegion = normalizeRegion(region);
  if (!normalizedLabel) {
    return "";
  }
  if (!normalizedRegion) {
    return normalizedLabel;
  }
  if (normalizedRegion === "heel nederland") {
    return `${normalizedLabel} (heel Nederland)`;
  }
  return `${normalizedLabel} (${normalizedRegion})`;
}

function getSchoolHolidayRegionOrder(region) {
  const normalizedRegion = normalizeRegion(region);
  if (normalizedRegion === "noord") {
    return 1;
  }
  if (normalizedRegion === "midden") {
    return 2;
  }
  if (normalizedRegion === "zuid") {
    return 3;
  }
  return 99;
}

function buildSchoolHolidayLabels(items) {
  const groupedItems = new Map();

  items.forEach((item) => {
    const dateKey = extractIsoDate(item?.date);
    const baseLabel = normalizeText(item?.label);
    const regionName = normalizeRegion(item?.region);
    if (!dateKey || !baseLabel || !regionName) {
      return;
    }

    const groupKey = `${dateKey}|${baseLabel}`;
    if (!groupedItems.has(groupKey)) {
      groupedItems.set(groupKey, {
        date: dateKey,
        baseLabel,
        regions: new Set(),
        schoolyear: normalizeText(item?.schoolyear),
      });
    }

    groupedItems.get(groupKey).regions.add(regionName);
  });

  return Array.from(groupedItems.values()).map((group) => {
    const regionNames = Array.from(group.regions);
    const hasNationwide =
      regionNames.includes("heel nederland") ||
      ["noord", "midden", "zuid"].every((regionName) => group.regions.has(regionName));
    const formattedLabel = hasNationwide
      ? formatSchoolHolidayLabel(group.baseLabel, "heel nederland")
      : `${group.baseLabel} (${regionNames.sort((left, right) => getSchoolHolidayRegionOrder(left) - getSchoolHolidayRegionOrder(right)).join(", ")})`;

    return {
      date: group.date,
      label: formattedLabel,
      schoolyear: group.schoolyear,
      region: hasNationwide ? "heel nederland" : regionNames.join(","),
    };
  });
}

function extractIsoDate(value) {
  const normalizedValue = normalizeText(value);
  return normalizedValue ? normalizedValue.slice(0, 10) : "";
}

function getVisibleAgendaDays() {
  return Array.from(document.querySelectorAll("[data-agenda-day]"))
    .map((node) => node.getAttribute("data-agenda-day") || "")
    .filter(Boolean);
}

function toUtcDate(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1));
}

function formatUtcDate(dateValue) {
  const year = dateValue.getUTCFullYear();
  const month = `${dateValue.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${dateValue.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function expandDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    return [];
  }

  const result = [];
  const cursor = toUtcDate(startDate);
  const finalDate = toUtcDate(endDate);

  while (cursor <= finalDate) {
    result.push(formatUtcDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

function getCalendarYears(dayKeys) {
  const currentYear = new Date().getFullYear();
  const years = new Set([currentYear, currentYear + 1]);

  dayKeys.forEach((dayKey) => {
    const year = Number((dayKey || "").slice(0, 4));
    if (Number.isFinite(year) && year > 0) {
      years.add(year);
    }
  });

  return Array.from(years).sort((left, right) => left - right);
}

function getRequiredSchoolYears(years) {
  const schoolYears = new Set();

  years.forEach((year) => {
    if (!Number.isFinite(year)) {
      return;
    }
    schoolYears.add(`${year - 1}-${year}`);
    schoolYears.add(`${year}-${year + 1}`);
  });

  return Array.from(schoolYears).sort();
}

async function fetchSchoolHolidays(schoolYears, region = "all") {
  const normalizedRegion = normalizeRegion(region) || "all";
  const cacheKey = `${SCHOOL_HOLIDAY_CACHE_PREFIX}:${schoolYears.join(",")}:${normalizedRegion}`;
  const schoolYearsParam = encodeURIComponent(schoolYears.join(","));
  const regionParam = encodeURIComponent(normalizedRegion);
  const payload = await fetchWithCache(
    `/api/agenda-school-holidays?schoolYears=${schoolYearsParam}&region=${regionParam}`,
    cacheKey,
  );
  if (payload?.error) {
    throw new Error(payload.error);
  }
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return buildSchoolHolidayLabels(items);
}

async function fetchPublicHolidays(years) {
  const cacheKey = `${PUBLIC_HOLIDAY_CACHE_PREFIX}:${years.join(",")}:NL`;
  const yearsParam = encodeURIComponent(years.join(","));
  const payload = await fetchWithCache(`/api/agenda-public-holidays?years=${yearsParam}`, cacheKey);
  if (payload?.error) {
    throw new Error(payload.error);
  }
  const holidays = [];
  const seenItems = new Set();
  const items = Array.isArray(payload?.items) ? payload.items : [];
  items.forEach((item) => {
    const dateKey = extractIsoDate(item?.date);
    const label = normalizeText(item?.localName) || normalizeText(item?.name) || normalizeText(item?.label);
    const dedupeKey = `${dateKey}|${label}`;
    if (!dateKey || !label || seenItems.has(dedupeKey)) {
      return;
    }

    seenItems.add(dedupeKey);
    holidays.push({
      date: dateKey,
      localName: normalizeText(item?.localName),
      name: normalizeText(item?.name),
      label,
    });
  });

  return holidays;
}

function mapToCalendarDays(dayKeys, schoolHolidays, publicHolidays) {
  const dayMap = Object.fromEntries(dayKeys.map((dayKey) => [dayKey, []]));
  const perDaySeenLabels = Object.fromEntries(dayKeys.map((dayKey) => [dayKey, new Set()]));

  schoolHolidays.forEach((holiday) => {
    if (!dayMap[holiday.date]) {
      return;
    }
    if (perDaySeenLabels[holiday.date].has(holiday.label)) {
      return;
    }
    perDaySeenLabels[holiday.date].add(holiday.label);
    dayMap[holiday.date].push(holiday.label);
  });

  publicHolidays.forEach((holiday) => {
    if (!dayMap[holiday.date]) {
      return;
    }
    if (perDaySeenLabels[holiday.date].has(holiday.label)) {
      return;
    }
    perDaySeenLabels[holiday.date].add(holiday.label);
    dayMap[holiday.date].push(holiday.label);
  });

  return dayMap;
}

function renderCalendarDay(dayKey, labels) {
  const container = document.querySelector(`[data-agenda-day-labels="${dayKey}"]`);
  if (!container) {
    return;
  }

  container.replaceChildren();

  if (!Array.isArray(labels) || labels.length === 0) {
    container.hidden = true;
    return;
  }

  labels.forEach((label) => {
    const labelNode = document.createElement("p");
    labelNode.className = "agenda-day-external-label";
    labelNode.textContent = label;
    container.appendChild(labelNode);
  });

  container.hidden = false;
}

function getRenderedCalendarDayLabels(dayKeys) {
  return Object.fromEntries(
    dayKeys.map((dayKey) => {
      const container = document.querySelector(`[data-agenda-day-labels="${dayKey}"]`);
      if (!container) {
        return [dayKey, []];
      }

      const labels = Array.from(container.querySelectorAll(".agenda-day-external-label"))
        .map((node) => normalizeText(node.textContent))
        .filter(Boolean);
      return [dayKey, labels];
    }),
  );
}

function mergeCalendarLabels(primaryLabelsByDay, fallbackLabelsByDay) {
  const mergedLabelsByDay = {};
  const dayKeys = new Set([
    ...Object.keys(primaryLabelsByDay || {}),
    ...Object.keys(fallbackLabelsByDay || {}),
  ]);

  dayKeys.forEach((dayKey) => {
    const mergedLabels = [];
    const seenLabels = new Set();

    [fallbackLabelsByDay?.[dayKey] || [], primaryLabelsByDay?.[dayKey] || []].forEach((labels) => {
      labels.forEach((label) => {
        const normalizedLabel = normalizeText(label);
        if (!normalizedLabel || seenLabels.has(normalizedLabel)) {
          return;
        }
        seenLabels.add(normalizedLabel);
        mergedLabels.push(normalizedLabel);
      });
    });

    mergedLabelsByDay[dayKey] = mergedLabels;
  });

  return mergedLabelsByDay;
}

async function loadAgendaExternalLabels() {
  if (!agendaLabelsRoot) {
    return;
  }

  const dayKeys = getVisibleAgendaDays();
  if (dayKeys.length === 0) {
    return;
  }

  const years = getCalendarYears(dayKeys);
  const schoolYears = getRequiredSchoolYears(years);
  const schoolRegion = normalizeRegion(agendaLabelsRoot.dataset.agendaSchoolRegion) || "all";
  const renderedLabelsByDay = getRenderedCalendarDayLabels(dayKeys);

  const [schoolHolidayResult, publicHolidayResult] = await Promise.allSettled([
    fetchSchoolHolidays(schoolYears, schoolRegion),
    fetchPublicHolidays(years),
  ]);
  const schoolHolidays = schoolHolidayResult.status === "fulfilled" ? schoolHolidayResult.value : [];
  const publicHolidays = publicHolidayResult.status === "fulfilled" ? publicHolidayResult.value : [];

  if (schoolHolidayResult.status !== "fulfilled") {
    console.error("Schoolvakanties konden niet worden geladen.", schoolHolidayResult.reason);
  }
  if (publicHolidayResult.status !== "fulfilled") {
    console.error("Feestdagen konden niet worden geladen.", publicHolidayResult.reason);
  }

  if (schoolHolidayResult.status !== "fulfilled" && publicHolidayResult.status !== "fulfilled") {
    return;
  }

  const labelsByDay = mergeCalendarLabels(
    mapToCalendarDays(dayKeys, schoolHolidays, publicHolidays),
    renderedLabelsByDay,
  );
  dayKeys.forEach((dayKey) => {
    renderCalendarDay(dayKey, labelsByDay[dayKey] || []);
  });
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

agendaSummaryCopyButtons.forEach((button) => {
  const card = button.closest("[data-agenda-summary-card]");
  const summaryLabel = card?.dataset.agendaSummaryLabel || "deze tegel";
  button.setAttribute("aria-label", `Kopieer dagen voor ${summaryLabel}`);
  button.setAttribute("title", `Kopieer dagen voor ${summaryLabel}`);
  button.addEventListener("click", () => copyAgendaSummaryDays(button));
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

loadAgendaExternalLabels().catch((error) => {
  console.error("Externe agenda-labels konden niet worden geladen.", error);
});
