const exerciseDataNode = document.querySelector("#exerciseData");
const exerciseImportPreviewDataNode = document.querySelector("#exerciseImportPreviewData");
const exerciseModal = document.querySelector("#exerciseModal");
const closeExerciseModal = document.querySelector("#closeExerciseModal");
const exerciseField = document.querySelector("#exerciseField");
const exerciseMediaToggle = document.querySelector("#exerciseMediaToggle");
const exerciseVideoPanel = document.querySelector("#exerciseVideoPanel");
const exerciseFieldPanel = document.querySelector(".exercise-field-panel");
const exerciseCategorySelect = document.querySelector("#exerciseCategorySelect");
const exerciseHeadingCategoryField = document.querySelector("#exerciseHeadingCategoryField");
const saveExerciseCategory = document.querySelector("#saveExerciseCategory");
const exerciseFieldImageInput = document.querySelector("#exerciseFieldImageInput");
const editExerciseField = document.querySelector("#editExerciseField");
const exerciseFieldEditActions = document.querySelector("#exerciseFieldEditActions");
const exerciseFieldOverlayEditor = document.querySelector("#exerciseFieldOverlayEditor");
const exerciseFieldOverlayColor = document.querySelector("#exerciseFieldOverlayColor");
const exerciseFieldOverlaySize = document.querySelector("#exerciseFieldOverlaySize");
const saveExerciseFieldOverlay = document.querySelector("#saveExerciseFieldOverlay");
const cancelExerciseFieldOverlay = document.querySelector("#cancelExerciseFieldOverlay");
const deleteExerciseFieldItem = document.querySelector("#deleteExerciseFieldItem");
const clearExerciseFieldItems = document.querySelector("#clearExerciseFieldItems");
const editExercise = document.querySelector("#editExercise");
const exerciseAdminEditActions = document.querySelector("#exerciseAdminEditActions");
const deleteExercise = document.querySelector("#deleteExercise");
const exerciseEditForm = document.querySelector("#exerciseEditForm");
const cancelExerciseEdit = document.querySelector("#cancelExerciseEdit");
const saveExerciseEdit = document.querySelector("#saveExerciseEdit");
const exerciseDetailLayout = document.querySelector("#exerciseDetailLayout");
const exerciseFilterEmpty = document.querySelector("#exerciseFilterEmpty");
const exerciseSearchInput = document.querySelector("#exerciseSearchInput");
const exerciseAgeFieldset = document.querySelector("#exerciseAgeFieldset");
const exerciseAgeInputs = Array.from(document.querySelectorAll("[data-exercise-age-input]"));
const previousExercise = document.querySelector("#previousExercise");
const nextExercise = document.querySelector("#nextExercise");
const exerciseNavPosition = document.querySelector("#exerciseNavPosition");
const exerciseById = new Map();
let activeExercise = null;
let activeFilter = "all";
let activeSearch = "";
let activeMedia = "field";
let activeInlineEdit = false;
let activeFieldOverlayEditing = false;
let activeFieldTool = "select";
let selectedFieldItemId = null;
let fieldDragState = null;
const canEditExercises = exerciseModal?.dataset.canEdit === "true";
const DEFAULT_FIELD_VIEWBOX = [0, 0, 100, 70];
const FIELD_TOOL_DEFAULTS = {
  select: { color: "#111111", size: 100 },
  "field-image": { color: "#111111", size: 100 },
  player: { color: "#1F5EFF", size: 100 },
  "big-cone": { color: "#FF6B00", size: 125 },
  "small-cone": { color: "#FFD400", size: 85 },
  goal: { color: "#FFFFFF", size: 120 },
  ball: { color: "#FFFFFF", size: 85 },
  line: { color: "#111111", size: 100 },
  arrow: { color: "#111111", size: 100 },
  text: { color: "#111111", size: 100 },
};

function parseExerciseData() {
  if (!exerciseDataNode) {
    return [];
  }
  try {
    const exercises = JSON.parse(exerciseDataNode.textContent || "[]");
    return Array.isArray(exercises) ? exercises : [];
  } catch (error) {
    console.error("Oefeningen konden niet worden gelezen.", error);
    return [];
  }
}

function parseImportPreviewData() {
  if (!exerciseImportPreviewDataNode) {
    return [];
  }
  try {
    const exercises = JSON.parse(exerciseImportPreviewDataNode.textContent || "[]");
    return Array.isArray(exercises) ? exercises : [];
  } catch (error) {
    console.error("Importvoorbeeld kon niet worden gelezen.", error);
    return [];
  }
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) {
    node.textContent = String(value || "").trim() || "-";
  }
}

function appendFormattedText(parent, text) {
  const value = String(text || "");
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match = pattern.exec(value);
  while (match) {
    if (match.index > lastIndex) {
      parent.append(document.createTextNode(value.slice(lastIndex, match.index)));
    }
    const node = document.createElement(match[2] ? "strong" : "em");
    node.textContent = match[2] || match[3] || "";
    parent.append(node);
    lastIndex = match.index + match[0].length;
    match = pattern.exec(value);
  }
  if (lastIndex < value.length) {
    parent.append(document.createTextNode(value.slice(lastIndex)));
  }
}

function setRichText(selector, value) {
  const node = document.querySelector(selector);
  if (!node) {
    return;
  }
  const text = String(value || "").trim();
  node.replaceChildren();
  if (!text) {
    node.textContent = "-";
    return;
  }

  const lines = text.split("\n");
  let list = null;
  let listType = "";
  lines.forEach((line) => {
    const bulletMatch = line.match(/^\s*(?:[•*-])\s+(.+)$/);
    const numberMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (bulletMatch || numberMatch) {
      const nextListType = bulletMatch ? "ul" : "ol";
      if (!list || listType !== nextListType) {
        list = document.createElement(nextListType);
        listType = nextListType;
        node.append(list);
      }
      const item = document.createElement("li");
      appendFormattedText(item, bulletMatch ? bulletMatch[1] : numberMatch[1]);
      list.append(item);
      return;
    }

    list = null;
    listType = "";
    const paragraph = document.createElement("span");
    paragraph.className = "exercise-rich-line";
    appendFormattedText(paragraph, line || " ");
    node.append(paragraph);
  });
}

function setValue(selector, value) {
  const node = document.querySelector(selector);
  if (node) {
    node.value = String(value || "").trim();
  }
}

