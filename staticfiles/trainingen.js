const trainingExerciseDataNode = document.querySelector("#trainingExerciseData");
const trainingSavedDataNode = document.querySelector("#trainingSavedData");
const trainingSavedPanel = document.querySelector("#trainingSavedPanel");
const trainingMakerPanel = document.querySelector("#trainingMakerPanel");
const trainingSavedList = document.querySelector("#trainingSavedList");
const trainingSavedEmpty = document.querySelector("#trainingSavedEmpty");
const trainingSavedCount = document.querySelector("#trainingSavedCount");
const trainingExerciseSearch = document.querySelector("#trainingExerciseSearch");
const trainingExerciseList = document.querySelector("#trainingExerciseList");
const trainingExerciseEmpty = document.querySelector("#trainingExerciseEmpty");
const trainingBuilder = document.querySelector("#trainingBuilder");
const trainingDate = document.querySelector("#trainingDate");
const trainingTitle = document.querySelector("#trainingTitle");
const trainingObjective = document.querySelector("#trainingObjective");
const trainingDropZone = document.querySelector("#trainingDropZone");
const trainingDropEmpty = document.querySelector("#trainingDropEmpty");
const trainingSelectedList = document.querySelector("#trainingSelectedList");
const trainingFeedback = document.querySelector("#trainingFeedback");
const trainingExerciseModal = document.querySelector("#trainingExerciseModal");
const trainingExerciseModalField = document.querySelector("#trainingExerciseModalField");
const trainingExerciseFilters = document.querySelector("#trainingExerciseFilters");

let exercises = parseJsonNode(trainingExerciseDataNode);
let savedTrainings = parseJsonNode(trainingSavedDataNode);
let selectedExercises = [];
let draggedSelectedIndex = null;
let activeExerciseFilter = "all";
let lastAutoTrainingTitle = "";

function parseJsonNode(node) {
  if (!node) {
    return [];
  }
  try {
    const payload = JSON.parse(node.textContent || "[]");
    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    console.error("Trainingdata kon niet worden gelezen.", error);
    return [];
  }
}

function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
}

function normalizeSearch(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function formatTrainingDateTitle(value) {
  return String(value || "").replaceAll("-", "");
}

function exerciseSearchText(exercise) {
  return normalizeSearch([
    exercise.title,
    exercise.category,
    exercise.trainingExercise,
    exercise.description,
    exercise.coaching,
    exercise.materials,
  ].join(" "));
}

function makeText(tagName, className, value) {
  const node = document.createElement(tagName);
  if (className) {
    node.className = className;
  }
  node.textContent = String(value || "");
  return node;
}

function setNodeText(selector, value) {
  const node = document.querySelector(selector);
  if (node) {
    node.textContent = String(value || "").trim() || "-";
  }
}

function setActiveView(viewName) {
  if (viewName === "saved") {
    window.location.href = "/trainingen/opgeslagen";
    return;
  }
  if (viewName === "maker") {
    window.location.href = "/trainingen/maker";
    return;
  }
  const showMaker = viewName === "maker";
  const showSaved = viewName === "saved";
  if (trainingSavedPanel) {
    trainingSavedPanel.hidden = !showSaved;
  }
  if (trainingMakerPanel) {
    trainingMakerPanel.hidden = !showMaker;
  }
  document.querySelectorAll("[data-training-view]").forEach((button) => {
    button.classList.toggle("training-home-tile-active", button.dataset.trainingView === viewName);
  });
}

function getExerciseCategories() {
  return Array.from(new Set(exercises.map((exercise) => String(exercise.category || "").trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "nl")
  );
}

function renderExerciseFilters() {
  if (!trainingExerciseFilters) {
    return;
  }

  trainingExerciseFilters.replaceChildren();
  ["all", ...getExerciseCategories()].forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category === "all" ? "Alles" : category;
    option.selected = activeExerciseFilter === category;
    trainingExerciseFilters.append(option);
  });
}

function syncTrainingTitleWithDate() {
  if (!trainingDate || !trainingTitle) {
    return;
  }
  const nextAutoTitle = formatTrainingDateTitle(trainingDate.value);
  if (!nextAutoTitle) {
    return;
  }
  const currentTitle = trainingTitle.value.trim();
  if (!currentTitle || currentTitle === lastAutoTrainingTitle) {
    trainingTitle.value = nextAutoTitle;
  }
  lastAutoTrainingTitle = nextAutoTitle;
}

function initializeTrainingDate() {
  if (!trainingDate) {
    return;
  }
  if (!trainingDate.value) {
    trainingDate.value = new Date().toISOString().slice(0, 10);
  }
  syncTrainingTitleWithDate();
}

