(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('teamsData').textContent);
  const dialog = document.getElementById('teamDialog');
  const form = document.getElementById('teamForm');
  const schedules = document.getElementById('teamSchedules');
  const levels = document.getElementById('teamLevels');
  const field = (name) => form.elements.namedItem(name);
  let phaseValues = [];
  let openingValues = '';
  let returnFocus = null;
  const snapshot = () => JSON.stringify(Array.from(new FormData(form).entries()));

  function renderLevels(preserve = true) {
    if (preserve) levels.querySelectorAll('input').forEach((input, index) => { phaseValues[index] = input.value; });
    const count = data.agePhases[field('age_category').value] || 0;
    levels.replaceChildren();
    document.getElementById('phaseHint').textContent = count ? `${count} fases voor ${field('age_category').value}. Onbekende niveaus kun je later invullen.` : 'Kies eerst een leeftijdscategorie.';
    for (let index = 0; index < count; index += 1) {
      const label = document.createElement('label');
      label.textContent = `Fase ${index + 1}`;
      const input = document.createElement('input');
      input.name = 'level';
      input.maxLength = 120;
      input.placeholder = 'Bijv. Hoofdklasse of 1e klasse';
      input.value = phaseValues[index] || '';
      label.append(input);
      levels.append(label);
    }
  }

  function updateScheduleControls() {
    document.getElementById('addSchedule').disabled = schedules.children.length >= 21;
    schedules.querySelectorAll('.teams-remove').forEach((button) => { button.disabled = schedules.children.length <= 1; });
  }

  function addSchedule(values = {}) {
    const row = document.getElementById('scheduleTemplate').content.firstElementChild.cloneNode(true);
    ['day', 'start', 'end', 'trainer'].forEach((name) => {
      const input = row.querySelector(`[name="${name}"]`);
      if (name === 'trainer' && values[name] && !Array.from(input.options).some((option) => option.value === String(values[name]))) {
        input.add(new Option('Trainer niet meer beschikbaar — kies opnieuw', String(values[name])));
      }
      input.value = values[name] || '';
    });
    const start = row.querySelector('[name="start"]');
    const end = row.querySelector('[name="end"]');
    function validateTimes() {
      end.setCustomValidity(start.value && end.value && end.value <= start.value ? 'De eindtijd moet na de begintijd liggen.' : '');
    }
    start.addEventListener('input', validateTimes);
    end.addEventListener('input', validateTimes);
    row.querySelector('.teams-remove').addEventListener('click', () => { row.remove(); updateScheduleControls(); });
    schedules.append(row);
    updateScheduleControls();
  }

  function openTeam(team = null, keepError = false) {
    returnFocus = document.activeElement;
    form.reset();
    const error = document.getElementById('teamError');
    if (error) error.hidden = !keepError;
    ['id', 'version', 'name', 'club', 'season', 'age_category', 'team_type', 'notes'].forEach((name) => {
      field(name).value = team?.[name] ?? (name === 'season' ? data.defaultSeason : '');
    });
    phaseValues = [...(team?.levels || [])];
    renderLevels(false);
    schedules.replaceChildren();
    (team?.schedules?.length ? team.schedules : [{}]).forEach(addSchedule);
    document.getElementById('teamDialogTitle').textContent = team?.id ? 'Team wijzigen' : 'Team toevoegen';
    document.getElementById('teamPlayersCount').textContent = `(${team?.players?.length || 0})`;
    document.getElementById('saveTeam').disabled = false;
    document.getElementById('saveTeam').textContent = 'Team opslaan';
    openingValues = snapshot();
    dialog.showModal();
    field('name').focus();
  }

  function closeTeam() {
    if (snapshot() !== openingValues && !window.confirm('Je hebt niet-opgeslagen wijzigingen. Wil je het venster toch sluiten?')) return;
    dialog.close();
    returnFocus?.focus();
  }

  document.getElementById('addTeam').addEventListener('click', () => openTeam());
  document.querySelectorAll('[data-team-id]').forEach((row) => {
    row.addEventListener('click', () => {
      const team = data.teams.find((item) => String(item.id) === row.dataset.teamId);
      if (team) openTeam(team);
    });
  });
  document.querySelectorAll('[data-close-team]').forEach((button) => button.addEventListener('click', closeTeam));
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); closeTeam(); });
  field('age_category').addEventListener('change', () => renderLevels());
  document.getElementById('addSchedule').addEventListener('click', () => { addSchedule(); schedules.lastElementChild.querySelector('select').focus(); });
  form.addEventListener('submit', () => {
    document.getElementById('saveTeam').disabled = true;
    document.getElementById('saveTeam').textContent = 'Opslaan…';
  });
  window.addEventListener('pageshow', () => {
    document.getElementById('saveTeam').disabled = false;
    document.getElementById('saveTeam').textContent = 'Team opslaan';
  });

  function filterTeams() {
    const search = document.getElementById('teamSearch').value.toLocaleLowerCase('nl').trim();
    const season = document.getElementById('seasonFilter').value;
    let count = 0;
    document.querySelectorAll('[data-team-id]').forEach((row) => {
      row.hidden = Boolean((season && row.dataset.season !== season) || !row.textContent.toLocaleLowerCase('nl').includes(search));
      if (!row.hidden) count += 1;
    });
    document.getElementById('teamCount').textContent = `${count} ${count === 1 ? 'team' : 'teams'}`;
    document.getElementById('teamsEmpty').hidden = count > 0;
  }
  document.getElementById('teamSearch').addEventListener('input', filterTeams);
  document.getElementById('seasonFilter').addEventListener('change', filterTeams);
  if (data.submitted) openTeam(data.submitted, true);
})();
