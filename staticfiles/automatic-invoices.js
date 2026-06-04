const automaticInvoiceModal = document.querySelector("#automaticInvoiceModal");
const openAutomaticInvoiceModalButton = document.querySelector("#openAutomaticInvoiceModal");
const closeAutomaticInvoiceModalButton = document.querySelector("#closeAutomaticInvoiceModal");

function setAutomaticInvoiceModalOpen(isOpen) {
  if (!automaticInvoiceModal) {
    return;
  }

  automaticInvoiceModal.hidden = !isOpen;
  document.body.style.overflow = isOpen ? "hidden" : "";
}

openAutomaticInvoiceModalButton?.addEventListener("click", () => {
  setAutomaticInvoiceModalOpen(true);
});

closeAutomaticInvoiceModalButton?.addEventListener("click", () => {
  setAutomaticInvoiceModalOpen(false);
});

automaticInvoiceModal?.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.dataset.closeAutomaticInvoiceModal) {
    setAutomaticInvoiceModalOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && automaticInvoiceModal && !automaticInvoiceModal.hidden) {
    setAutomaticInvoiceModalOpen(false);
  }
});
