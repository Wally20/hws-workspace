const exerciseVideoSearch = document.querySelector("#exerciseVideoSearch");
const exerciseVideoEmpty = document.querySelector("#exerciseVideoEmpty");

function normalizeExerciseVideoSearch(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function filterExerciseVideoRows() {
  const query = normalizeExerciseVideoSearch(exerciseVideoSearch?.value || "");
  let visibleCount = 0;
  document.querySelectorAll("[data-exercise-video-row]").forEach((row) => {
    const searchText = normalizeExerciseVideoSearch(row.dataset.search || row.textContent || "");
    const matches = !query || searchText.includes(query);
    row.hidden = !matches;
    if (matches) {
      visibleCount += 1;
    }
  });
  if (exerciseVideoEmpty) {
    exerciseVideoEmpty.hidden = visibleCount > 0;
  }
}

document.querySelectorAll(".exercise-video-file-button input").forEach((input) => {
  input.addEventListener("change", () => {
    const label = input.closest(".exercise-video-file-button")?.querySelector("span");
    const fileName = input.files?.[0]?.name || "Video kiezen";
    if (label) {
      label.textContent = fileName;
    }
  });
});

document.querySelectorAll(".exercise-video-form").forEach((form) => {
  form.addEventListener("submit", () => {
    const button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = "Uploaden...";
    }
  });
});

document.querySelectorAll(".exercise-video-delete-form").forEach((form) => {
  form.addEventListener("submit", (event) => {
    if (!window.confirm("Weet je zeker dat je deze video wilt verwijderen?")) {
      event.preventDefault();
    }
  });
});

exerciseVideoSearch?.addEventListener("input", filterExerciseVideoRows);
