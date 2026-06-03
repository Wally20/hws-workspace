const contractLineRows = document.querySelector("#contractLineRows");
const contractLineTemplate = document.querySelector("#contractLineRowTemplate");
const addContractLineButton = document.querySelector("#addContractLine");
const contractCostRows = document.querySelector("#contractCostRows");
const contractCostTemplate = document.querySelector("#contractCostRowTemplate");
const addContractCostLineButton = document.querySelector("#addContractCostLine");
const previousContractsNode = document.querySelector("#previousContracts");
const contractAgendaAttachmentSearch = document.querySelector("#contractAgendaAttachmentSearch");
const contractAgendaAttachmentOptions = document.querySelector("#contractAgendaAttachmentOptions");

let previousContracts = [];
try {
  previousContracts = JSON.parse(previousContractsNode?.textContent || "[]");
} catch (error) {
  previousContracts = [];
}

const parseMoney = (value) => {
  const cleaned = String(value || "")
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value) => value.toFixed(2).replace(".", ",");

const setFieldValue = (name, value) => {
  const field = document.querySelector(`[name="${name}"]`);
  if (field) {
    field.value = value ?? "";
    field.dispatchEvent(new Event("input", { bubbles: true }));
  }
};

const refreshRemoveButtons = () => {
  const rows = Array.from(contractLineRows?.querySelectorAll("[data-contract-line-row]") || []);
  rows.forEach((row) => {
    const button = row.querySelector("[data-remove-contract-row]");
    if (button) {
      button.disabled = rows.length <= 1;
    }
  });
  const costRows = Array.from(contractCostRows?.querySelectorAll("[data-contract-cost-row]") || []);
  costRows.forEach((row) => {
    const button = row.querySelector("[data-remove-contract-cost-row]");
    if (button) {
      button.disabled = costRows.length <= 1;
    }
  });
};

const appendContractLine = (line = {}) => {
  const row = contractLineTemplate?.content.firstElementChild.cloneNode(true);
  if (!row || !contractLineRows) {
    return;
  }
  row.querySelector('input[name="line_day"]').value = line.day || "";
  row.querySelector('input[name="line_time"]').value = line.time || "";
  row.querySelector('input[name="line_team"]').value = line.team || "";
  row.querySelector('input[name="line_training_type"]').value = line.trainingType || "";
  contractLineRows.append(row);
  refreshRemoveButtons();
};

const replaceContractLines = (lines) => {
  contractLineRows?.querySelectorAll("[data-contract-line-row]").forEach((row) => row.remove());
  const safeLines = Array.isArray(lines) && lines.length ? lines : [{}];
  safeLines.forEach((line) => appendContractLine(line));
  updateCountFromRows();
};

const updateCostLineTotal = (row) => {
  const priceInput = row?.querySelector("[data-contract-cost-price]");
  const countInput = row?.querySelector("[data-contract-cost-count]");
  const totalInput = row?.querySelector("[data-contract-cost-total]");
  if (!priceInput || !countInput || !totalInput) {
    return;
  }
  const total = parseMoney(priceInput.value) * Number(countInput.value || 0);
  if (total > 0) {
    totalInput.value = formatMoney(total);
  }
};

const appendContractCostLine = (line = {}) => {
  const row = contractCostTemplate?.content.firstElementChild.cloneNode(true);
  if (!row || !contractCostRows) {
    return;
  }
  row.querySelector('input[name="cost_description"]').value = line.description || "";
  row.querySelector('input[name="cost_price_per_training"]').value = line.pricePerTraining || "";
  row.querySelector('input[name="cost_training_count"]').value = line.trainingCount || "";
  row.querySelector('input[name="cost_total_amount"]').value = line.totalAmount || "";
  contractCostRows.append(row);
  updateCostLineTotal(row);
  refreshRemoveButtons();
};

const replaceContractCostLines = (lines) => {
  contractCostRows?.querySelectorAll("[data-contract-cost-row]").forEach((row) => row.remove());
  const safeLines = Array.isArray(lines) && lines.length ? lines : [{}];
  safeLines.forEach((line) => appendContractCostLine(line));
};

const updateCountFromRows = () => {
  contractCostRows?.querySelectorAll("[data-contract-cost-row]").forEach((row) => updateCostLineTotal(row));
};

addContractLineButton?.addEventListener("click", () => {
  appendContractLine();
});

addContractCostLineButton?.addEventListener("click", () => {
  appendContractCostLine();
});

contractLineRows?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-contract-row]");
  if (!removeButton) {
    return;
  }
  const row = removeButton.closest("[data-contract-line-row]");
  row?.remove();
  refreshRemoveButtons();
  updateCountFromRows();
});

contractCostRows?.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-contract-cost-row]");
  if (!removeButton) {
    return;
  }
  const row = removeButton.closest("[data-contract-cost-row]");
  row?.remove();
  refreshRemoveButtons();
});

contractLineRows?.addEventListener("input", () => {
  updateCountFromRows();
});

contractCostRows?.addEventListener("input", (event) => {
  const row = event.target.closest("[data-contract-cost-row]");
  updateCostLineTotal(row);
});

document.querySelectorAll("[data-reuse-contract]").forEach((select) => {
  select.addEventListener("change", () => {
    const contract = previousContracts.find((item) => String(item.id) === select.value);
    if (!contract) {
      return;
    }
    if (select.dataset.reuseContract === "trainingLines") {
      replaceContractLines(contract.trainingLines || []);
    }
    if (select.dataset.reuseContract === "meta") {
      setFieldValue("title", contract.title || "");
      setFieldValue("club_address", contract.clubAddress || "");
      setFieldValue("season", contract.season || "");
      setFieldValue("start_date", contract.startDate || "");
      setFieldValue("end_date", contract.endDate || "");
    }
    if (select.dataset.reuseContract === "costs") {
      replaceContractCostLines(contract.costLines || []);
      setFieldValue("notice_period", contract.noticePeriod || "");
    }
    if (select.dataset.reuseContract === "trainingExecution") {
      setFieldValue("training_execution_summary", contract.trainingExecutionSummary || "");
      setFieldValue("training_execution_details", contract.trainingExecutionDetails || "");
    }
    if (select.dataset.reuseContract === "extraActivities") {
      setFieldValue("extra_activities", contract.extraActivities || "");
    }
    select.value = "";
  });
});

contractAgendaAttachmentSearch?.addEventListener("input", () => {
  const query = contractAgendaAttachmentSearch.value.trim().toLowerCase();
  contractAgendaAttachmentOptions?.querySelectorAll("[data-contract-agenda-option]").forEach((option) => {
    const haystack = option.dataset.search || option.textContent?.toLowerCase() || "";
    option.hidden = Boolean(query) && !haystack.includes(query);
  });
});

refreshRemoveButtons();
updateCountFromRows();
