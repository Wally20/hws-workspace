const budgetRows = document.querySelector("#budgetRows");
const budgetRowTemplate = document.querySelector("#budgetRowTemplate");
const addBudgetLineButton = document.querySelector("#addBudgetLine");
const centerBudgetLinesButton = document.querySelector("#centerBudgetLines");
const budgetEmptyState = document.querySelector("#budgetEmptyState");
const budgetMessageTrainer = document.querySelector("#budgetMessageTrainer");
const budgetMessageOutput = document.querySelector("#budgetMessageOutput");
const copyBudgetMessageButton = document.querySelector("#copyBudgetMessage");
const budgetActivityOptionsData = document.querySelector("#budgetActivityOptionsData");
let budgetActivityOptionsByKey = {};
const budgetMessageTrainerOptions = budgetMessageTrainer
  ? Array.from(budgetMessageTrainer.options)
      .filter((option) => option.value)
      .map((option) => ({
        id: option.value,
        name: option.textContent?.trim() || "",
      }))
  : [];

if (budgetActivityOptionsData) {
  try {
    const parsedActivityOptions = JSON.parse(budgetActivityOptionsData.textContent || "[]");
    if (Array.isArray(parsedActivityOptions)) {
      budgetActivityOptionsByKey = parsedActivityOptions.reduce((mapping, option) => {
        if (option?.key) {
          mapping[option.key] = option;
        }
        return mapping;
      }, {});
    }
  } catch (error) {
    budgetActivityOptionsByKey = {};
  }
}

function parseBudgetAmount(value) {
  const cleaned = String(value || "")
    .trim()
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const amount = Number.parseFloat(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}

function formatBudgetAmount(value) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(Number.isFinite(value) ? value : 0);
}

