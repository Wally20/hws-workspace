(() => {
  const page = document.querySelector("[data-downloads-page]");
  if (!page) {
    return;
  }

  const list = page.querySelector("[data-download-list]");
  const rows = [...page.querySelectorAll("[data-download-row]")];
  const searchInput = page.querySelector("[data-download-search]");
  const categorySelect = page.querySelector("[data-download-category]");
  const statusSelect = page.querySelector("[data-download-status]");
  const fromInput = page.querySelector("[data-download-from]");
  const toInput = page.querySelector("[data-download-to]");
  const sortSelect = page.querySelector("[data-download-sort]");
  const selectVisibleButton = page.querySelector("[data-select-visible]");
  const clearSelectionButton = page.querySelector("[data-clear-selection]");
  const selectionButton = page.querySelector("[data-download-selection]");
  const selectionCount = page.querySelector("[data-selection-count]");
  const totalCount = page.querySelector("[data-total-count]");
  const downloadedCount = page.querySelector("[data-downloaded-count]");
  const noResults = page.querySelector("[data-download-no-results]");
  const feedback = page.querySelector("[data-download-feedback]");
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || "";

  const normalizeText = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const rowDate = (row) => {
    const date = new Date(row.dataset.updated || "");
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const localDateKey = (date) => {
    if (!date) {
      return "";
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const showFeedback = (message, isError = false) => {
    if (!feedback) {
      return;
    }
    feedback.textContent = message;
    feedback.classList.toggle("is-error", isError);
    feedback.hidden = !message;
  };

  const selectedRows = () =>
    rows.filter((row) => row.querySelector("[data-file-select]")?.checked);

  const updateSelection = () => {
    const count = selectedRows().length;
    if (selectionCount) {
      selectionCount.textContent = `${count} geselecteerd`;
    }
    if (selectionButton) {
      selectionButton.disabled = count === 0;
    }
  };

  const updateDownloadedCount = () => {
    if (downloadedCount) {
      downloadedCount.textContent = String(rows.filter((row) => row.dataset.downloaded === "1").length);
    }
  };

  const applyFilters = () => {
    const query = normalizeText(searchInput?.value);
    const category = categorySelect?.value || "";
    const status = statusSelect?.value || "";
    const fromDate = fromInput?.value || "";
    const toDate = toInput?.value || "";
    let visibleCount = 0;

    rows.forEach((row) => {
      const searchValue = normalizeText(row.dataset.searchValue);
      const downloaded = row.dataset.downloaded === "1";
      const dateKey = localDateKey(rowDate(row));
      const matches =
        (!query || searchValue.includes(query)) &&
        (!category || row.dataset.category === category) &&
        (!status || (status === "downloaded" ? downloaded : !downloaded)) &&
        (!fromDate || (dateKey && dateKey >= fromDate)) &&
        (!toDate || (dateKey && dateKey <= toDate));
      row.hidden = !matches;
      if (matches) {
        visibleCount += 1;
      }
    });

    if (totalCount) {
      totalCount.textContent = String(visibleCount);
    }
    if (noResults) {
      noResults.hidden = visibleCount !== 0;
    }
  };

  const sortRows = () => {
    if (!list) {
      return;
    }
    const direction = sortSelect?.value || "newest";
    const sorted = [...rows].sort((first, second) => {
      if (direction === "name") {
        return String(first.dataset.title || "").localeCompare(String(second.dataset.title || ""), "nl", {
          sensitivity: "base",
        });
      }
      const firstTime = rowDate(first)?.getTime() || 0;
      const secondTime = rowDate(second)?.getTime() || 0;
      return direction === "oldest" ? firstTime - secondTime : secondTime - firstTime;
    });
    sorted.forEach((row) => list.append(row));
  };

  const getFilename = (response, fallback) => {
    const disposition = response.headers.get("Content-Disposition") || "";
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (encoded) {
      return decodeURIComponent(encoded[1].replace(/"/g, ""));
    }
    const regular = disposition.match(/filename="?([^";]+)"?/i);
    return regular ? regular[1] : fallback;
  };

  const saveBlob = (blob, filename) => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  };

  const responseError = async (response, fallback) => {
    const payload = await response.json().catch(() => ({}));
    return payload.error || fallback;
  };

  const markDownloaded = (row) => {
    row.dataset.downloaded = "1";
    row.classList.add("is-downloaded");
    const label = row.querySelector("[data-file-status-label]");
    if (label) {
      label.textContent = "Gedownload";
    }
  };

  rows.forEach((row) => {
    row.querySelector("[data-file-select]")?.addEventListener("change", updateSelection);
    const downloadLink = row.querySelector("[data-file-download]");
    downloadLink?.addEventListener("click", async (event) => {
      event.preventDefault();
      if (downloadLink.classList.contains("is-loading")) {
        return;
      }
      downloadLink.classList.add("is-loading");
      downloadLink.textContent = "Bezig…";
      showFeedback("");
      try {
        const response = await fetch(downloadLink.href, { credentials: "same-origin" });
        if (!response.ok) {
          throw new Error(await responseError(response, "Het bestand kon niet worden gedownload."));
        }
        saveBlob(await response.blob(), getFilename(response, "hws-bestand"));
        markDownloaded(row);
        updateDownloadedCount();
        applyFilters();
        showFeedback("Het bestand is gedownload.");
      } catch (error) {
        showFeedback(error.message || "Het bestand kon niet worden gedownload.", true);
      } finally {
        downloadLink.classList.remove("is-loading");
        downloadLink.textContent = "Download";
      }
    });
  });

  [searchInput, categorySelect, statusSelect, fromInput, toInput].forEach((control) => {
    control?.addEventListener(control === searchInput ? "input" : "change", applyFilters);
  });

  sortSelect?.addEventListener("change", () => {
    sortRows();
    applyFilters();
  });

  selectVisibleButton?.addEventListener("click", () => {
    rows.forEach((row) => {
      const checkbox = row.querySelector("[data-file-select]");
      if (checkbox && !row.hidden) {
        checkbox.checked = true;
      }
    });
    updateSelection();
  });

  clearSelectionButton?.addEventListener("click", () => {
    rows.forEach((row) => {
      const checkbox = row.querySelector("[data-file-select]");
      if (checkbox) {
        checkbox.checked = false;
      }
    });
    updateSelection();
  });

  selectionButton?.addEventListener("click", async () => {
    const selection = selectedRows();
    if (!selection.length) {
      return;
    }
    const originalText = selectionButton.textContent;
    selectionButton.disabled = true;
    selectionButton.textContent = "ZIP maken…";
    showFeedback("");
    try {
      const response = await fetch("/downloads/selectie", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ keys: selection.map((row) => row.dataset.fileKey) }),
      });
      if (!response.ok) {
        throw new Error(await responseError(response, "De ZIP-download kon niet worden gemaakt."));
      }
      saveBlob(await response.blob(), getFilename(response, "hws-downloads.zip"));
      selection.forEach((row) => {
        markDownloaded(row);
        const checkbox = row.querySelector("[data-file-select]");
        if (checkbox) {
          checkbox.checked = false;
        }
      });
      updateSelection();
      updateDownloadedCount();
      applyFilters();
      showFeedback(`${selection.length} bestanden zijn als ZIP gedownload.`);
    } catch (error) {
      showFeedback(error.message || "De ZIP-download kon niet worden gemaakt.", true);
    } finally {
      selectionButton.textContent = originalText;
      updateSelection();
    }
  });

  sortRows();
  applyFilters();
  updateSelection();
})();
