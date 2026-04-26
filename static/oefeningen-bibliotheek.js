const exerciseDataNode = document.querySelector("#exerciseData");
const exerciseImportPreviewDataNode = document.querySelector("#exerciseImportPreviewData");
const exerciseModal = document.querySelector("#exerciseModal");
const closeExerciseModal = document.querySelector("#closeExerciseModal");
const exerciseField = document.querySelector("#exerciseField");
const exerciseCategorySelect = document.querySelector("#exerciseCategorySelect");
const saveExerciseCategory = document.querySelector("#saveExerciseCategory");
const editExercise = document.querySelector("#editExercise");
const deleteExercise = document.querySelector("#deleteExercise");
const exerciseEditForm = document.querySelector("#exerciseEditForm");
const cancelExerciseEdit = document.querySelector("#cancelExerciseEdit");
const saveExerciseEdit = document.querySelector("#saveExerciseEdit");
const exerciseDetailLayout = document.querySelector("#exerciseDetailLayout");
const exerciseFilterEmpty = document.querySelector("#exerciseFilterEmpty");
const exerciseById = new Map();
let activeExercise = null;
let activeFilter = "all";
const canEditExercises = exerciseModal?.dataset.canEdit === "true";

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

function setValue(selector, value) {
  const node = document.querySelector(selector);
  if (node) {
    node.value = String(value || "").trim();
  }
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

function applyExerciseFilter(category) {
  activeFilter = category || "all";
  const normalizedActiveFilter = normalizeFilterValue(activeFilter);
  let visibleCount = 0;

  document.querySelectorAll("[data-exercise-filter]").forEach((button) => {
    button.classList.toggle("exercise-filter-button-active", button.dataset.exerciseFilter === activeFilter);
    button.setAttribute("aria-pressed", button.dataset.exerciseFilter === activeFilter ? "true" : "false");
  });

  document.querySelectorAll("#exerciseTileGrid .exercise-tile").forEach((tile) => {
    const matches = activeFilter === "all" || normalizeFilterValue(tile.dataset.exerciseCategory) === normalizedActiveFilter;
    tile.hidden = !matches;
    tile.classList.toggle("exercise-tile-hidden", !matches);
    if (matches) {
      visibleCount += 1;
    }
  });

  if (exerciseFilterEmpty) {
    exerciseFilterEmpty.hidden = visibleCount > 0;
  }
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
  applyExerciseFilter(activeFilter);
}

function createSvgNode(tagName, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    node.setAttribute(key, String(value));
  });
  return node;
}

function createFieldSvg(field, label = "Veldtekening") {
  const viewBox = Array.isArray(field?.viewBox) && field.viewBox.length === 4
    ? field.viewBox.map((value) => Number(value) || 0)
    : [0, 0, 100, 100];
  const elements = Array.isArray(field?.elements) ? field.elements : [];

  if (!elements.length) {
    return null;
  }

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

  return svg;
}

function drawField(field) {
  if (!exerciseField) {
    return;
  }

  const svg = createFieldSvg(field, "Veldtekening");
  if (!svg) {
    exerciseField.innerHTML = '<div class="exercise-field-empty">Geen veldtekening beschikbaar</div>';
    return;
  }
  exerciseField.replaceChildren(svg);
}

function renderTilePreview(exercise) {
  const preview = document.querySelector(`[data-exercise-preview="${exercise.id}"]`);
  if (!preview) {
    return;
  }
  const svg = createFieldSvg(exercise.field, `Veldtekening ${exercise.title || ""}`.trim());
  if (!svg) {
    preview.innerHTML = '<span class="exercise-tile-preview-empty">Geen veldtekening</span>';
    return;
  }
  preview.replaceChildren(svg);
}

function renderImportPreviewImage(exercise, index) {
  const preview = document.querySelector(`[data-import-preview-image="${index}"]`);
  if (!preview) {
    return;
  }
  const svg = createFieldSvg(exercise.field, `Importvoorbeeld ${exercise.title || ""}`.trim());
  if (!svg) {
    preview.innerHTML = '<span class="exercise-tile-preview-empty">Geen veldtekening</span>';
    return;
  }
  preview.replaceChildren(svg);
}

function setModalOpen(isOpen) {
  if (!exerciseModal) {
    return;
  }
  exerciseModal.hidden = !isOpen;
  document.body.style.overflow = isOpen ? "hidden" : "";
}

function setEditMode(isEditing) {
  if (!canEditExercises) {
    return;
  }
  if (exerciseEditForm) {
    exerciseEditForm.hidden = !isEditing;
  }
  if (exerciseDetailLayout) {
    exerciseDetailLayout.hidden = isEditing;
  }
}

