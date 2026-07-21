const trainerCreateModal = document.querySelector("#trainerCreateModal");
const trainerDetailModal = document.querySelector("#trainerDetailModal");
const openTrainerCreateModal = document.querySelector("#openTrainerCreateModal");
const trainerTileButtons = document.querySelectorAll("[data-open-trainer-detail='1']");
const teamSearchInput = document.querySelector("#teamSearchInput");
const previewFirstName = document.querySelector("#trainerFirstName");
const previewLastName = document.querySelector("#trainerLastName");
const previewSystemRole = document.querySelector("#trainerSystemRole");
const inviteLinkField = document.querySelector("#inviteLinkField");
const copyInviteLinkButton = document.querySelector("#copyInviteLinkButton");
const trainerDeleteForm = document.querySelector("#trainerDeleteForm");
const trainerDetailTabs = document.querySelectorAll("[data-team-detail-tab]");
const trainerDetailPanels = document.querySelectorAll("[data-team-detail-panel]");
const trainerProfileOnlySections = document.querySelectorAll("[data-trainer-profile-only]");
const trainerFeeRows = document.querySelector("#trainerFeeRows");
const trainerFeeRowTemplate = document.querySelector("#trainerFeeRowTemplate");
const addTrainerFeeRowButton = document.querySelector("#addTrainerFeeRow");
const groupTrainerFeeRowsButton = document.querySelector("#groupTrainerFeeRows");
const trainerFeeTotal = document.querySelector("#trainerFeeTotal");
const trainerFeeAgendaActivityOptionsNode = document.querySelector("#trainerFeeAgendaActivityOptions");
const trainerFeeClubOptionsByTypeNode = document.querySelector("#trainerFeeClubOptionsByType");
const profileTrainerFeesDataNode = document.querySelector("#profileTrainerFeesData");
let trainerFeeAgendaActivityOptions = {};
let trainerFeeClubOptionsByType = {};
const TRAINER_FEE_DAY_TYPE = "voetbaldag_summercamp";
const TRAINER_FEE_ALL_CLUBS = "Alle clubs";
const TRAINER_FEE_ALL_ACTIVITIES = "Alle activiteiten";

if (trainerFeeAgendaActivityOptionsNode) {
  try {
    const parsedOptions = JSON.parse(trainerFeeAgendaActivityOptionsNode.textContent || "{}");
    trainerFeeAgendaActivityOptions = parsedOptions && typeof parsedOptions === "object" ? parsedOptions : {};
  } catch (_error) {
    trainerFeeAgendaActivityOptions = {};
  }
}

if (trainerFeeClubOptionsByTypeNode) {
  try {
    const parsedClubOptions = JSON.parse(trainerFeeClubOptionsByTypeNode.textContent || "{}");
    trainerFeeClubOptionsByType = parsedClubOptions && typeof parsedClubOptions === "object" ? parsedClubOptions : {};
  } catch (_error) {
    trainerFeeClubOptionsByType = {};
  }
}

function setTrainerModalOpen(modal, isOpen) {
  if (!modal) {
    return;
  }

  modal.hidden = !isOpen;
  document.body.style.overflow = isOpen ? "hidden" : "";
}

function closeAllTrainerModals() {
  setTrainerModalOpen(trainerCreateModal, false);
  setTrainerModalOpen(trainerDetailModal, false);
}

function setDetailField(id, value) {
  const node = document.querySelector(id);
  if (node) {
    node.textContent = value;
  }
}

function setDetailInputValue(id, value) {
  const node = document.querySelector(id);
  if (node) {
    node.value = value;
  }
}

function updateTrainerPreview() {
  const firstName = previewFirstName?.value.trim() || "Nieuw";
  const lastName = previewLastName?.value.trim() || "Lid";
  const systemRole = previewSystemRole?.value || "Functie";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  setDetailField("#trainerPreviewName", `${firstName} ${lastName}`.trim());
  setDetailField("#trainerPreviewRole", systemRole);
  setDetailField("#trainerPreviewAvatar", initials || "NL");
  setDetailField("#trainerPreviewRolePill", systemRole);
}

