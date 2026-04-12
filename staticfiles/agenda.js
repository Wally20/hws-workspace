const agendaModal = document.querySelector("#agendaModal");
const openAgendaModal = document.querySelector("#openAgendaModal");
const closeAgendaModal = document.querySelector("#closeAgendaModal");

function setModalOpen(isOpen) {
  if (!agendaModal) {
    return;
  }

  agendaModal.hidden = !isOpen;
  document.body.style.overflow = isOpen ? "hidden" : "";
}

openAgendaModal?.addEventListener("click", () => setModalOpen(true));
closeAgendaModal?.addEventListener("click", () => setModalOpen(false));

agendaModal?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.dataset.closeModal === "1") {
    setModalOpen(false);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setModalOpen(false);
  }
});
