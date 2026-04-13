const socialIdeaModal = document.querySelector("#socialIdeaModal");
const socialIdeaEditModal = document.querySelector("#socialIdeaEditModal");
const socialPlanModal = document.querySelector("#socialPlanModal");
const socialEditModal = document.querySelector("#socialEditModal");
const openSocialIdeaModal = document.querySelector("#openSocialIdeaModal");
const openSocialPlanModal = document.querySelector("#openSocialPlanModal");
const socialIdeaPlanButtons = document.querySelectorAll("[data-open-social-plan='1']");
const socialIdeaEditButtons = document.querySelectorAll("[data-open-social-idea-edit='1']");
const socialEditButtons = document.querySelectorAll("[data-open-social-edit='1']");
const socialIdeaEditId = document.querySelector("#socialIdeaEditId");
const socialIdeaEditTitle = document.querySelector("#socialIdeaEditTitle");
const socialIdeaEditPlatform = document.querySelector("#socialIdeaEditPlatform");
const socialIdeaEditContentType = document.querySelector("#socialIdeaEditContentType");
const socialIdeaEditPriority = document.querySelector("#socialIdeaEditPriority");
const socialIdeaEditNotes = document.querySelector("#socialIdeaEditNotes");
const socialIdeaDeleteId = document.querySelector("#socialIdeaDeleteId");
const socialIdeaDeleteForm = document.querySelector("#socialIdeaDeleteForm");
const socialPlanIdeaId = document.querySelector("#socialPlanIdeaId");
const socialPlanTitle = document.querySelector("#socialPlanTitle");
const socialPlanPlatform = document.querySelector("#socialPlanPlatform");
const socialPlanStatus = document.querySelector("#socialPlanStatus");
const socialPlanDate = document.querySelector("#socialPlanDate");
const socialPlanTime = document.querySelector("#socialPlanTime");
const socialPlanNotes = document.querySelector("#socialPlanNotes");
const socialEditPlanId = document.querySelector("#socialEditPlanId");
const socialDeletePlanId = document.querySelector("#socialDeletePlanId");
const socialEditTitle = document.querySelector("#socialEditTitle");
const socialEditPlatform = document.querySelector("#socialEditPlatform");
const socialEditStatus = document.querySelector("#socialEditStatus");
const socialEditDate = document.querySelector("#socialEditDate");
const socialEditTime = document.querySelector("#socialEditTime");
const socialEditNotes = document.querySelector("#socialEditNotes");

function setSelectValues(select, values) {
  if (!(select instanceof HTMLSelectElement)) {
    return;
  }

  const selectedValues = new Set(
    String(values || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );

  Array.from(select.options).forEach((option) => {
    option.selected = selectedValues.has(option.value);
  });
}

function setSocialModalOpen(modal, isOpen) {
  if (!modal) {
    return;
  }

  modal.hidden = !isOpen;
  document.body.style.overflow = isOpen ? "hidden" : "";
}

function resetSocialPlanForm() {
  if (socialPlanIdeaId) {
    socialPlanIdeaId.value = "";
  }
  if (socialPlanTitle) {
    socialPlanTitle.value = "";
  }
  if (socialPlanPlatform) {
    socialPlanPlatform.value = "";
  }
  if (socialPlanStatus) {
    socialPlanStatus.value = "Gepland";
  }
  if (socialPlanDate) {
    socialPlanDate.value = "";
  }
  if (socialPlanTime) {
    socialPlanTime.value = "";
  }
  if (socialPlanNotes) {
    socialPlanNotes.value = "";
  }
}

openSocialIdeaModal?.addEventListener("click", () => {
  setSocialModalOpen(socialIdeaModal, true);
});

openSocialPlanModal?.addEventListener("click", () => {
  resetSocialPlanForm();
  setSocialModalOpen(socialPlanModal, true);
});

socialIdeaPlanButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (socialPlanIdeaId) {
      socialPlanIdeaId.value = button.dataset.ideaId || "";
    }
    if (socialPlanTitle) {
      socialPlanTitle.value = button.dataset.ideaTitle || "";
    }
    if (socialPlanPlatform) {
      socialPlanPlatform.value = button.dataset.ideaPlatform || "";
    }
    if (socialPlanStatus) {
      socialPlanStatus.value = "Gepland";
    }
    if (socialPlanNotes) {
      socialPlanNotes.value = button.dataset.ideaNotes || "";
    }
    setSocialModalOpen(socialPlanModal, true);
  });
});

socialIdeaEditButtons.forEach((button) => {
  const openIdeaEditModal = () => {
    if (socialIdeaEditId) {
      socialIdeaEditId.value = button.dataset.ideaId || "";
    }
    if (socialIdeaDeleteId) {
      socialIdeaDeleteId.value = button.dataset.ideaId || "";
    }
    if (socialIdeaEditTitle) {
      socialIdeaEditTitle.value = button.dataset.ideaTitle || "";
    }
    if (socialIdeaEditPlatform) {
      setSelectValues(socialIdeaEditPlatform, button.dataset.ideaPlatform || "");
    }
    if (socialIdeaEditContentType) {
      socialIdeaEditContentType.value = button.dataset.ideaContentType || "";
    }
    if (socialIdeaEditPriority) {
      socialIdeaEditPriority.value = button.dataset.ideaPriority || "Midden";
    }
    if (socialIdeaEditNotes) {
      socialIdeaEditNotes.value = button.dataset.ideaNotes || "";
    }
    setSocialModalOpen(socialIdeaEditModal, true);
  };

  button.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("button, form, input, label")) {
      return;
    }
    openIdeaEditModal();
  });

  button.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openIdeaEditModal();
    }
  });
});

socialEditButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (socialEditPlanId) {
      socialEditPlanId.value = button.dataset.planId || "";
    }
    if (socialDeletePlanId) {
      socialDeletePlanId.value = button.dataset.planId || "";
    }
    if (socialEditTitle) {
      socialEditTitle.value = button.dataset.planTitle || "";
    }
    if (socialEditPlatform) {
      socialEditPlatform.value = button.dataset.planPlatform || "";
    }
    if (socialEditStatus) {
      socialEditStatus.value = button.dataset.planStatus || "Gepland";
    }
    if (socialEditDate) {
      socialEditDate.value = button.dataset.planDate || "";
    }
    if (socialEditTime) {
      socialEditTime.value = button.dataset.planTime || "";
    }
    if (socialEditNotes) {
      socialEditNotes.value = button.dataset.planNotes || "";
    }

    setSocialModalOpen(socialEditModal, true);
  });
});

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.dataset.closeSocialPlan === "1") {
    setSocialModalOpen(socialPlanModal, false);
  }

  if (target.dataset.closeSocialIdea === "1") {
    setSocialModalOpen(socialIdeaModal, false);
  }

  if (target.dataset.closeSocialIdeaEdit === "1") {
    setSocialModalOpen(socialIdeaEditModal, false);
  }

  if (target.dataset.closeSocialEdit === "1") {
    setSocialModalOpen(socialEditModal, false);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setSocialModalOpen(socialIdeaModal, false);
    setSocialModalOpen(socialIdeaEditModal, false);
    setSocialModalOpen(socialPlanModal, false);
    setSocialModalOpen(socialEditModal, false);
  }
});

socialIdeaDeleteForm?.addEventListener("submit", (event) => {
  const ideaTitle = socialIdeaEditTitle?.value.trim() || "dit contentidee";
  const confirmed = window.confirm(`Weet je zeker dat je ${ideaTitle} wilt verwijderen?`);
  if (!confirmed) {
    event.preventDefault();
  }
});
