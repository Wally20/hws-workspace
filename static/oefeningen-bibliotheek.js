const exerciseDataNode = document.querySelector("#exerciseData");
const exerciseModal = document.querySelector("#exerciseModal");
const closeExerciseModal = document.querySelector("#closeExerciseModal");
const exerciseField = document.querySelector("#exerciseField");
const exerciseCategorySelect = document.querySelector("#exerciseCategorySelect");
const saveExerciseCategory = document.querySelector("#saveExerciseCategory");
const exerciseFilterEmpty = document.querySelector("#exerciseFilterEmpty");
const exerciseById = new Map();
let activeExercise = null;
let activeFilter = "all";

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

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) {
    node.textContent = String(value || "").trim() || "-";
  }
}

function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
}

function getExerciseTile(exerciseId) {
  return document.querySelector(`[data-exercise-id="${exerciseId}"]`);
}

function applyExerciseFilter(category) {
  activeFilter = category || "all";
  let visibleCount = 0;

  document.querySelectorAll("[data-exercise-filter]").forEach((button) => {
    button.classList.toggle("exercise-filter-button-active", button.dataset.exerciseFilter === activeFilter);
  });

  document.querySelectorAll("[data-exercise-id]").forEach((tile) => {
    const matches = activeFilter === "all" || tile.dataset.exerciseCategory === activeFilter;
    tile.hidden = !matches;
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

function createSvgNode(tagName, attributes = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    node.setAttribute(key, String(value));
  });
  return node;
}

function drawField(field) {
  if (!exerciseField) {
    return;
  }

  const viewBox = Array.isArray(field?.viewBox) && field.viewBox.length === 4
    ? field.viewBox.map((value) => Number(value) || 0)
    : [0, 0, 100, 100];
  const elements = Array.isArray(field?.elements) ? field.elements : [];

  if (!elements.length) {
    exerciseField.innerHTML = '<div class="exercise-field-empty">Geen veldtekening beschikbaar</div>';
    return;
  }

  exerciseField.replaceChildren();
  const svg = createSvgNode("svg", {
    viewBox: viewBox.join(" "),
    role: "img",
    "aria-label": "Veldtekening",
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

  exerciseField.appendChild(svg);
}

function setModalOpen(isOpen) {
  if (!exerciseModal) {
    return;
  }
  exerciseModal.hidden = !isOpen;
  document.body.style.overflow = isOpen ? "hidden" : "";
}

function openExercise(exercise) {
  if (!exercise) {
    return;
  }
  activeExercise = exercise;
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

parseExerciseData().forEach((exercise) => {
  exerciseById.set(String(exercise.id), exercise);
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
closeExerciseModal?.addEventListener("click", () => setModalOpen(false));
document.querySelectorAll("[data-close-exercise-modal]").forEach((node) => {
  node.addEventListener("click", () => setModalOpen(false));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && exerciseModal && !exerciseModal.hidden) {
    setModalOpen(false);
  }
});