function setTrainerDetailTab(activeTab) {
  trainerDetailTabs.forEach((button) => {
    const isActive = button.dataset.teamDetailTab === activeTab;
    button.classList.toggle("team-detail-tab-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  trainerDetailPanels.forEach((panel) => {
    const isActive = panel.dataset.teamDetailPanel === activeTab;
    panel.hidden = !isActive;
    panel.classList.toggle("team-detail-panel-hidden", !isActive);
  });
}

function updateTrainerProfileSections(systemRole) {
  const isTrainer = String(systemRole || "").trim().toLowerCase() === "trainer";
  trainerProfileOnlySections.forEach((section) => {
    section.hidden = !isTrainer;
  });

  if (!isTrainer) {
    setTrainerDetailTab("gegevens");
  }
}

function setTrainerFeeActivityOptions(activityInput, club, selectedActivity = "", feeType = "") {
  if (!(activityInput instanceof HTMLSelectElement)) {
    return;
  }

  const normalizedSelectedActivity = feeType === TRAINER_FEE_DAY_TYPE ? TRAINER_FEE_ALL_ACTIVITIES : selectedActivity;
  const clubOptions = feeType === TRAINER_FEE_DAY_TYPE
    ? [{ value: TRAINER_FEE_ALL_ACTIVITIES, label: TRAINER_FEE_ALL_ACTIVITIES }]
    : (Array.isArray(trainerFeeAgendaActivityOptions[club]) ? trainerFeeAgendaActivityOptions[club] : []);
  activityInput.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = feeType === TRAINER_FEE_DAY_TYPE || club ? "Selecteer activiteit" : "Selecteer eerst een club";
  activityInput.appendChild(placeholder);

  clubOptions.forEach((option) => {
    const value = option.value || "";
    if (!value) {
      return;
    }
    const node = document.createElement("option");
    node.value = value;
    node.textContent = option.label || value;
    activityInput.appendChild(node);
  });

  if (normalizedSelectedActivity && !clubOptions.some((option) => option.value === normalizedSelectedActivity)) {
    const selectedNode = document.createElement("option");
    selectedNode.value = normalizedSelectedActivity;
    selectedNode.textContent = normalizedSelectedActivity;
    activityInput.appendChild(selectedNode);
  }

  activityInput.value = normalizedSelectedActivity || (clubOptions.length === 1 ? clubOptions[0].value : "");
}

function setTrainerFeeClubOptions(clubInput, feeType, selectedClub = "") {
  if (!(clubInput instanceof HTMLSelectElement)) {
    return;
  }

  const normalizedSelectedClub = feeType === TRAINER_FEE_DAY_TYPE ? TRAINER_FEE_ALL_CLUBS : selectedClub;
  const clubOptions = Array.isArray(trainerFeeClubOptionsByType[feeType]) ? trainerFeeClubOptionsByType[feeType] : [];
  const fallbackOptions = Object.values(trainerFeeClubOptionsByType).flat().filter(Boolean);
  const options = feeType === TRAINER_FEE_DAY_TYPE
    ? [TRAINER_FEE_ALL_CLUBS]
    : (clubOptions.length ? clubOptions : Array.from(new Set(fallbackOptions)));
  clubInput.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = feeType ? "Selecteer club" : "Selecteer eerst een type";
  clubInput.appendChild(placeholder);

  options.forEach((club) => {
    const value = String(club || "").trim();
    if (!value) {
      return;
    }
    const node = document.createElement("option");
    node.value = value;
    node.textContent = value;
    clubInput.appendChild(node);
  });

  if (normalizedSelectedClub && !options.includes(normalizedSelectedClub)) {
    const selectedNode = document.createElement("option");
    selectedNode.value = normalizedSelectedClub;
    selectedNode.textContent = normalizedSelectedClub;
    clubInput.appendChild(selectedNode);
  }

  clubInput.value = normalizedSelectedClub || (options.length === 1 ? options[0] : "");
}

function addTrainerFeeRow(rowData = {}) {
  if (!trainerFeeRows || !(trainerFeeRowTemplate instanceof HTMLTemplateElement)) {
    return;
  }

  const fragment = trainerFeeRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".team-fee-row");
  if (!row) {
    return;
  }

  const typeInput = row.querySelector('select[name="fee_type"]');
  const dayInput = row.querySelector('select[name="fee_day"]');
  const timeInput = row.querySelector('input[name="fee_time"]');
  const clubInput = row.querySelector('select[name="fee_club"]');
  const activityInput = row.querySelector('select[name="fee_activity"]');
  const amountInput = row.querySelector('input[name="fee_amount"]');
  const groupInput = row.querySelector('[data-trainer-fee-group]');

  if (typeInput) {
    typeInput.value = rowData.type || (Array.isArray(rowData.types) ? rowData.types[0] : "") || "";
  }
  if (dayInput) {
    dayInput.value = rowData.day || "";
  }
  if (timeInput) {
    timeInput.value = rowData.time || "";
  }
  setTrainerFeeClubOptions(clubInput, typeInput?.value || "", rowData.club || "");
  setTrainerFeeActivityOptions(activityInput, clubInput?.value || "", rowData.activity || "", typeInput?.value || "");
  if (amountInput) {
    amountInput.value = rowData.amount || "";
  }
  if (groupInput) {
    groupInput.value = rowData.group || rowData.trainerGroup || "";
  }

  typeInput?.addEventListener("change", () => {
    setTrainerFeeClubOptions(clubInput, typeInput.value, "");
    setTrainerFeeActivityOptions(activityInput, clubInput?.value || "", "", typeInput.value);
  });

  clubInput?.addEventListener("change", () => {
    setTrainerFeeActivityOptions(activityInput, clubInput.value, "", typeInput?.value || "");
  });

  row.addEventListener("input", updateTrainerFeeGrouping);
  row.addEventListener("change", updateTrainerFeeGrouping);

  trainerFeeRows.appendChild(fragment);
  updateTrainerFeeGrouping();
}

