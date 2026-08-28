const apiCopyFeedback = document.querySelector("[data-copy-feedback]");

function getApiCopyValue(target) {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target.value;
  }
  return target?.textContent || "";
}

async function copyApiValue(value) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const fallback = document.createElement("textarea");
  fallback.value = value;
  fallback.setAttribute("readonly", "");
  fallback.style.position = "fixed";
  fallback.style.opacity = "0";
  document.body.appendChild(fallback);
  fallback.select();
  const copied = document.execCommand("copy");
  fallback.remove();
  if (!copied) {
    throw new Error("Kopiëren wordt niet ondersteund.");
  }
}

document.querySelectorAll("[data-copy-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    const targetId = button.getAttribute("data-copy-target") || "";
    const target = document.getElementById(targetId);
    const value = getApiCopyValue(target).trim();
    if (!value) {
      return;
    }

    const originalLabel = button.textContent;
    try {
      await copyApiValue(value);
      button.textContent = "Gekopieerd";
      if (apiCopyFeedback) {
        apiCopyFeedback.textContent = `${targetId === "agendaEnvironment" ? "Configuratie" : "Waarde"} is gekopieerd.`;
      }
    } catch (error) {
      button.textContent = "Kopiëren mislukt";
      if (apiCopyFeedback) {
        apiCopyFeedback.textContent = "Selecteer de tekst en kopieer deze handmatig.";
      }
    }
    window.setTimeout(() => {
      button.textContent = originalLabel;
    }, 1800);
  });
});

document.querySelectorAll("[data-secret-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const targetId = button.getAttribute("data-secret-toggle") || "";
    const input = document.getElementById(targetId);
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const reveal = input.type === "password";
    input.type = reveal ? "text" : "password";
    button.textContent = reveal ? "Verberg" : "Toon";
    button.setAttribute("aria-pressed", reveal ? "true" : "false");
  });
});

document.querySelector("[data-api-rotate-form]")?.addEventListener("submit", (event) => {
  const confirmed = window.confirm(
    "Weet je zeker dat je de API-sleutel wilt vernieuwen? De huidige koppeling en agenda-feed stoppen direct met werken.",
  );
  if (!confirmed) {
    event.preventDefault();
  }
});
