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

function openTrainerDetail(button) {
  const trainerName = button.dataset.trainerName || "Teamlid";

  setDetailInputValue("#trainerDetailProfileId", button.dataset.trainerId || "");
  setDetailInputValue("#trainerDeleteProfileId", button.dataset.trainerId || "");
  setDetailInputValue("#trainerDetailFirstName", button.dataset.trainerFirstName || "");
  setDetailInputValue("#trainerDetailLastName", button.dataset.trainerLastName || "");
  setDetailInputValue("#trainerDetailEmailInput", button.dataset.trainerEmail || "");
  setDetailInputValue("#trainerDetailPhoneInput", button.dataset.trainerPhone === "-" ? "" : (button.dataset.trainerPhone || ""));
  setDetailInputValue("#trainerDetailLicenseInput", button.dataset.trainerLicense === "-" ? "" : (button.dataset.trainerLicense || ""));
  setDetailInputValue("#trainerDetailEducationInput", button.dataset.trainerEducation === "-" ? "" : (button.dataset.trainerEducation || ""));
  setDetailInputValue("#trainerDetailNotesInput", button.dataset.trainerNotes === "Geen notities toegevoegd." ? "" : (button.dataset.trainerNotes || ""));
  setDetailField("#trainerDetailName", trainerName);
  setDetailField("#trainerDetailRole", button.dataset.trainerSystemRole || "-");
  setDetailField("#trainerDetailAvatar", button.dataset.trainerInitials || "TM");

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