function resizeExerciseTextarea(textarea) {
  if (!textarea) {
    return;
  }
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function getTextareaLineRange(textarea) {
  const value = textarea.value || "";
  const selectionStart = textarea.selectionStart ?? 0;
  const selectionEnd = textarea.selectionEnd ?? value.length;
  const hasSelection = selectionEnd > selectionStart;
  const blockStart = hasSelection ? value.lastIndexOf("\n", selectionStart - 1) + 1 : value.lastIndexOf("\n", selectionStart - 1) + 1;
  const nextBreak = hasSelection ? value.indexOf("\n", selectionEnd) : value.indexOf("\n", selectionEnd);
  const blockEnd = nextBreak === -1 ? value.length : nextBreak;
  return { value, blockStart, blockEnd };
}

function toggleTextareaList(textarea, mode) {
  if (!textarea) {
    return;
  }
  const { value, blockStart, blockEnd } = getTextareaLineRange(textarea);
  const before = value.slice(0, blockStart);
  const block = value.slice(blockStart, blockEnd);
  const after = value.slice(blockEnd);
  const lines = block.split("\n");
  const textLines = lines.filter((line) => line.trim());
  const listPattern = mode === "number" ? /^\s*\d+[.)]\s+/ : /^\s*(?:[•*-])\s+/;
  const shouldRemove = textLines.length > 0 && textLines.every((line) => listPattern.test(line));
  let numberedIndex = 1;
  const nextLines = lines.map((line) => {
    if (!line.trim()) {
      return line;
    }
    if (shouldRemove) {
      return mode === "number" ? line.replace(/^(\s*)\d+[.)]\s+/, "$1") : line.replace(/^(\s*)(?:[•*-])\s+/, "$1");
    }
    if (listPattern.test(line)) {
      return line;
    }
    if (mode === "number") {
      return line.replace(/^(\s*)/, `$1${numberedIndex++}. `);
    }
    return line.replace(/^(\s*)/, "$1• ");
  });
  const nextBlock = nextLines.join("\n");
  textarea.value = `${before}${nextBlock}${after}`;
  resizeExerciseTextarea(textarea);
  textarea.focus();
  textarea.setSelectionRange(blockStart, blockStart + nextBlock.length);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function wrapTextareaSelection(textarea, marker) {
  if (!textarea) {
    return;
  }
  const value = textarea.value || "";
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? start;
  const selected = value.slice(start, end);
  const fallback = marker === "**" ? "vetgedrukte tekst" : "schuine tekst";
  const nextText = selected || fallback;
  textarea.value = `${value.slice(0, start)}${marker}${nextText}${marker}${value.slice(end)}`;
  resizeExerciseTextarea(textarea);
  textarea.focus();
  textarea.setSelectionRange(start + marker.length, start + marker.length + nextText.length);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function enhanceExerciseTextControls(root = document) {
  root.querySelectorAll(".exercise-import-preview-grid textarea, .exercise-edit-form textarea, .exercise-inline-edit-field textarea").forEach((textarea) => {
    const field = textarea.closest(".field");
    const label = field?.querySelector(":scope > span");
    if (!field || !label || field.querySelector(".exercise-format-toolbar")) {
      return;
    }
    resizeExerciseTextarea(textarea);
    textarea.addEventListener("input", () => resizeExerciseTextarea(textarea));
    const labelRow = document.createElement("div");
    labelRow.className = "exercise-textarea-tools";
    field.insertBefore(labelRow, label);
    labelRow.appendChild(label);

    const toolbar = document.createElement("div");
    toolbar.className = "exercise-format-toolbar";
    [
      ["B", "Vetgedrukt", () => wrapTextareaSelection(textarea, "**")],
      ["I", "Schuingedrukt", () => wrapTextareaSelection(textarea, "*")],
      ["•", "Puntjes", () => toggleTextareaList(textarea, "bullet")],
      ["1.", "Nummering", () => toggleTextareaList(textarea, "number")],
    ].forEach(([text, labelText, handler]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "exercise-format-button";
      button.textContent = text;
      button.title = labelText;
      button.setAttribute("aria-label", `${labelText} bij ${label.textContent || "tekstveld"}`);
      button.addEventListener("click", handler);
      toolbar.appendChild(button);
    });
    labelRow.appendChild(toolbar);
  });
}

function getInlineEditNode(key) {
  return document.querySelector(`[data-exercise-inline-edit][data-exercise-key="${key}"]`);
}

function getInlineEditValue(key) {
  const input = document.querySelector(`[data-exercise-inline-input="${key}"]`);
  if (input) {
    return input.value || "";
  }
  const node = getInlineEditNode(key);
  return node?.textContent || "";
}

function getActiveExerciseCategoryValue() {
  const selectedCategory = String(exerciseCategorySelect?.value || "").trim();
  return selectedCategory || String(activeExercise?.category || "").trim();
}

function removeInlineEditFields() {
  document.querySelectorAll(".exercise-inline-edit-field").forEach((node) => node.remove());
  document.querySelectorAll("[data-exercise-inline-edit]").forEach((node) => {
    node.hidden = false;
    node.classList.remove("exercise-inline-edit-active");
  });
}

function createInlineEditField(node, key, value) {
  const isTitle = key === "title";
  const wrapper = document.createElement("label");
  wrapper.className = "field exercise-inline-edit-field";
  const label = document.createElement("span");
  label.textContent = isTitle ? "Titel" : node.closest(".exercise-detail-panel")?.querySelector("h3")?.textContent || "Tekst";
  wrapper.append(label);

  const input = isTitle ? document.createElement("input") : document.createElement("textarea");
  input.dataset.exerciseInlineInput = key;
  input.value = String(value || "").trim();
  if (isTitle) {
    input.type = "text";
    input.required = true;
  }
  wrapper.append(input);
  node.hidden = true;
  node.classList.add("exercise-inline-edit-active");
  node.after(wrapper);
  enhanceExerciseTextControls(wrapper);
}

function startInlineExerciseEdit() {
  if (!activeExercise) {
    return;
  }
  removeInlineEditFields();
  document.querySelectorAll("[data-exercise-inline-edit]").forEach((node) => {
    const key = node.dataset.exerciseKey || "";
    if (!key) {
      return;
    }
    createInlineEditField(node, key, activeExercise[key]);
  });
  const firstInput = document.querySelector("[data-exercise-inline-input]");
  firstInput?.focus();
  firstInput?.select?.();
}

function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
}

function getExerciseTile(exerciseId) {
  return document.querySelector(`[data-exercise-id="${exerciseId}"]`);
}

