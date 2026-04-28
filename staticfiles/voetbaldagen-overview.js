(() => {
  const countElements = Array.from(document.querySelectorAll("[data-football-registration-count]"));
  const playbookIds = countElements
    .map((element) => String(element.dataset.playbookId || "").trim())
    .filter(Boolean);

  if (!playbookIds.length) {
    return;
  }

  const loadCounts = async () => {
    try {
      const params = new URLSearchParams({ playbook_ids: playbookIds.join(",") });
      const response = await fetch(`/api/voetbaldagen/registration-counts?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok || !payload.counts) {
        return;
      }

      countElements.forEach((element) => {
        const playbookId = String(element.dataset.playbookId || "").trim();
        if (Object.prototype.hasOwnProperty.call(payload.counts, playbookId)) {
          element.textContent = String(payload.counts[playbookId] || 0);
        }
      });
    } catch (error) {
      console.error("Aanmeldingen voor voetbaldagen ophalen mislukt", error);
    }
  };

  loadCounts();
})();