function fillExerciseEditForm(exercise) {
  setValue("#exerciseEditTitle", exercise.title);
  setValue("#exerciseEditCategory", exercise.category);
  setValue("#exerciseEditDuration", exercise.duration);
  setValue("#exerciseEditDescription", exercise.description);
  setValue("#exerciseEditCoaching", exercise.coaching);
  setValue("#exerciseEditVariationEasier", exercise.variationEasier);
  setValue("#exerciseEditVariationHarder", exercise.variationHarder);
  setValue("#exerciseEditDimensions", exercise.dimensions);
  setValue("#exerciseEditMaterials", exercise.materials);
}

function renderExercise(exercise) {
  setText("#exerciseModalCategory", exercise.category || "Zonder categorie");
  setText("#exerciseModalTitle", exercise.title);
  if (exerciseCategorySelect) {
    exerciseCategorySelect.value = exercise.category || "";
  }
  setText("#exerciseDescription", exercise.description);
  setText("#exerciseCoaching", exercise.coaching);
  setText("#exerciseVariationEasier", exercise.variationEasier);
  setText("#exerciseVariationHarder", exercise.variationHarder);
  setText("#exerciseDimensions", exercise.dimensions);
  setText("#exerciseMaterials", exercise.materials);
  drawField(exercise.field);
  if (canEditExercises) {
    fillExerciseEditForm(exercise);
  }
}

function openExercise(exercise) {
  if (!exercise) {
    return;
  }
  activeExercise = exercise;
  setEditMode(false);
  renderExercise(exercise);
  setModalOpen(true);
}

async function saveActiveExerciseCategory() {
  if (!activeExercise || !exerciseCategorySelect || !saveExerciseCategory) {
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
  return {
    id: activeExercise?.id,
    title: document.querySelector("#exerciseEditTitle")?.value || "",
    category: document.querySelector("#exerciseEditCategory")?.value || "",
    duration: document.querySelector("#exerciseEditDuration")?.value || "",
    description: document.querySelector("#exerciseEditDescription")?.value || "",
    coaching: document.querySelector("#exerciseEditCoaching")?.value || "",
    variationEasier: document.querySelector("#exerciseEditVariationEasier")?.value || "",
    variationHarder: document.querySelector("#exerciseEditVariationHarder")?.value || "",
    dimensions: document.querySelector("#exerciseEditDimensions")?.value || "",
    materials: document.querySelector("#exerciseEditMaterials")?.value || "",
  };
}

async function saveActiveExerciseEdit(event) {
  event?.preventDefault();
  if (!canEditExercises || !activeExercise || !saveExerciseEdit) {
    return;
  }

  saveExerciseEdit.disabled = true;
  saveExerciseEdit.textContent = "Opslaan...";

  try {
    const response = await fetch("/api/oefeningen-bibliotheek/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-Token": getCsrfToken(),
      },
      body: JSON.stringify(readExerciseEditPayload()),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || "Oefening opslaan mislukt.");
    }
    Object.assign(activeExercise, payload.exercise);
    renderExercise(activeExercise);
    syncExerciseTile(activeExercise);
    setEditMode(false);
  } catch (error) {
    console.error(error);
    saveExerciseEdit.textContent = "Mislukt";
    window.setTimeout(() => {
      saveExerciseEdit.textContent = "Wijzigingen opslaan";
    }, 1600);
  } finally {
    saveExerciseEdit.disabled = false;
    if (saveExerciseEdit.textContent !== "Mislukt") {
      saveExerciseEdit.textContent = "Wijzigingen opslaan";
    }
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
  renderTilePreview(exercise);
});

parseImportPreviewData().forEach((exercise, index) => {
  renderImportPreviewImage(exercise, index);
});

document.querySelectorAll("[data-exercise-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    applyExerciseFilter(button.dataset.exerciseFilter || "all");
  });
});

document.querySelectorAll("[data-exercise-id]").forEach((button) => {
  button.addEventListener("click", () => {
    openExercise(exerciseById.get(String(button.dataset.exerciseId || "")));
  });
});

saveExerciseCategory?.addEventListener("click", saveActiveExerciseCategory);
editExercise?.addEventListener("click", () => {
  if (activeExercise) {
    fillExerciseEditForm(activeExercise);
    setEditMode(true);
  }
});
cancelExerciseEdit?.addEventListener("click", () => setEditMode(false));
exerciseEditForm?.addEventListener("submit", saveActiveExerciseEdit);
deleteExercise?.addEventListener("click", deleteActiveExercise);
closeExerciseModal?.addEventListener("click", () => setModalOpen(false));
document.querySelectorAll("[data-close-exercise-modal]").forEach((node) => {
  node.addEventListener("click", () => setModalOpen(false));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && exerciseModal && !exerciseModal.hidden) {
    setModalOpen(false);
  }
});
