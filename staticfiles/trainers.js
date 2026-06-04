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
const trainerFeeRows = document.querySelector("#trainerFeeRows");
const trainerFeeRowTemplate = document.querySelector("#trainerFeeRowTemplate");
const addTrainerFeeRowButton = document.querySelector("#addTrainerFeeRow");

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
    panel.hidden = panel.dataset.teamDetailPanel !== activeTab;
  });
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

  const clubInput = row.querySelector('select[name="fee_club"]');
  const activityInput = row.querySelector('select[name="fee_activity"]');
  const amountInput = row.querySelector('input[name="fee_amount"]');
  if (clubInput) {
    clubInput.value = rowData.club || "";
  }
  if (activityInput) {
    activityInput.value = rowData.activity || "";
  }
  if (amountInput) {
    amountInput.value = rowData.amount || "";
  }

  trainerFeeRows.appendChild(fragment);
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

function openTrainerDetail(button) {
  const trainerName = button.dataset.trainerName || "Teamlid";

  setDetailInputValue("#trainerDetailProfileId", button.dataset.trainerId || "");
  setDetailInputValue("#trainerDeleteProfileId", button.dataset.trainerId || "");
  setDetailInputValue("#trainerDetailFirstName", button.dataset.trainerFirstName || "");
  setDetailInputValue("#trainerDetailLastName", button.dataset.trainerLastName || "");
  setDetailInputValue("#trainerDetailEmailInput", button.dataset.trainerEmail || "");
  setDetailInputValue("#trainerDetailPhoneInput", button.dataset.trainerPhone === "-" ? "" : (button.dataset.trainerPhone || ""));
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
});

teamSearchInput?.addEventListener("input", filterTeamCards);
previewFirstName?.addEventListener("input", updateTrainerPreview);
previewLastName?.addEventListener("input", updateTrainerPreview);
previewSystemRole?.addEventListener("change", updateTrainerPreview);
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