function openTrainingExercise(exerciseId) {
  const exercise = exercises.find((item) => String(item.id) === String(exerciseId));
  if (!exercise || !trainingExerciseModal) {
    return;
  }

  setNodeText("#trainingExerciseModalCategory", exercise.category || "Geen categorie");
  setNodeText("#trainingExerciseModalTitle", exercise.title || "Oefening");
  setNodeText("#trainingExerciseModalDescription", exercise.description);
  setNodeText("#trainingExerciseModalCoaching", exercise.coaching);
  setNodeText("#trainingExerciseModalMaterials", exercise.materials);
  setNodeText("#trainingExerciseModalDimensions", exercise.dimensions);

  if (trainingExerciseModalField) {
    const fieldSvg = String(exercise.fieldSvg || "").trim();
    trainingExerciseModalField.innerHTML = fieldSvg || '<div class="exercise-field-empty">Geen veldtekening beschikbaar</div>';
  }

  trainingExerciseModal.hidden = false;
}

function closeTrainingExercise() {
  if (trainingExerciseModal) {
    trainingExerciseModal.hidden = true;
  }
}

function renderSavedTrainings() {
  if (!trainingSavedList) {
    return;
  }
  trainingSavedList.replaceChildren();
  if (trainingSavedCount) {
    trainingSavedCount.textContent = String(savedTrainings.length);
  }
  if (trainingSavedEmpty) {
    trainingSavedEmpty.hidden = savedTrainings.length > 0;
  }

  savedTrainings.forEach((training) => {
    const card = document.createElement("article");
    card.className = "training-saved-card";

    const header = document.createElement("div");
    header.className = "training-saved-card-head";
    const titleBlock = document.createElement("div");
    titleBlock.append(
      makeText("h3", "", training.title || "Training"),
      makeText(
        "p",
        "feature-list-subtitle",
        [training.trainingDate, `${training.exerciseCount || training.exercises?.length || 0} oefeningen`].filter(Boolean).join(" | ")
      )
    );
    header.append(titleBlock);

    const list = document.createElement("ol");
    list.className = "training-saved-exercises";
    (training.exercises || []).forEach((exercise) => {
      const item = document.createElement("li");
      item.textContent = exercise.title || "Oefening";
      list.append(item);
    });

    card.append(header);
    if (training.notes) {
      card.append(makeText("p", "training-saved-notes", training.notes));
    }
    if (training.objective) {
      card.append(makeText("p", "training-saved-notes", `Doelstelling: ${training.objective}`));
    }
    card.append(list);
    trainingSavedList.append(card);
  });
}

function renderExerciseLibrary() {
  if (!trainingExerciseList) {
    return;
  }
  const query = normalizeSearch(trainingExerciseSearch?.value || "");
  const filtered = exercises
    .filter((exercise) => activeExerciseFilter === "all" || String(exercise.category || "").trim() === activeExerciseFilter)
    .filter((exercise) => !query || exerciseSearchText(exercise).includes(query));

  trainingExerciseList.replaceChildren();
  if (trainingExerciseEmpty) {
    trainingExerciseEmpty.hidden = filtered.length > 0;
  }

  filtered.forEach((exercise) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "training-exercise-row";
    row.draggable = true;
    row.dataset.exerciseId = String(exercise.id);
    row.append(
      makeText("span", "training-exercise-title", exercise.title || "Oefening"),
      makeText("span", "training-exercise-meta", exercise.category || "Geen categorie")
    );
    row.addEventListener("click", () => openTrainingExercise(exercise.id));
    row.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", String(exercise.id));
      event.dataTransfer?.setData("application/x-hws-exercise-id", String(exercise.id));
      event.dataTransfer.effectAllowed = "copy";
    });
    trainingExerciseList.append(row);
  });
}

