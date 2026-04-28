(() => {
  const iconSvgs = {
    clipboard: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 5h6M9 9h6M8 13h8M8 17h5"></path><path d="M8 4h8l2 3v13H6V7l2-3Z"></path></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 21c4 0 7-2.8 7-6.8 0-3.1-1.9-5.4-4-7.7-.2 2-1 3.4-2.4 4.6.1-2.8-1.3-5-3.8-7.1C8.7 7.4 5 9.9 5 14.2 5 18.2 8 21 12 21Z"></path></svg>',
    football: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5"></circle><path d="m12 8 3 2.2-1.2 3.6h-3.6L9 10.2 12 8Z"></path><path d="M12 8V4M15 10.2l3.8-1.1M13.8 13.8l2.3 3.3M10.2 13.8l-2.3 3.3M9 10.2 5.2 9.1"></path></svg>',
    utensils: '<svg viewBox="0 0 24 24" fill="none"><path d="M7 4v7M5 4v7M9 4v7M5 11h4l-.5 9h-3L5 11Z"></path><path d="M16 4c2 1.5 3 3.7 3 6.5V20h-3V4Z"></path></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 5h8v4a4 4 0 0 1-8 0V5Z"></path><path d="M8 7H5a3 3 0 0 0 3 4M16 7h3a3 3 0 0 1-3 4M12 13v4M9 20h6M10 17h4"></path></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 8h4l1.5-2h5L16 8h4v11H4V8Z"></path><circle cx="12" cy="13.5" r="3"></circle></svg>',
    medical: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4Z"></path></svg>',
    cones: '<svg viewBox="0 0 24 24" fill="none"><path d="M9 4h6l3 15H6L9 4Z"></path><path d="M8 14h8M9 9h6M5 20h14"></path></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8"></circle><path d="M12 8v4l3 2"></path></svg>',
  };

  const rules = [
    [/ontvangst|aanmelden|inloop|registratie/i, "clipboard"],
    [/warming|warm-up|activatie/i, "flame"],
    [/training|techniek|oefening|dribbel|passen|partij|wedstrijd/i, "football"],
    [/lunch|eten|pauze|drinken/i, "utensils"],
    [/toernooi|finale|prijs|ceremonie|afsluiting/i, "trophy"],
    [/foto|media|content/i, "camera"],
    [/ehbo|blessure|zorg/i, "medical"],
    [/materiaal|opbouw|afbouw|veld/i, "cones"],
  ];

  const staffRows = document.getElementById("footballStaffRows");
  const programRows = document.getElementById("footballProgramRows");
  const staffTemplate = document.getElementById("footballStaffRowTemplate");
  const programTemplate = document.getElementById("footballProgramRowTemplate");
  const addStaffButton = document.getElementById("addFootballStaffRow");
  const addProgramButton = document.getElementById("addFootballProgramRow");
  const exportButton = document.getElementById("exportFootballDaysPdf");
  const previousPlaybooksElement = document.getElementById("footballPreviousPlaybooks");
  let previousPlaybooks = [];

  if (previousPlaybooksElement) {
    try {
      previousPlaybooks = JSON.parse(previousPlaybooksElement.textContent || "[]");
    } catch (error) {
      previousPlaybooks = [];
    }
  }

  const inferIcon = (name) => {
    const match = rules.find(([pattern]) => pattern.test(name || ""));
    return match ? match[1] : "clock";
  };

  const renderIcon = (iconElement, key) => {
    if (!iconElement) {
      return;
    }
    const iconKey = iconSvgs[key] ? key : "clock";
    iconElement.dataset.activityIcon = iconKey;
    iconElement.innerHTML = iconSvgs[iconKey];
  };

  const refreshProgramRow = (row) => {
    const input = row.querySelector("[data-activity-name]");
    const icon = row.querySelector("[data-activity-icon]");
    renderIcon(icon, inferIcon(input ? input.value : ""));
  };

  const refreshRemoveButtons = (container, rowSelector) => {
    if (!container) {
      return;
    }
    const rows = [...container.querySelectorAll(rowSelector)];
    rows.forEach((row) => {
      const button = row.querySelector("[data-remove-football-row]");
      if (button) {
        button.hidden = rows.length <= 1;
      }
    });
  };

  const bindProgramRow = (row) => {
    refreshProgramRow(row);
    const input = row.querySelector("[data-activity-name]");
    if (input) {
      input.addEventListener("input", () => refreshProgramRow(row));
    }
  };

  const appendStaffRow = (member = {}) => {
    if (!staffRows || !staffTemplate) {
      return null;
    }
    const row = staffTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector('input[name="staff_name"]').value = member.name || "";
    row.querySelector('input[name="staff_role"]').value = member.role || "";
    row.querySelector('input[name="staff_task"]').value = member.task || "";
    staffRows.appendChild(row);
    return row;
  };

  const appendProgramRow = (item = {}) => {
    if (!programRows || !programTemplate) {
      return null;
    }
    const row = programTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector('input[name="program_start"]').value = item.startTime || "";
    row.querySelector('input[name="program_end"]').value = item.endTime || "";
    row.querySelector('input[name="program_activity"]').value = item.activity || "";
    programRows.appendChild(row);
    bindProgramRow(row);
    return row;
  };

  const replaceRows = (container, rowSelector, values, appendRow) => {
    if (!container) {
      return;
    }
    container.querySelectorAll(rowSelector).forEach((row) => row.remove());
    const rows = values.length ? values : [{}];
    rows.forEach((item) => appendRow(item));
    refreshRemoveButtons(container, rowSelector);
  };

  addStaffButton?.addEventListener("click", () => {
    appendStaffRow();
    refreshRemoveButtons(staffRows, "[data-football-staff-row]");
  });

  addProgramButton?.addEventListener("click", () => {
    appendProgramRow();
    refreshRemoveButtons(programRows, "[data-football-program-row]");
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-football-row]");
    if (!button) {
      return;
    }
    const row = button.closest("[data-football-staff-row], [data-football-program-row]");
    const container = row?.parentElement;
    row?.remove();
    refreshRemoveButtons(container, "[data-football-staff-row]");
    refreshRemoveButtons(container, "[data-football-program-row]");
  });

  exportButton?.addEventListener("click", () => {
    window.print();
  });

  document.querySelectorAll("[data-reuse-playbook]").forEach((select) => {
    select.addEventListener("change", () => {
      const playbook = previousPlaybooks.find((item) => String(item.id) === select.value);
      const section = select.dataset.reusePlaybook;
      if (!playbook || !section) {
        return;
      }
      if (section === "staff") {
        replaceRows(staffRows, "[data-football-staff-row]", playbook.staff || [], appendStaffRow);
      }
      if (section === "program") {
        replaceRows(programRows, "[data-football-program-row]", playbook.program || [], appendProgramRow);
      }
      if (section === "contingencies") {
        const textarea = document.querySelector('textarea[name="contingencies"]');
        if (textarea) {
          textarea.value = playbook.contingencies || "";
        }
      }
      select.value = "";
    });
  });

  document.querySelectorAll("[data-football-program-row]").forEach(bindProgramRow);
  refreshRemoveButtons(staffRows, "[data-football-staff-row]");
  refreshRemoveButtons(programRows, "[data-football-program-row]");
})();