function parseTrainerFeeAmount(value) {
  const normalized = String(value || "").trim().replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function updateTrainerFeeGrouping() {
  if (!trainerFeeRows) return;
  const rows = Array.from(trainerFeeRows.querySelectorAll(".team-fee-row"));
  const leaders = new Map();
  let total = 0;
  let selectedCount = 0;
  rows.forEach((row) => {
    const group = row.querySelector('[data-trainer-fee-group]')?.value.trim().toLowerCase() || "";
    const amount = parseTrainerFeeAmount(row.querySelector('input[name="fee_amount"]')?.value);
    const leader = group ? leaders.get(group) : null;
    const isFollower = Boolean(leader);
    const isSelected = Boolean(row.querySelector("[data-trainer-fee-select]")?.checked);
    if (isSelected) selectedCount += 1;
    if (group && !leader) leaders.set(group, row);
    row.classList.toggle("team-fee-row-grouped", Boolean(group));
    row.classList.toggle("team-fee-row-group-follower", isFollower);
    row.classList.toggle("team-fee-row-selected", isSelected);
    const amountLabel = row.querySelector("[data-trainer-fee-amount-label]");
    if (amountLabel) amountLabel.textContent = group ? "Totale avondvergoeding" : "Bedrag per training";
    if (!isFollower) total += amount;
  });
  if (trainerFeeTotal) {
    trainerFeeTotal.textContent = new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(total);
  }
  if (groupTrainerFeeRowsButton) {
    groupTrainerFeeRowsButton.disabled = selectedCount < 2;
    groupTrainerFeeRowsButton.textContent = selectedCount > 0 ? `Groeperen (${selectedCount})` : "Groeperen";
    groupTrainerFeeRowsButton.title = selectedCount < 2 ? "Vink minimaal twee regels aan" : "Maak van de geselecteerde regels één avondvergoeding";
  }
}

function setTrainerFeeRows(rows) {
  if (!trainerFeeRows) {
    return;
  }

  trainerFeeRows.innerHTML = "";
  const normalizedRows = Array.isArray(rows) ? rows : [];
  if (normalizedRows.length) {
    normalizedRows.forEach((row) => addTrainerFeeRow(row));
  } else {
    addTrainerFeeRow();
  }
}

function getTrainerFeesFromButton(button) {
  try {
    const parsedRows = JSON.parse(button.dataset.trainerFees || "[]");
    return Array.isArray(parsedRows) ? parsedRows : [];
  } catch (_error) {
    return [];
  }
}

if (profileTrainerFeesDataNode) {
  try {
    setTrainerFeeRows(JSON.parse(profileTrainerFeesDataNode.textContent || "[]"));
  } catch (_error) {
    setTrainerFeeRows([]);
  }
}

function openTrainerDetail(button) {
  const trainerName = button.dataset.trainerName || "Teamlid";

  setDetailInputValue("#trainerDetailProfileId", button.dataset.trainerId || "");
  setDetailInputValue("#trainerDeleteProfileId", button.dataset.trainerId || "");
  setDetailInputValue("#trainerDetailFirstName", button.dataset.trainerFirstName || "");
  setDetailInputValue("#trainerDetailLastName", button.dataset.trainerLastName || "");
  setDetailInputValue("#trainerDetailEmailInput", button.dataset.trainerEmail || "");
  setDetailInputValue("#trainerDetailPhoneInput", button.dataset.trainerPhone === "-" ? "" : (button.dataset.trainerPhone || ""));
  setDetailInputValue("#trainerDetailAddressInput", button.dataset.trainerAddress || "");
  setDetailInputValue("#trainerDetailCityInput", button.dataset.trainerCity || "");
  setDetailInputValue("#trainerDetailPostalCodeInput", button.dataset.trainerPostalCode || "");
  setDetailInputValue("#trainerDetailBankAccountNumberInput", button.dataset.trainerBankAccountNumber || "");
  setDetailInputValue("#trainerDetailBankAccountNameInput", button.dataset.trainerBankAccountName || "");
  setDetailInputValue("#trainerDetailInviteLinkInput", button.dataset.trainerInviteLink || "");
  setDetailInputValue("#trainerDetailLicenseInput", button.dataset.trainerLicense === "-" ? "" : (button.dataset.trainerLicense || ""));
  setDetailInputValue("#trainerDetailEducationInput", button.dataset.trainerEducation === "-" ? "" : (button.dataset.trainerEducation || ""));
  setDetailInputValue("#trainerDetailNotesInput", button.dataset.trainerNotes === "Geen notities toegevoegd." ? "" : (button.dataset.trainerNotes || ""));
  setDetailField("#trainerDetailName", trainerName);
  setDetailField("#trainerDetailRole", button.dataset.trainerSystemRole || "-");
  setDetailField("#trainerDetailAvatar", button.dataset.trainerInitials || "TM");
  setTrainerFeeRows(getTrainerFeesFromButton(button));
  setTrainerDetailTab("gegevens");

  const systemRoleInput = document.querySelector("#trainerDetailSystemRoleInput");
  if (systemRoleInput) {
    systemRoleInput.value = button.dataset.trainerSystemRole || "Trainer";
  }
  updateTrainerProfileSections(button.dataset.trainerSystemRole || "Trainer");

  setTrainerModalOpen(trainerDetailModal, true);
}

function filterTeamCards() {
  const query = (teamSearchInput?.value || "").trim().toLowerCase();
  trainerTileButtons.forEach((button) => {
    const haystack = button.dataset.search || "";
    button.hidden = Boolean(query) && !haystack.includes(query);
  });
}

openTrainerCreateModal?.addEventListener("click", () => {
  updateTrainerPreview();
  setTrainerModalOpen(trainerCreateModal, true);
});

trainerTileButtons.forEach((button) => {
  button.addEventListener("click", () => openTrainerDetail(button));
});

trainerDetailTabs.forEach((button) => {
  button.addEventListener("click", () => {
    setTrainerDetailTab(button.dataset.teamDetailTab || "gegevens");
  });
});

addTrainerFeeRowButton?.addEventListener("click", () => {
  addTrainerFeeRow();
});

groupTrainerFeeRowsButton?.addEventListener("click", () => {
  const selectedRows = Array.from(trainerFeeRows?.querySelectorAll(".team-fee-row") || [])
    .filter((row) => row.querySelector("[data-trainer-fee-select]")?.checked);
  if (selectedRows.length < 2) return;
  const groupId = `avond-${Date.now()}`;
  const leaderAmount = selectedRows[0].querySelector('input[name="fee_amount"]')?.value || "";
  selectedRows.forEach((row) => {
    const groupInput = row.querySelector('[data-trainer-fee-group]');
    const amountInput = row.querySelector('input[name="fee_amount"]');
    const checkbox = row.querySelector('[data-trainer-fee-select]');
    if (groupInput) groupInput.value = groupId;
    if (amountInput) amountInput.value = leaderAmount;
    if (checkbox) checkbox.checked = false;
  });
  updateTrainerFeeGrouping();
});

trainerFeeRows?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.dataset.removeTrainerFeeRow) {
    return;
  }
  const row = target.closest(".team-fee-row");
  row?.remove();
  if (!trainerFeeRows.querySelector(".team-fee-row")) {
    addTrainerFeeRow();
  }
  updateTrainerFeeGrouping();
});