function addExerciseToTraining(exerciseId, targetIndex = selectedExercises.length) {
  const exercise = exercises.find((item) => String(item.id) === String(exerciseId));
  if (!exercise) {
    return;
  }
  const selected = {
    instanceId: `${exercise.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    exerciseId: exercise.id,
    title: exercise.title || "Oefening",
    category: exercise.category || "",
    trainingExercise: exercise.trainingExercise || "",
    duration: exercise.duration || "",
    notes: "",
  };
  selectedExercises.splice(Math.max(0, targetIndex), 0, selected);
  renderSelectedExercises();
}

function moveSelectedExercise(fromIndex, toIndex) {
  if (fromIndex === null || fromIndex < 0 || fromIndex >= selectedExercises.length) {
    return;
  }
  const [item] = selectedExercises.splice(fromIndex, 1);
  const boundedIndex = Math.max(0, Math.min(toIndex, selectedExercises.length));
  selectedExercises.splice(boundedIndex, 0, item);
  renderSelectedExercises();
}

function renderSelectedExercises() {
  if (!trainingSelectedList) {
    return;
  }
  trainingSelectedList.replaceChildren();
  if (trainingDropEmpty) {
    trainingDropEmpty.hidden = selectedExercises.length > 0;
  }

  selectedExercises.forEach((exercise, index) => {
    const row = document.createElement("article");
    row.className = "training-selected-row";
    row.draggable = true;
    row.dataset.selectedIndex = String(index);

    const order = makeText("span", "training-selected-order", String(index + 1));
    const copy = document.createElement("div");
    copy.className = "training-selected-copy";
    copy.append(
      makeText("strong", "", exercise.title),
      makeText("span", "", exercise.category || "Geen categorie")
    );

    const actions = document.createElement("div");
    actions.className = "training-selected-actions";
    const removeButton = makeText("button", "subtle-button", "Verwijder");
    removeButton.type = "button";
    removeButton.addEventListener("click", () => {
      selectedExercises.splice(index, 1);
      renderSelectedExercises();
    });
    actions.append(removeButton);

    row.append(order, copy, actions);
    row.addEventListener("dragstart", (event) => {
      draggedSelectedIndex = index;
      event.dataTransfer?.setData("application/x-hws-selected-index", String(index));
      event.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      row.classList.add("training-selected-row-over");
    });
    row.addEventListener("dragleave", () => {
      row.classList.remove("training-selected-row-over");
    });
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      row.classList.remove("training-selected-row-over");
      const libraryExerciseId = event.dataTransfer?.getData("application/x-hws-exercise-id");
      if (libraryExerciseId) {
        addExerciseToTraining(libraryExerciseId, index);
        return;
      }
      moveSelectedExercise(draggedSelectedIndex, index);
      draggedSelectedIndex = null;
    });
    trainingSelectedList.append(row);
  });
}

async function saveTraining(event) {
  event.preventDefault();
  if (trainingFeedback) {
    trainingFeedback.textContent = "";
  }

  const payload = {
    trainingDate: trainingDate?.value || "",
    title: trainingTitle?.value || "",
    objective: trainingObjective?.value || "",
    notes: "",
    exercises: selectedExercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      duration: exercise.duration,
      notes: exercise.notes,
    })),
  };

  const response = await fetch("/api/trainingen", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": getCsrfToken(),
    },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  if (!response.ok) {
    if (trainingFeedback) {
      trainingFeedback.textContent = result.error || "Training opslaan mislukt.";
    }
    return;
  }

  savedTrainings = Array.isArray(result.trainings) ? result.trainings : [result.training, ...savedTrainings];
  selectedExercises = [];
  if (trainingTitle) {
    trainingTitle.value = "";
  }
  if (trainingObjective) {
    trainingObjective.value = "";
  }
  renderSelectedExercises();
  renderSavedTrainings();
  window.location.href = "/trainingen/opgeslagen";
}

document.querySelectorAll("[data-training-view]").forEach((button) => {
  button.addEventListener("click", () => setActiveView(button.dataset.trainingView || "saved"));
});

document.querySelectorAll("[data-close-training-exercise]").forEach((button) => {
  button.addEventListener("click", closeTrainingExercise);
});

trainingExerciseSearch?.addEventListener("input", renderExerciseLibrary);
trainingExerciseFilters?.addEventListener("change", () => {
  activeExerciseFilter = trainingExerciseFilters.value || "all";
  renderExerciseLibrary();
});
trainingDate?.addEventListener("change", syncTrainingTitleWithDate);
trainingBuilder?.addEventListener("submit", saveTraining);

trainingDropZone?.addEventListener("dragover", (event) => {
  event.preventDefault();
  trainingDropZone.classList.add("training-drop-zone-active");
});

trainingDropZone?.addEventListener("dragleave", (event) => {
  if (!trainingDropZone.contains(event.relatedTarget)) {
    trainingDropZone.classList.remove("training-drop-zone-active");
  }
});

trainingDropZone?.addEventListener("drop", (event) => {
  event.preventDefault();
  trainingDropZone.classList.remove("training-drop-zone-active");
  const libraryExerciseId = event.dataTransfer?.getData("application/x-hws-exercise-id") || event.dataTransfer?.getData("text/plain");
  if (libraryExerciseId) {
    addExerciseToTraining(libraryExerciseId);
    return;
  }
  const selectedIndex = event.dataTransfer?.getData("application/x-hws-selected-index");
  if (selectedIndex) {
    moveSelectedExercise(Number(selectedIndex), selectedExercises.length);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && trainingExerciseModal && !trainingExerciseModal.hidden) {
    closeTrainingExercise();
  }
});

renderSavedTrainings();
renderExerciseFilters();
initializeTrainingDate();
renderExerciseLibrary();
renderSelectedExercises();