function normalizeFilterValue(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function buildExerciseSearchText(exercise) {
  return normalizeFilterValue([
    exercise?.title,
    exercise?.category,
    normalizeExerciseAgeGroups(exercise?.ageGroups).join(" "),
    exercise?.trainingExercise,
    exercise?.description,
    exercise?.coaching,
    exercise?.variationEasier,
    exercise?.variationHarder,
    exercise?.dimensions,
    exercise?.materials,
  ].join(" "));
}

function normalizeExerciseAgeGroups(ageGroups) {
  if (!Array.isArray(ageGroups)) {
    return [];
  }
  const allowed = new Set(["O8", "O9", "O10", "O11", "O12", "O13", "O14", "O15"]);
  return ageGroups
    .map((age) => String(age || "").trim().toUpperCase().replace(/^JO/, "O"))
    .filter((age, index, items) => allowed.has(age) && items.indexOf(age) === index);
}

function renderAgeBadges(container, ageGroups) {
  if (!container) {
    return;
  }
  const normalized = normalizeExerciseAgeGroups(ageGroups);
  container.replaceChildren();
  if (!normalized.length) {
    container.hidden = true;
    return;
  }
  normalized.forEach((age) => {
    const badge = document.createElement("span");
    badge.className = "exercise-age-badge";
    badge.textContent = age;
    container.append(badge);
  });
  container.hidden = false;
}

function setAgeInputs(ageGroups) {
  const selected = new Set(normalizeExerciseAgeGroups(ageGroups));
  exerciseAgeInputs.forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function getSelectedAgeGroups() {
  return normalizeExerciseAgeGroups(exerciseAgeInputs.filter((input) => input.checked).map((input) => input.value));
}

function getExerciseSearchText(tile) {
  const exercise = exerciseById.get(String(tile.dataset.exerciseId || ""));
  return tile.dataset.exerciseSearch || buildExerciseSearchText(exercise || {});
}

function getExerciseTileTitle(tile) {
  const exercise = exerciseById.get(String(tile.dataset.exerciseId || ""));
  return String(exercise?.title || tile.querySelector(".exercise-tile-title")?.textContent || "").trim();
}

function getExerciseTitleSortGroup(title) {
  return /^[a-zÀ-ÖØ-öø-ÿ]/i.test(title) ? 0 : 1;
}

function sortExerciseTilesByTitle() {
  const grid = document.querySelector("#exerciseTileGrid");
  if (!grid) {
    return;
  }
  Array.from(grid.querySelectorAll(".exercise-tile"))
    .sort((left, right) => {
      const leftTitle = getExerciseTileTitle(left);
      const rightTitle = getExerciseTileTitle(right);
      const groupCompare = getExerciseTitleSortGroup(leftTitle) - getExerciseTitleSortGroup(rightTitle);
      if (groupCompare !== 0) {
        return groupCompare;
      }
      const titleCompare = leftTitle.localeCompare(rightTitle, "nl", {
        numeric: true,
        sensitivity: "base",
      });
      if (titleCompare !== 0) {
        return titleCompare;
      }
      return Number(left.dataset.exerciseId || 0) - Number(right.dataset.exerciseId || 0);
    })
    .forEach((tile) => grid.append(tile));
}

function applyExerciseFilter(category = activeFilter) {
  activeFilter = category || "all";
  const normalizedActiveFilter = normalizeFilterValue(activeFilter);
  activeSearch = normalizeFilterValue(exerciseSearchInput?.value || "");
  let visibleCount = 0;

  document.querySelectorAll("[data-exercise-filter]").forEach((button) => {
    button.classList.toggle("exercise-filter-button-active", button.dataset.exerciseFilter === activeFilter);
    button.setAttribute("aria-pressed", button.dataset.exerciseFilter === activeFilter ? "true" : "false");
  });

  document.querySelectorAll("#exerciseTileGrid .exercise-tile").forEach((tile) => {
    const matchesCategory = activeFilter === "all" || normalizeFilterValue(tile.dataset.exerciseCategory) === normalizedActiveFilter;
    const matchesSearch = !activeSearch || getExerciseSearchText(tile).includes(activeSearch);
    const matches = matchesCategory && matchesSearch;
    tile.hidden = !matches;
    tile.classList.toggle("exercise-tile-hidden", !matches);
    if (matches) {
      visibleCount += 1;
    }
  });

  if (exerciseFilterEmpty) {
    exerciseFilterEmpty.textContent = activeSearch ? "Geen oefeningen gevonden voor deze zoekopdracht." : "Geen oefeningen in deze categorie.";
    exerciseFilterEmpty.hidden = visibleCount > 0;
  }
  updateExerciseNavigation();
}

function getVisibleExerciseIds() {
  const visibleIds = Array.from(document.querySelectorAll("#exerciseTileGrid .exercise-tile"))
    .filter((tile) => !tile.hidden && !tile.classList.contains("exercise-tile-hidden"))
    .map((tile) => String(tile.dataset.exerciseId || ""))
    .filter(Boolean);
  if (visibleIds.length || activeSearch || activeFilter !== "all") {
    return visibleIds;
  }
  return Array.from(document.querySelectorAll("#exerciseTileGrid .exercise-tile"))
    .map((tile) => String(tile.dataset.exerciseId || ""))
    .filter(Boolean);
}

function updateExerciseNavigation() {
  if (!activeExercise || !previousExercise || !nextExercise) {
    return;
  }
  const visibleIds = getVisibleExerciseIds();
  const activeIndex = visibleIds.indexOf(String(activeExercise.id));
  const hasPrevious = activeIndex > 0;
  const hasNext = activeIndex >= 0 && activeIndex < visibleIds.length - 1;
  previousExercise.disabled = !hasPrevious;
  nextExercise.disabled = !hasNext;
  if (exerciseNavPosition) {
    exerciseNavPosition.textContent = activeIndex >= 0 ? `${activeIndex + 1} van ${visibleIds.length}` : "";
  }
}

function navigateExercise(direction) {
  if (!activeExercise) {
    return;
  }
  const visibleIds = getVisibleExerciseIds();
  const activeIndex = visibleIds.indexOf(String(activeExercise.id));
  const nextIndex = activeIndex + direction;
  if (activeIndex < 0 || nextIndex < 0 || nextIndex >= visibleIds.length) {
    updateExerciseNavigation();
    return;
  }
  openExercise(exerciseById.get(visibleIds[nextIndex]));
}

function syncExerciseCategory(exercise, category) {
  exercise.category = category;
  const tile = getExerciseTile(exercise.id);
  if (tile) {
    tile.dataset.exerciseCategory = category;
    const categoryNode = tile.querySelector(".exercise-tile-category");
    if (categoryNode) {
      categoryNode.textContent = category || "Geen categorie";
    }
  }
  setText("#exerciseModalCategory", category || "Geen categorie");
  applyExerciseFilter(activeFilter);
}

function syncExerciseTile(exercise) {
  const tile = getExerciseTile(exercise.id);
  if (!tile) {
    return;
  }
  tile.dataset.exerciseCategory = exercise.category || "";
  const categoryNode = tile.querySelector(".exercise-tile-category");
  const titleNode = tile.querySelector(".exercise-tile-title");
  if (categoryNode) {
    categoryNode.textContent = exercise.category || "Geen categorie";
  }
  if (titleNode) {
    titleNode.textContent = exercise.title || "Oefening";
  }
  renderAgeBadges(tile.querySelector(`[data-exercise-tile-ages="${exercise.id}"]`), exercise.ageGroups);
  tile.dataset.exerciseSearch = buildExerciseSearchText(exercise);
  renderTilePreview(exercise);
  sortExerciseTilesByTitle();
  applyExerciseFilter(activeFilter);
}

function createSvgNode(tagName, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    node.setAttribute(key, String(value));
  });
  return node;
}

function getFieldOverlayItems(field) {
  return Array.isArray(field?.overlayItems) ? field.overlayItems : [];
}

function getFieldImageLayer(field) {
  const imageDataUrl = String(field?.imageDataUrl || "").trim();
  if (!imageDataUrl.startsWith("data:image/")) {
    return null;
  }
  const layer = field?.imageLayer && typeof field.imageLayer === "object" ? field.imageLayer : {};
  return {
    id: "__field-image-layer",
    type: "field-image",
    x: Number.isFinite(Number(layer.x)) ? Number(layer.x) : 50,
    y: Number.isFinite(Number(layer.y)) ? Number(layer.y) : 50,
    size: Number.isFinite(Number(layer.size)) ? Number(layer.size) : 100,
    src: imageDataUrl,
  };
}