teamSearchInput?.addEventListener("input", filterTeamCards);
previewFirstName?.addEventListener("input", updateTrainerPreview);
previewLastName?.addEventListener("input", updateTrainerPreview);
previewSystemRole?.addEventListener("change", updateTrainerPreview);
document.querySelector("#trainerDetailSystemRoleInput")?.addEventListener("change", (event) => {
  updateTrainerProfileSections(event.target.value);
});
updateTrainerPreview();

copyInviteLinkButton?.addEventListener("click", async () => {
  const inviteLink = inviteLinkField?.value.trim();
  if (!inviteLink) {
    return;
  }

  try {
    await navigator.clipboard.writeText(inviteLink);
    copyInviteLinkButton.textContent = "Gekopieerd";
    window.setTimeout(() => {
      copyInviteLinkButton.textContent = "Kopieer link";
    }, 1800);
  } catch (_error) {
    inviteLinkField?.select();
    copyInviteLinkButton.textContent = "Selecteer link";
  }
});

if (inviteLinkField?.value.trim() && navigator.clipboard?.writeText) {
  navigator.clipboard.writeText(inviteLinkField.value.trim()).then(() => {
    if (copyInviteLinkButton) {
      copyInviteLinkButton.textContent = "Gekopieerd";
      window.setTimeout(() => {
        copyInviteLinkButton.textContent = "Kopieer link";
      }, 1800);
    }
  }).catch(() => {
    // Ignore clipboard permission failures and keep the manual copy button available.
  });
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.dataset.closeTrainerModal) {
    closeAllTrainerModals();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllTrainerModals();
  }
});

trainerDeleteForm?.addEventListener("submit", (event) => {
  const trainerName = document.querySelector("#trainerDetailName")?.textContent?.trim() || "dit teamlid";
  const confirmed = window.confirm(`Weet je zeker dat je ${trainerName} wilt verwijderen?`);
  if (!confirmed) {
    event.preventDefault();
  }
});