function formatBudgetProposalAmount(value) {
  const amount = Number.isFinite(value) ? value : 0;
  if (Math.abs(amount % 1) < 0.005) {
    return `${Math.round(amount)},-`;
  }
  return new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getBudgetRowCount(row) {
  const activitySelect = row.querySelector("[data-budget-activity]");
  const selectedOption = activitySelect?.selectedOptions?.[0];
  const count = Number.parseInt(selectedOption?.dataset.count || "0", 10);
  return Number.isFinite(count) ? count : 0;
}

function getBudgetRows() {
  return Array.from(document.querySelectorAll("[data-budget-row]"));
}

function getBudgetRowGroupKey(row, rowIndex) {
  const groupName = row.querySelector("[data-budget-group]")?.value.trim().toLowerCase();
  return groupName || `row-${rowIndex}`;
}

function buildBudgetGroupSummaries(rows) {
  const groupSummaries = new Map();
  rows.forEach((row, rowIndex) => {
    const groupValue = row.querySelector("[data-budget-group]")?.value.trim();
    if (!groupValue) {
      return;
    }
    const groupKey = getBudgetRowGroupKey(row, rowIndex);
    const count = getBudgetRowCount(row);
    const incomeAmount = parseBudgetAmount(row.querySelector('input[name="income_amount"]')?.value);
    const incomeTotal = count * incomeAmount;
    const summary = groupSummaries.get(groupKey) || {
      leader: row,
      trainingCount: 0,
      incomeTotal: 0,
    };
    summary.trainingCount = Math.max(summary.trainingCount, count);
    summary.incomeTotal += incomeTotal;
    groupSummaries.set(groupKey, summary);
  });
  return groupSummaries;
}

function syncBudgetGroupDisplay(rows, groupSummaries) {
  rows.forEach((row, rowIndex) => {
    const groupValue = row.querySelector("[data-budget-group]")?.value.trim();
    const groupKey = getBudgetRowGroupKey(row, rowIndex);
    const summary = groupValue ? groupSummaries.get(groupKey) : null;
    const isLeader = Boolean(summary && summary.leader === row);
    const isFollower = Boolean(summary && summary.leader !== row);
    row.classList.toggle("budget-row-grouped", Boolean(summary));
    row.classList.toggle("budget-row-group-leader", isLeader);
    row.classList.toggle("budget-row-group-follower", isFollower);
  });
}

function updateBudgetRow(row, groupSummaries = new Map(), rowIndex = 0) {
  const count = getBudgetRowCount(row);
  const incomeAmount = parseBudgetAmount(row.querySelector('input[name="income_amount"]')?.value);
  const trainerAmount = parseBudgetAmount(row.querySelector('input[name="trainer_amount"]')?.value);
  const groupValue = row.querySelector("[data-budget-group]")?.value.trim();
  const groupKey = getBudgetRowGroupKey(row, rowIndex);
  const groupSummary = groupValue ? groupSummaries.get(groupKey) : null;
  const isFollower = Boolean(groupSummary && groupSummary.leader !== row);
  const trainerCost = groupSummary ? trainerAmount * groupSummary.trainingCount : count * trainerAmount;
  const incomeTotal = count * incomeAmount;
  const displayIncomeTotal = groupSummary ? groupSummary.incomeTotal : incomeTotal;
  const result = displayIncomeTotal - trainerCost;
  const countOutput = row.querySelector("[data-budget-count]");
  const resultNode = row.querySelector(".budget-result");

  if (countOutput) {
    countOutput.value = String(count);
    countOutput.textContent = String(count);
  }
  if (resultNode) {
    const strong = resultNode.querySelector("strong");
    if (strong) {
      strong.textContent = isFollower ? "" : formatBudgetAmount(result);
    }
    resultNode.title = isFollower ? "" : `${formatBudgetAmount(displayIncomeTotal)} omzet - ${formatBudgetAmount(trainerCost)} trainer`;
  }
}

function updateAllBudgetRows() {
  const rows = getBudgetRows();
  const groupSummaries = buildBudgetGroupSummaries(rows);
  syncBudgetGroupDisplay(rows, groupSummaries);
  syncBudgetActivityOptions(rows);
  rows.forEach((row, rowIndex) => {
    updateBudgetRow(row, groupSummaries, rowIndex);
  });
  syncBudgetMessageTrainerOptions(rows);
  updateBudgetTrainerMessage();
}

function syncBudgetMessageTrainerOptions(rows = getBudgetRows()) {
  if (!budgetMessageTrainer) {
    return;
  }

  const currentValue = budgetMessageTrainer.value;
  const groupDetails = getBudgetMessageGroupDetails(rows);
  const budgetTrainerIds = new Set(
    rows
      .map((row, rowIndex) => getBudgetEffectiveTrainerId(row, rowIndex, groupDetails))
      .filter(Boolean)
  );
  const availableTrainers = budgetMessageTrainerOptions.filter((trainer) => budgetTrainerIds.has(trainer.id));
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = availableTrainers.length > 0 ? "Kies trainer" : "Geen trainers in begroting";
  budgetMessageTrainer.replaceChildren(placeholder);

  availableTrainers.forEach((trainer) => {
    const option = document.createElement("option");
    option.value = trainer.id;
    option.textContent = trainer.name;
    budgetMessageTrainer.appendChild(option);
  });

  budgetMessageTrainer.value = budgetTrainerIds.has(currentValue) ? currentValue : "";
}

function getBudgetTrainerName(trainerId) {
  if (!budgetMessageTrainer || !trainerId) {
    return "";
  }
  const trainerOption = Array.from(budgetMessageTrainer.options).find((option) => option.value === trainerId);
  return trainerOption?.textContent?.trim() || "";
}

function getBudgetFirstName(fullName) {
  return String(fullName || "").trim().split(/\s+/)[0] || "trainer";
}

function getBudgetMessageGroupDetails(rows) {
  const detailsByGroup = new Map();
  rows.forEach((row, rowIndex) => {
    const groupValue = row.querySelector("[data-budget-group]")?.value.trim();
    if (!groupValue) {
      return;
    }
    const groupKey = getBudgetRowGroupKey(row, rowIndex);
    const details = detailsByGroup.get(groupKey) || {
      trainerId: "",
      amount: 0,
    };
    const trainerId = row.querySelector('select[name="trainer_id"]')?.value || "";
    const amount = parseBudgetAmount(row.querySelector('input[name="trainer_amount"]')?.value);
    if (!details.trainerId && trainerId) {
      details.trainerId = trainerId;
    }
    if (!details.amount && amount > 0) {
      details.amount = amount;
    }
    detailsByGroup.set(groupKey, details);
  });
  return detailsByGroup;
}

function getBudgetEffectiveTrainerId(row, rowIndex, groupDetails) {
  const ownTrainerId = row.querySelector('select[name="trainer_id"]')?.value || "";
  const groupValue = row.querySelector("[data-budget-group]")?.value.trim();
  if (!groupValue) {
    return ownTrainerId;
  }
  const groupKey = getBudgetRowGroupKey(row, rowIndex);
  return groupDetails.get(groupKey)?.trainerId || ownTrainerId;
}

function getBudgetActivityOption(row) {
  const activityKey = row.querySelector("[data-budget-activity]")?.value || "";
  const option = budgetActivityOptionsByKey[activityKey];
  if (option) {
    return option;
  }
  const selectedOption = row.querySelector("[data-budget-activity]")?.selectedOptions?.[0];
  return {
    key: activityKey,
    club: "",
    activityTitle: selectedOption?.textContent?.replace(/\s*\(\d+x\)\s*$/, "").trim() || "",
    scheduleSlots: [],
  };
}

function getBudgetProposalItemsForRow(row, rowIndex, groupDetails) {
  const option = getBudgetActivityOption(row);
  const groupValue = row.querySelector("[data-budget-group]")?.value.trim();
  const groupKey = groupValue ? getBudgetRowGroupKey(row, rowIndex) : "";
  const ownAmount = parseBudgetAmount(row.querySelector('input[name="trainer_amount"]')?.value);
  const amount = groupKey ? groupDetails.get(groupKey)?.amount || 0 : ownAmount;
  const slots = Array.isArray(option.scheduleSlots) && option.scheduleSlots.length > 0
    ? option.scheduleSlots
    : [{ weekday: "Overig", weekdayIndex: 99, startTime: "", endTime: "" }];
  const titleParts = [option.club, option.activityTitle].filter(Boolean);
  const title = titleParts.join(" ").trim() || option.label || "Training";

  return slots.map((slot) => ({
    weekday: slot.weekday || "Overig",
    weekdayIndex: Number.isFinite(Number(slot.weekdayIndex)) ? Number(slot.weekdayIndex) : 99,
    startTime: slot.startTime || "",
    endTime: slot.endTime || "",
    title,
    amount,
    amountKey: groupKey || `row-${rowIndex}`,
  }));
}

function buildBudgetTrainerMessage(trainerId) {
  const trainerName = getBudgetTrainerName(trainerId);
  if (!trainerId || !trainerName) {
    return "";
  }

  const rows = getBudgetRows();
  const groupDetails = getBudgetMessageGroupDetails(rows);
  const itemsByDay = new Map();

  rows.forEach((row, rowIndex) => {
    const rowTrainerId = getBudgetEffectiveTrainerId(row, rowIndex, groupDetails);
    const activityKey = row.querySelector("[data-budget-activity]")?.value || "";
    if (rowTrainerId !== trainerId || !activityKey) {
      return;
    }
    getBudgetProposalItemsForRow(row, rowIndex, groupDetails).forEach((item) => {
      const dayKey = `${item.weekdayIndex}|${item.weekday}`;
      const day = itemsByDay.get(dayKey) || {
        weekday: item.weekday,
        weekdayIndex: item.weekdayIndex,
        items: [],
        amountEntries: new Map(),
        seenItems: new Set(),
      };
      const timeLabel = item.startTime && item.endTime ? `${item.startTime}-${item.endTime}` : item.startTime;
      const itemKey = `${item.title}|${timeLabel}`;
      if (!day.seenItems.has(itemKey)) {
        day.items.push({ ...item, timeLabel });
        day.seenItems.add(itemKey);
      }
      if (item.amount > 0 && !day.amountEntries.has(item.amountKey)) {
        day.amountEntries.set(item.amountKey, item.amount);
      }
      itemsByDay.set(dayKey, day);
    });
  });

  const sortedDays = Array.from(itemsByDay.values()).sort((a, b) => a.weekdayIndex - b.weekdayIndex);
  const lines = [
    `Hey ${getBudgetFirstName(trainerName)},`,
    "",
    "Hierbij jouw voorstel voor aankomend seizoen:",
    "",
  ];

  if (sortedDays.length === 0) {
    lines.push("Er staan nog geen begrotingsregels voor jou klaar.");
  } else {
    sortedDays.forEach((day, dayIndex) => {
      if (dayIndex > 0) {
        lines.push("");
      }
      lines.push(`${day.weekday}:`);
      day.items
        .sort((a, b) => `${a.startTime} ${a.title}`.localeCompare(`${b.startTime} ${b.title}`, "nl"))
        .forEach((item) => {
          lines.push(`- ${item.title}${item.timeLabel ? ` ${item.timeLabel}` : ""}`);
        });
      const amountLabels = Array.from(day.amountEntries.values()).map(formatBudgetProposalAmount);
      if (amountLabels.length === 1) {
        lines.push(`Vergoeding: ${amountLabels[0]}`);
      } else if (amountLabels.length > 1) {
        lines.push(`Vergoeding: ${amountLabels.join(" + ")}`);
      }
    });
  }

  lines.push(
    "",
    "Alle bedragen zijn inclusief reiskosten.",
    "",
    "Ik hoor graag wat je ervan vindt. Zou jij mij zo snel mogelijk een akkoord kunnen geven?"
  );
  return lines.join("\n");
}

function updateBudgetTrainerMessage() {
  if (!budgetMessageOutput || !budgetMessageTrainer) {
    return;
  }
  budgetMessageOutput.value = buildBudgetTrainerMessage(budgetMessageTrainer.value);
}

function syncBudgetActivityOptions(rows = getBudgetRows()) {
  const selectedActivityKeys = new Set(
    rows
      .map((row) => row.querySelector("[data-budget-activity]")?.value)
      .filter(Boolean)
  );

  rows.forEach((row) => {
    const activitySelect = row.querySelector("[data-budget-activity]");
    if (!activitySelect) {
      return;
    }

    const currentValue = activitySelect.value;
    Array.from(activitySelect.options).forEach((option) => {
      if (!option.value) {
        option.hidden = false;
        option.disabled = false;
        option.style.display = "";
        return;
      }

      const isSelectedInOtherRow = selectedActivityKeys.has(option.value) && option.value !== currentValue;
      option.hidden = isSelectedInOtherRow;
      option.disabled = isSelectedInOtherRow;
      option.style.display = isSelectedInOtherRow ? "none" : "";
    });
  });
}

function updateBudgetEmptyState() {
  if (!budgetEmptyState || !budgetRows) {
    return;
  }
  budgetEmptyState.hidden = Boolean(budgetRows.querySelector("[data-budget-row]"));
}

function bindBudgetRow(row) {
  row.addEventListener("input", updateAllBudgetRows);
  row.addEventListener("change", updateAllBudgetRows);
  row.querySelector("[data-remove-budget-row]")?.addEventListener("click", () => {
    row.remove();
    updateBudgetEmptyState();
    updateAllBudgetRows();
  });
  updateAllBudgetRows();
}

centerBudgetLinesButton?.addEventListener("click", () => {
  const selectedRows = getBudgetRows().filter((row) => row.querySelector("[data-budget-row-select]")?.checked);
  if (selectedRows.length < 2) {
    return;
  }
  const groupId = `center-${Date.now()}`;
  selectedRows.forEach((row, index) => {
    const groupInput = row.querySelector("[data-budget-group]");
    if (groupInput) {
      groupInput.value = groupId;
    }
    const checkbox = row.querySelector("[data-budget-row-select]");
    if (checkbox) {
      checkbox.checked = false;
    }
    if (index > 0) {
      const leaderTrainer = selectedRows[0].querySelector('select[name="trainer_id"]');
      const leaderAmount = selectedRows[0].querySelector('input[name="trainer_amount"]');
      const trainer = row.querySelector('select[name="trainer_id"]');
      const amount = row.querySelector('input[name="trainer_amount"]');
      if (leaderTrainer && trainer) {
        trainer.value = leaderTrainer.value;
      }
      if (leaderAmount && amount) {
        amount.value = "";
      }
    }
  });
  updateAllBudgetRows();
});

addBudgetLineButton?.addEventListener("click", () => {
  if (!budgetRows || !budgetRowTemplate) {
    return;
  }
  const fragment = budgetRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector("[data-budget-row]");
  budgetRows.appendChild(fragment);
  if (row) {
    bindBudgetRow(row);
    row.querySelector("select")?.focus();
  }
  updateBudgetEmptyState();
  updateAllBudgetRows();
});

document.querySelectorAll("[data-budget-row]").forEach(bindBudgetRow);
budgetMessageTrainer?.addEventListener("change", updateBudgetTrainerMessage);
copyBudgetMessageButton?.addEventListener("click", async () => {
  updateBudgetTrainerMessage();
  const message = budgetMessageOutput?.value || "";
  if (!message) {
    return;
  }
  try {
    await navigator.clipboard.writeText(message);
    copyBudgetMessageButton.textContent = "Gekopieerd";
    window.setTimeout(() => {
      copyBudgetMessageButton.textContent = "Kopiëren";
    }, 1600);
  } catch (error) {
    budgetMessageOutput?.focus();
    budgetMessageOutput?.select();
  }
});
updateBudgetEmptyState();
updateAllBudgetRows();