function setFieldImageLayer(field, layer) {
  if (!field || !layer) {
    return;
  }
  field.imageLayer = {
    x: Math.max(0, Math.min(100, Number(layer.x) || 50)),
    y: Math.max(0, Math.min(100, Number(layer.y) || 50)),
    size: Math.max(25, Math.min(180, Number(layer.size) || 100)),
  };
}

function normalizeFieldToolType(type) {
  return type === "cone" ? "small-cone" : String(type || "select");
}

function getOverlayItemSize(item) {
  const numeric = Number(item?.size);
  if (Number.isFinite(numeric)) {
    return Math.max(45, Math.min(220, numeric));
  }
  const defaults = FIELD_TOOL_DEFAULTS[normalizeFieldToolType(item?.type)] || FIELD_TOOL_DEFAULTS.player;
  return defaults.size;
}

function getSelectedFieldItem() {
  if (!activeExercise?.field || !selectedFieldItemId) {
    return null;
  }
  if (selectedFieldItemId === "__field-image-layer") {
    return getFieldImageLayer(activeExercise.field);
  }
  return getFieldOverlayItems(activeExercise.field).find((item) => item.id === selectedFieldItemId) || null;
}

function syncFieldOverlayControls() {
  const selected = getSelectedFieldItem();
  const defaults = FIELD_TOOL_DEFAULTS[normalizeFieldToolType(activeFieldTool)] || FIELD_TOOL_DEFAULTS.player;
  if (exerciseFieldOverlayColor) {
    exerciseFieldOverlayColor.value = selected?.color || defaults.color;
  }
  if (exerciseFieldOverlaySize) {
    exerciseFieldOverlaySize.value = String(getOverlayItemSize(selected || defaults));
  }
}

function createFieldBackgroundPreview(field, label = "Veldtekening") {
  const backgroundField = { ...(field || {}), overlayItems: [] };
  return createFieldPreview(backgroundField, label, { includeOverlay: false });
}

function fieldPointerPosition(stage, event) {
  const rect = stage.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
  };
}

function applyFieldOverlayItemPosition(node, item) {
  if (!node || !item) {
    return;
  }
  node.style.left = `${Number(item.x) || 50}%`;
  node.style.top = `${Number(item.y) || 50}%`;
  node.style.setProperty("--overlay-size", String(getOverlayItemSize(item) / 100));
  if (item.type === "field-image") {
    const size = Math.max(25, Math.min(180, Number(item.size) || 100));
    node.style.width = `${size}%`;
    node.style.height = `${size}%`;
  }
  if (item.type === "line" || item.type === "arrow") {
    const x = Number(item.x) || 50;
    const y = Number(item.y) || 50;
    const x2 = Number(item.x2) || x + 12;
    const y2 = Number(item.y2) || y;
    const dx = x2 - x;
    const dy = y2 - y;
    const length = Math.max(1, Math.sqrt((dx * dx) + (dy * dy)));
    node.style.width = `${length}%`;
    node.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
  }
}

function markSelectedFieldOverlayItem(itemId) {
  selectedFieldItemId = itemId || null;
  document.querySelectorAll(".exercise-field-overlay-item").forEach((node) => {
    node.classList.toggle("exercise-field-overlay-item-active", node.dataset.overlayItemId === itemId);
  });
  if (deleteExerciseFieldItem) {
    deleteExerciseFieldItem.disabled = !selectedFieldItemId;
  }
  syncFieldOverlayControls();
}

function renderFieldOverlayItem(item, editable = false) {
  item.type = normalizeFieldToolType(item.type);
  const node = document.createElement("button");
  node.type = "button";
  node.className = `exercise-field-overlay-item exercise-field-overlay-${item.type || "item"}`;
  node.dataset.overlayItemId = item.id || "";
  node.style.setProperty("--overlay-color", item.color || "#111111");
  if (!editable) {
    node.tabIndex = -1;
    node.setAttribute("aria-hidden", "true");
  }
  if (item.id && item.id === selectedFieldItemId) {
    node.classList.add("exercise-field-overlay-item-active");
  }

  let imageHandle = null;
  if (item.type === "field-image") {
    const image = document.createElement("img");
    image.src = item.src || "";
    image.alt = "Geimporteerde veldtekening";
    image.draggable = false;
    node.append(image);
    if (editable) {
      const handle = document.createElement("span");
      handle.className = "exercise-field-overlay-image-handle";
      handle.setAttribute("aria-hidden", "true");
      node.append(handle);
      imageHandle = handle;
    }
  } else if (item.type === "line" || item.type === "arrow") {
    node.innerHTML = item.type === "arrow" ? "<span></span><i></i>" : "<span></span>";
  } else if (item.type === "text") {
    node.textContent = item.text || "Tekst";
  } else if (item.type === "goal") {
    node.innerHTML = "<span></span>";
  } else {
    node.setAttribute("aria-label", item.type || "Item");
  }
  applyFieldOverlayItemPosition(node, item);

  if (editable) {
    node.title = item.type === "field-image"
      ? "Sleep om de afbeelding te verplaatsen. Dubbelklik om te verwijderen."
      : "Sleep om te verplaatsen. Dubbelklik om te verwijderen.";
    node.setAttribute("aria-label", item.type === "field-image" ? "Afbeelding selecteren" : `${item.type || "Item"} selecteren`);
    const bindSelectionEvents = (target) => {
      target.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        event.preventDefault();
        const stage = node.closest(".exercise-field-overlay-stage");
        if (!stage) {
          return;
        }
        markSelectedFieldOverlayItem(item.id);
        const start = fieldPointerPosition(stage, event);
        fieldDragState = {
          itemId: item.id,
          startX: start.x,
          startY: start.y,
          original: { ...item },
          node,
        };
        target.setPointerCapture?.(event.pointerId);
      });
      target.addEventListener("dblclick", (event) => {
        event.stopPropagation();
        event.preventDefault();
        markSelectedFieldOverlayItem(item.id);
        deleteSelectedFieldItem();
      });
    };
    bindSelectionEvents(node);
    if (imageHandle) {
      bindSelectionEvents(imageHandle);
    }
  }

  return node;
}

function createFieldPreview(field, label = "Veldtekening") {
  return createFieldPreviewWithOptions(field, label, { includeOverlay: true, editable: false });
}

