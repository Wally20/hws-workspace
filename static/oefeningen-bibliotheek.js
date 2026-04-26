const exerciseDataNode = document.querySelector("#exerciseData");
const exerciseModal = document.querySelector("#exerciseModal");
const closeExerciseModal = document.querySelector("#closeExerciseModal");
const exerciseField = document.querySelector("#exerciseField");
const exerciseById = new Map();

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
  setText("#exerciseModalCategory", exercise.category || "Zonder categorie");
  setText("#exerciseModalTitle", exercise.title);
  setText("#exerciseDescription", exercise.description);
  setText("#exerciseCoaching", exercise.coaching);
  setText("#exerciseVariationEasier", exercise.variationEasier);
  setText("#exerciseVariationHarder", exercise.variationHarder);
  setText("#exerciseDimensions", exercise.dimensions);
  setText("#exerciseMaterials", exercise.materials);
  drawField(exercise.field);
  setModalOpen(true);
}

parseExerciseData().forEach((exercise) => {
  exerciseById.set(String(exercise.id), exercise);
});

document.querySelectorAll("[data-exercise-id]").forEach((button) => {
  button.addEventListener("click", () => {
    openExercise(exerciseById.get(String(button.dataset.exerciseId || "")));
  });
});

closeExerciseModal?.addEventListener("click", () => setModalOpen(false));
document.querySelectorAll("[data-close-exercise-modal]").forEach((node) => {
  node.addEventListener("click", () => setModalOpen(false));
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && exerciseModal && !exerciseModal.hidden) {
    setModalOpen(false);
  }
});