function createFieldPreviewWithOptions(field, label = "Veldtekening", options = {}) {
  const imageDataUrl = String(field?.imageDataUrl || "").trim();
  const overlayItems = options.includeOverlay === false ? [] : getFieldOverlayItems(field);

  if (imageDataUrl.startsWith("data:image/")) {
    const stage = document.createElement("div");
    stage.className = "exercise-field-overlay-stage";
    if (options.editable) {
      stage.classList.add("exercise-field-overlay-stage-editing");
      if (activeFieldTool === "select") {
        stage.classList.add("exercise-field-overlay-stage-selecting");
      }
    }
    const imageLayer = getFieldImageLayer(field);
    if (imageLayer) {
      stage.append(renderFieldOverlayItem(imageLayer, Boolean(options.editable)));
    }
    overlayItems.forEach((item) => stage.append(renderFieldOverlayItem(item, Boolean(options.editable))));
    return stage;
  }

  const viewBox = Array.isArray(field?.viewBox) && field.viewBox.length === 4
    ? field.viewBox.map((value) => Number(value) || 0)
    : DEFAULT_FIELD_VIEWBOX;
  if (viewBox[2] <= 0 || viewBox[3] <= 0) {
    viewBox[0] = DEFAULT_FIELD_VIEWBOX[0];
    viewBox[1] = DEFAULT_FIELD_VIEWBOX[1];
    viewBox[2] = DEFAULT_FIELD_VIEWBOX[2];
    viewBox[3] = DEFAULT_FIELD_VIEWBOX[3];
  }
  const elements = Array.isArray(field?.elements) ? field.elements : [];

  const svg = createSvgNode("svg", {
    viewBox: viewBox.join(" "),
    role: "img",
    "aria-label": label,
    preserveAspectRatio: "xMidYMid meet",
  });
  svg.appendChild(createSvgNode("rect", {
    x: viewBox[0],
    y: viewBox[1],
    width: viewBox[2],
    height: viewBox[3],
    fill: "#159447",
  }));

  elements.forEach((element) => {
    const x = Number(element.x) || 0;
    const y = Number(element.y) || 0;
    const width = Math.max(1, Number(element.width) || 1);
    const height = Math.max(1, Number(element.height) || 1);
    const fill = String(element.fill || "#111111");
    let node;

    if (element.type === "ellipse") {
      node = createSvgNode("ellipse", {
        cx: x + width / 2,
        cy: y + height / 2,
        rx: width / 2,
        ry: height / 2,
        fill,
        stroke: fill === "#000000" ? "#ffffff" : "#111111",
        "stroke-width": 9000,
      });
    } else if (element.type === "cone") {
      node = createSvgNode("polygon", {
        points: `${x + width * 0.18},${y + height} ${x + width * 0.82},${y + height} ${x + width * 0.62},${y} ${x + width * 0.38},${y}`,
        fill,
        stroke: "#111111",
        "stroke-width": 9000,
      });
    } else if (element.type === "line") {
      node = createSvgNode("line", {
        x1: x,
        y1: y,
        x2: x + width,
        y2: y + height,
        stroke: fill,
        "stroke-width": 22000,
        "stroke-linecap": "round",
      });
    } else {
      node = createSvgNode("rect", {
        x,
        y,
        width,
        height,
        fill,
        stroke: fill === "#00B050" ? "#ffffff" : "#111111",
        "stroke-width": 9000,
      });
    }

    svg.appendChild(node);
  });

  const stage = document.createElement("div");
  stage.className = "exercise-field-overlay-stage exercise-field-overlay-stage-svg";
  if (options.editable) {
    stage.classList.add("exercise-field-overlay-stage-editing");
    if (activeFieldTool === "select") {
      stage.classList.add("exercise-field-overlay-stage-selecting");
    }
  }
  stage.append(svg);
  overlayItems.forEach((item) => stage.append(renderFieldOverlayItem(item, Boolean(options.editable))));
  return stage;
}

function drawField(field) {
  if (!exerciseField) {
    return;
  }

  const preview = createFieldPreviewWithOptions(field, "Veldtekening", {
    includeOverlay: true,
    editable: activeFieldOverlayEditing,
  });
  if (!preview) {
    exerciseField.innerHTML = '<div class="exercise-field-empty">Geen veldtekening beschikbaar</div>';
    return;
  }
  exerciseField.replaceChildren(preview);
  if (activeFieldOverlayEditing) {
    preview.addEventListener("pointerdown", addOverlayItemFromPointer);
    preview.addEventListener("pointermove", dragOverlayItemFromPointer);
    preview.addEventListener("pointerup", endOverlayItemDrag);
    preview.addEventListener("pointercancel", endOverlayItemDrag);
  }
}

function ensureFieldOverlay() {
  if (!activeExercise) {
    return [];
  }
  if (!activeExercise.field || typeof activeExercise.field !== "object") {
    activeExercise.field = { viewBox: DEFAULT_FIELD_VIEWBOX, elements: [], overlayItems: [] };
  }
  if (!Array.isArray(activeExercise.field.viewBox) || activeExercise.field.viewBox.length !== 4) {
    activeExercise.field.viewBox = DEFAULT_FIELD_VIEWBOX;
  }
  if (!Array.isArray(activeExercise.field.elements)) {
    activeExercise.field.elements = [];
  }
  if (!Array.isArray(activeExercise.field.overlayItems)) {
    activeExercise.field.overlayItems = [];
  }
  return activeExercise.field.overlayItems;
}

function createOverlayItem(type, x, y) {
  const normalizedType = normalizeFieldToolType(type);
  const defaults = FIELD_TOOL_DEFAULTS[normalizedType] || FIELD_TOOL_DEFAULTS.player;
  const color = exerciseFieldOverlayColor?.value || defaults.color;
  const size = Number(exerciseFieldOverlaySize?.value || defaults.size);
  const item = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: normalizedType,
    x,
    y,
    color,
    size: Math.max(45, Math.min(220, Number.isFinite(size) ? size : defaults.size)),
  };
  if (normalizedType === "line" || normalizedType === "arrow") {
    item.x2 = Math.min(100, x + 18);
    item.y2 = y;
  }
  if (normalizedType === "text") {
    const value = window.prompt("Tekst op veldtekening", "Tekst");
    item.text = String(value || "Tekst").trim().slice(0, 80) || "Tekst";
  }
  return item;
}

function addOverlayItemFromPointer(event) {
  if (!activeFieldOverlayEditing || event.target.closest(".exercise-field-overlay-item")) {
    return;
  }
  if (activeFieldTool === "select") {
    markSelectedFieldOverlayItem(null);
    return;
  }
  const position = fieldPointerPosition(event.currentTarget, event);
  const items = ensureFieldOverlay();
  const item = createOverlayItem(activeFieldTool, position.x, position.y);
  items.push(item);
  selectedFieldItemId = item.id;
  drawField(activeExercise.field);
}

function dragOverlayItemFromPointer(event) {
  if (!activeFieldOverlayEditing || !fieldDragState || !activeExercise?.field) {
    return;
  }
  const position = fieldPointerPosition(event.currentTarget, event);
  const item = fieldDragState.itemId === "__field-image-layer"
    ? getFieldImageLayer(activeExercise.field)
    : getFieldOverlayItems(activeExercise.field).find((entry) => entry.id === fieldDragState.itemId);
  if (!item) {
    return;
  }
  const dx = position.x - fieldDragState.startX;
  const dy = position.y - fieldDragState.startY;
  item.x = Math.max(0, Math.min(100, Number(fieldDragState.original.x || 0) + dx));
  item.y = Math.max(0, Math.min(100, Number(fieldDragState.original.y || 0) + dy));
  if (item.type === "line" || item.type === "arrow") {
    item.x2 = Math.max(0, Math.min(100, Number(fieldDragState.original.x2 || item.x) + dx));
    item.y2 = Math.max(0, Math.min(100, Number(fieldDragState.original.y2 || item.y) + dy));
  }
  if (item.type === "field-image") {
    setFieldImageLayer(activeExercise.field, item);
  }
  applyFieldOverlayItemPosition(fieldDragState.node, item);
}

function endOverlayItemDrag() {
  fieldDragState = null;
}

function setFieldOverlayEditing(isEditing) {
  if (!canEditExercises || !activeExercise) {
    return;
  }
  activeFieldOverlayEditing = Boolean(isEditing);
  if (activeFieldOverlayEditing) {
    activeFieldTool = "select";
  }
  if (exerciseFieldOverlayEditor) {
    exerciseFieldOverlayEditor.hidden = !activeFieldOverlayEditing;
  }
  exerciseFieldPanel?.classList.toggle("exercise-field-panel-editing", activeFieldOverlayEditing);
  if (editExerciseField) {
    editExerciseField.textContent = activeFieldOverlayEditing ? "Overlay sluiten" : "Veldtekening bewerken";
  }
  document.querySelectorAll("[data-field-tool]").forEach((toolButton) => {
    const isActive = toolButton.dataset.fieldTool === activeFieldTool;
    toolButton.classList.toggle("exercise-field-tool-active", isActive);
    toolButton.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
  ensureFieldOverlay();
  markSelectedFieldOverlayItem(selectedFieldItemId);
  syncFieldOverlayControls();
  drawField(activeExercise.field);
}

async function saveActiveFieldOverlay() {
  if (!activeExercise || !saveExerciseFieldOverlay) {
    return;
  }
  saveExerciseFieldOverlay.disabled = true;
  saveExerciseFieldOverlay.setAttribute("aria-label", "Overlay opslaan...");
  saveExerciseFieldOverlay.title = "Overlay opslaan...";
  try {
    const response = await fetch("/api/oefeningen-bibliotheek/field-overlay", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-Token": getCsrfToken(),
      },
      body: JSON.stringify({
        id: activeExercise.id,
        overlayItems: getFieldOverlayItems(activeExercise.field),
        imageDataUrl: activeExercise.field?.imageDataUrl || "",
        imageLayer: activeExercise.field?.imageLayer || null,
        backgroundOpacity: activeExercise.field?.backgroundOpacity || 1,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Overlay opslaan mislukt.");
    }
    Object.assign(activeExercise, payload.exercise);
    syncExerciseTile(activeExercise);
    setFieldOverlayEditing(false);
  } catch (error) {
    console.error(error);
    saveExerciseFieldOverlay.setAttribute("aria-label", "Opslaan mislukt");
    saveExerciseFieldOverlay.title = "Opslaan mislukt";
    window.setTimeout(() => {
      saveExerciseFieldOverlay.setAttribute("aria-label", "Overlay opslaan");
      saveExerciseFieldOverlay.title = "Overlay opslaan";
    }, 1600);
  } finally {
    saveExerciseFieldOverlay.disabled = false;
    saveExerciseFieldOverlay.setAttribute("aria-label", "Overlay opslaan");
    saveExerciseFieldOverlay.title = "Overlay opslaan";
  }
}

function deleteSelectedFieldItem() {
  if (!activeExercise?.field || !selectedFieldItemId) {
    return;
  }
  if (selectedFieldItemId === "__field-image-layer") {
    delete activeExercise.field.imageDataUrl;
    delete activeExercise.field.imageLayer;
    markSelectedFieldOverlayItem(null);
    drawField(activeExercise.field);
    return;
  }
  activeExercise.field.overlayItems = getFieldOverlayItems(activeExercise.field).filter((item) => item.id !== selectedFieldItemId);
  markSelectedFieldOverlayItem(null);
  drawField(activeExercise.field);
}

function clearFieldItems() {
  if (!activeExercise?.field) {
    return;
  }
  activeExercise.field.overlayItems = [];
  markSelectedFieldOverlayItem(null);
  drawField(activeExercise.field);
}

function setExerciseMediaMode(mode) {
  activeMedia = mode === "video" ? "video" : "field";
  const hasVideo = Boolean(activeExercise?.videoUrl);
  if (!hasVideo) {
    activeMedia = "field";
  }
  if (exerciseField) {
    exerciseField.hidden = activeMedia !== "field";
  }
  if (exerciseVideoPanel) {
    exerciseVideoPanel.hidden = activeMedia !== "video";
  }
  document.querySelectorAll("[data-exercise-media]").forEach((button) => {
    const isActive = button.dataset.exerciseMedia === activeMedia;
    button.classList.toggle("exercise-media-toggle-button-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function drawExerciseVideo(exercise) {
  if (!exerciseVideoPanel) {
    return;
  }
  const videoUrl = String(exercise?.videoUrl || "").trim();
  if (!videoUrl) {
    exerciseVideoPanel.innerHTML = '<div class="exercise-field-empty">Geen video gekoppeld</div>';
    return;
  }
  const video = document.createElement("video");
  video.src = videoUrl;
  video.controls = true;
  video.preload = "metadata";
  video.playsInline = true;
  video.setAttribute("aria-label", `Video ${exercise.title || "oefening"}`);
  exerciseVideoPanel.replaceChildren(video);
}

function renderTilePreview(exercise) {
  const preview = document.querySelector(`[data-exercise-preview="${exercise.id}"]`);
  if (!preview) {
    return;
  }
  const fieldPreview = createFieldPreview(exercise.field, `Veldtekening ${exercise.title || ""}`.trim());
  if (!fieldPreview) {
    preview.innerHTML = '<span class="exercise-tile-preview-empty">Geen veldtekening</span>';
    return;
  }
  preview.replaceChildren(fieldPreview);
}

function renderImportPreviewImage(exercise, index) {
  const preview = document.querySelector(`[data-import-preview-image="${index}"]`);
  if (!preview) {
    return;
  }
  const fieldPreview = createFieldPreview(exercise.field, `Importvoorbeeld ${exercise.title || ""}`.trim());
  if (!fieldPreview) {
    preview.innerHTML = '<span class="exercise-tile-preview-empty">Geen veldtekening</span>';
    return;
  }
  preview.replaceChildren(fieldPreview);
}

function setModalOpen(isOpen) {
  if (!exerciseModal) {
    return;
  }
  if (isOpen) {
    window.HwsSidebar?.setCollapsed(true, { persist: false });
  }
  exerciseModal.hidden = !isOpen;
  document.body.style.overflow = isOpen ? "hidden" : "";
  if (!isOpen) {
    activeInlineEdit = false;
    removeInlineEditFields();
    activeFieldOverlayEditing = false;
    selectedFieldItemId = null;
    if (exerciseFieldOverlayEditor) {
      exerciseFieldOverlayEditor.hidden = true;
    }
    exerciseFieldPanel?.classList.remove("exercise-field-panel-editing");
  }
}

function setEditMode(isEditing) {
  if (!canEditExercises) {
    return;
  }
  activeInlineEdit = Boolean(isEditing);
  setFieldOverlayEditing(Boolean(isEditing));
  if (editExercise) {
    editExercise.hidden = isEditing;
  }
  if (exerciseAdminEditActions) {
    exerciseAdminEditActions.hidden = !isEditing;
  }
  if (exerciseHeadingCategoryField) {
    exerciseHeadingCategoryField.hidden = !isEditing;
  }
  if (exerciseAgeFieldset) {
    exerciseAgeFieldset.hidden = !isEditing;
  }
  document.querySelector("#exerciseModalCategory")?.toggleAttribute("hidden", isEditing);
  document.querySelector("#exerciseModalAges")?.toggleAttribute("hidden", isEditing);
  if (exerciseFieldEditActions) {
    exerciseFieldEditActions.hidden = !isEditing;
  }
  if (exerciseEditForm) {
    exerciseEditForm.hidden = true;
  }
  if (isEditing) {
    startInlineExerciseEdit();
  } else {
    setFieldOverlayEditing(false);
    removeInlineEditFields();
    if (activeExercise) {
      renderExercise(activeExercise);
    }
  }
}

function setSaveExerciseLabel(label) {
  if (!saveExerciseEdit) {
    return;
  }
  saveExerciseEdit.setAttribute("aria-label", label);
  saveExerciseEdit.setAttribute("title", label);
  const textNode = saveExerciseEdit.querySelector(".exercise-icon-label");
  if (textNode) {
    textNode.textContent = label;
  }
}

function renderExercise(exercise) {
  setText("#exerciseModalCategory", exercise.category || "Zonder categorie");
  setText("#exerciseModalTitle", exercise.title);
  if (exerciseCategorySelect) {
    exerciseCategorySelect.value = exercise.category || "";
  }
  setAgeInputs(exercise.ageGroups);
  renderAgeBadges(document.querySelector("#exerciseModalAges"), exercise.ageGroups);
  setRichText("#exerciseDescription", exercise.description);
  setRichText("#exerciseCoaching", exercise.coaching);
  setRichText("#exerciseVariationEasier", exercise.variationEasier);
  setRichText("#exerciseVariationHarder", exercise.variationHarder);
  setRichText("#exerciseDimensions", exercise.dimensions);
  setRichText("#exerciseMaterials", exercise.materials);
  drawField(exercise.field);
  drawExerciseVideo(exercise);
  if (exerciseMediaToggle) {
    exerciseMediaToggle.hidden = !exercise.videoUrl;
  }
  setExerciseMediaMode(exercise.videoUrl && activeMedia === "video" ? "video" : "field");
  updateExerciseNavigation();
}

function openExercise(exercise) {
  if (!exercise) {
    return;
  }
  activeExercise = exercise;
  activeMedia = "field";
  activeFieldOverlayEditing = false;
  selectedFieldItemId = null;
  setEditMode(false);
  renderExercise(exercise);
  setModalOpen(true);
}

async function saveActiveExerciseCategory() {
  if (!activeExercise || !exerciseCategorySelect || !saveExerciseCategory) {
    return;
  }
  if (activeInlineEdit || (exerciseEditForm && !exerciseEditForm.hidden)) {
    await saveActiveExerciseEdit();
    return;
  }

  const nextCategory = exerciseCategorySelect.value;
  saveExerciseCategory.disabled = true;
  saveExerciseCategory.textContent = "Opslaan...";

  try {
    const response = await fetch("/api/oefeningen-bibliotheek/category", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-Token": getCsrfToken(),
      },
      body: JSON.stringify({
        id: activeExercise.id,
        category: nextCategory,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Categorie opslaan mislukt.");
    }
    syncExerciseCategory(activeExercise, payload.category || nextCategory);
    saveExerciseCategory.textContent = "Opgeslagen";
    window.setTimeout(() => {
      saveExerciseCategory.textContent = "Opslaan";
    }, 1200);
  } catch (error) {
    console.error(error);
    saveExerciseCategory.textContent = "Mislukt";
    window.setTimeout(() => {
      saveExerciseCategory.textContent = "Opslaan";
    }, 1600);
  } finally {
    saveExerciseCategory.disabled = false;
  }
}

function readExerciseEditPayload() {
  if (activeInlineEdit) {
    return {
      id: activeExercise?.id,
      title: getInlineEditValue("title") || activeExercise?.title || "",
      category: getActiveExerciseCategoryValue(),
      ageGroups: getSelectedAgeGroups(),
      trainingExercise: activeExercise?.trainingExercise || "",
      description: getInlineEditValue("description"),
      coaching: getInlineEditValue("coaching"),
      variationEasier: getInlineEditValue("variationEasier"),
      variationHarder: getInlineEditValue("variationHarder"),
      dimensions: getInlineEditValue("dimensions"),
      materials: getInlineEditValue("materials"),
    };
  }
  return {
    id: activeExercise?.id,
    title: activeExercise?.title || "",
    category: getActiveExerciseCategoryValue(),
    ageGroups: getSelectedAgeGroups(),
    trainingExercise: activeExercise?.trainingExercise || "",
    description: activeExercise?.description || "",
    coaching: activeExercise?.coaching || "",
    variationEasier: activeExercise?.variationEasier || "",
    variationHarder: activeExercise?.variationHarder || "",
    dimensions: activeExercise?.dimensions || "",
    materials: activeExercise?.materials || "",
  };
}

async function saveActiveExerciseEdit(event) {
  event?.preventDefault();
  if (!canEditExercises || !activeExercise || !saveExerciseEdit) {
    return;
  }
  const payload = readExerciseEditPayload();
  if (!String(payload.title || "").trim()) {
    setSaveExerciseLabel("Titel ontbreekt");
    window.setTimeout(() => {
      setSaveExerciseLabel("Oefening opslaan");
    }, 1600);
    return;
  }

  saveExerciseEdit.disabled = true;
  setSaveExerciseLabel("Opslaan...");

  try {
    const response = await fetch("/api/oefeningen-bibliotheek/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-Token": getCsrfToken(),
      },
      body: JSON.stringify(payload),
    });
    const responsePayload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(responsePayload.error || "Oefening opslaan mislukt.");
    }
    Object.assign(activeExercise, responsePayload.exercise);
    renderExercise(activeExercise);
    syncExerciseTile(activeExercise);
    setEditMode(false);
  } catch (error) {
    console.error(error);
    setSaveExerciseLabel("Opslaan mislukt");
    window.setTimeout(() => {
      setSaveExerciseLabel("Oefening opslaan");
    }, 1600);
  } finally {
    saveExerciseEdit.disabled = false;
    if (saveExerciseEdit.getAttribute("aria-label") !== "Opslaan mislukt") {
      setSaveExerciseLabel("Oefening opslaan");
    }
  }
}

async function uploadActiveExerciseFieldImage() {
  if (!canEditExercises || !activeExercise || !exerciseFieldImageInput) {
    return;
  }
  const file = exerciseFieldImageInput.files?.[0];
  if (!file) {
    return;
  }

  const button = exerciseFieldImageInput.closest(".exercise-field-image-button");
  const label = button?.querySelector(".exercise-field-image-label");
  const previousText = label?.textContent || "Veldtekening importeren";
  if (label) {
    label.textContent = "Uploaden...";
  }
  exerciseFieldImageInput.disabled = true;

  try {
    const formData = new FormData();
    formData.append("id", activeExercise.id);
    formData.append("field_image", file, file.name);
    formData.append("csrf_token", getCsrfToken());

    const response = await fetch("/api/oefeningen-bibliotheek/field-image", {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Veldtekening importeren mislukt.");
    }
    Object.assign(activeExercise, payload.exercise);
    renderExercise(activeExercise);
    renderTilePreview(activeExercise);
    if (label) {
      label.textContent = "Geimporteerd";
      window.setTimeout(() => {
        label.textContent = previousText;
      }, 1200);
    }
  } catch (error) {
    console.error(error);
    if (label) {
      label.textContent = "Mislukt";
      window.setTimeout(() => {
        label.textContent = previousText;
      }, 1600);
    }
  } finally {
    exerciseFieldImageInput.disabled = false;
    exerciseFieldImageInput.value = "";
  }
}

async function deleteActiveExercise() {
  if (!canEditExercises || !activeExercise || !deleteExercise) {
    return;
  }
  if (!window.confirm(`Weet je zeker dat je "${activeExercise.title}" wilt verwijderen?`)) {
    return;
  }

  deleteExercise.disabled = true;
  deleteExercise.textContent = "Verwijderen...";

  try {
    const response = await fetch("/api/oefeningen-bibliotheek/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-Token": getCsrfToken(),
      },
      body: JSON.stringify({ id: activeExercise.id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Oefening verwijderen mislukt.");
    }
    getExerciseTile(activeExercise.id)?.remove();
    exerciseById.delete(String(activeExercise.id));
    activeExercise = null;
    setModalOpen(false);
    applyExerciseFilter(activeFilter);
  } catch (error) {
    console.error(error);
    deleteExercise.textContent = "Mislukt";
    window.setTimeout(() => {
      deleteExercise.textContent = "Verwijderen";
    }, 1600);
  } finally {
    deleteExercise.disabled = false;
    if (deleteExercise.textContent !== "Mislukt") {
      deleteExercise.textContent = "Verwijderen";
    }
  }
}

parseExerciseData().forEach((exercise) => {
  exerciseById.set(String(exercise.id), exercise);
  const tile = getExerciseTile(exercise.id);
  if (tile) {
    tile.dataset.exerciseSearch = buildExerciseSearchText(exercise);
    renderAgeBadges(tile.querySelector(`[data-exercise-tile-ages="${exercise.id}"]`), exercise.ageGroups);
  }
  renderTilePreview(exercise);
});
sortExerciseTilesByTitle();

parseImportPreviewData().forEach((exercise, index) => {
  renderImportPreviewImage(exercise, index);
});

enhanceExerciseTextControls();

document.querySelectorAll("[data-exercise-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    applyExerciseFilter(button.dataset.exerciseFilter || "all");
  });
});

exerciseSearchInput?.addEventListener("input", () => {
  applyExerciseFilter(activeFilter);
});

document.querySelectorAll("[data-exercise-id]").forEach((button) => {
  button.addEventListener("click", () => {
    openExercise(exerciseById.get(String(button.dataset.exerciseId || "")));
  });
});

saveExerciseCategory?.addEventListener("click", saveActiveExerciseCategory);
document.querySelectorAll("[data-exercise-media]").forEach((button) => {
  button.addEventListener("click", () => {
    setExerciseMediaMode(button.dataset.exerciseMedia || "field");
  });
});
editExerciseField?.addEventListener("click", () => {
  setExerciseMediaMode("field");
  setFieldOverlayEditing(!activeFieldOverlayEditing);
});
document.querySelectorAll("[data-field-tool]").forEach((button) => {
  button.addEventListener("click", () => {
    activeFieldTool = normalizeFieldToolType(button.dataset.fieldTool || "player");
    const defaults = FIELD_TOOL_DEFAULTS[activeFieldTool] || FIELD_TOOL_DEFAULTS.player;
    if (!selectedFieldItemId) {
      if (exerciseFieldOverlayColor) {
        exerciseFieldOverlayColor.value = defaults.color;
      }
      if (exerciseFieldOverlaySize) {
        exerciseFieldOverlaySize.value = String(defaults.size);
      }
    }
    document.querySelectorAll("[data-field-tool]").forEach((toolButton) => {
      const isActive = normalizeFieldToolType(toolButton.dataset.fieldTool) === activeFieldTool;
      toolButton.classList.toggle("exercise-field-tool-active", isActive);
      toolButton.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  });
});
exerciseFieldOverlayColor?.addEventListener("input", () => {
  const selected = getSelectedFieldItem();
  if (!selected || selected.type === "field-image") {
    return;
  }
  selected.color = exerciseFieldOverlayColor.value || selected.color || "#111111";
  drawField(activeExercise.field);
});
exerciseFieldOverlaySize?.addEventListener("input", () => {
  const selected = getSelectedFieldItem();
  if (!selected) {
    return;
  }
  selected.size = Math.max(45, Math.min(selected.type === "field-image" ? 180 : 220, Number(exerciseFieldOverlaySize.value) || 100));
  if (selected.type === "field-image") {
    setFieldImageLayer(activeExercise.field, selected);
  }
  drawField(activeExercise.field);
});
saveExerciseFieldOverlay?.addEventListener("click", saveActiveFieldOverlay);
cancelExerciseFieldOverlay?.addEventListener("click", () => setFieldOverlayEditing(false));
deleteExerciseFieldItem?.addEventListener("click", deleteSelectedFieldItem);
clearExerciseFieldItems?.addEventListener("click", clearFieldItems);
editExercise?.addEventListener("click", () => {
  if (activeExercise) {
    setEditMode(true);
  }
});
cancelExerciseEdit?.addEventListener("click", () => setEditMode(false));
exerciseEditForm?.addEventListener("submit", saveActiveExerciseEdit);
saveExerciseEdit?.addEventListener("click", saveActiveExerciseEdit);
exerciseFieldImageInput?.addEventListener("change", uploadActiveExerciseFieldImage);
deleteExercise?.addEventListener("click", deleteActiveExercise);
previousExercise?.addEventListener("click", () => navigateExercise(-1));
nextExercise?.addEventListener("click", () => navigateExercise(1));
closeExerciseModal?.addEventListener("click", () => setModalOpen(false));
document.querySelectorAll("[data-close-exercise-modal]").forEach((node) => {
  node.addEventListener("click", () => setModalOpen(false));
});
document.addEventListener("keydown", (event) => {
  if (activeFieldOverlayEditing && selectedFieldItemId && (event.key === "Backspace" || event.key === "Delete")) {
    event.preventDefault();
    deleteSelectedFieldItem();
    return;
  }
  if (event.key === "Escape" && exerciseModal && !exerciseModal.hidden) {
    setModalOpen(false);
  }
  if (!activeFieldOverlayEditing && exerciseModal && !exerciseModal.hidden && !activeInlineEdit) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      navigateExercise(-1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      navigateExercise(1);
    }
  }
});
