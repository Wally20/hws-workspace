"""Teambeheer voor samenwerkende amateurclubs, met eigen persistente opslag."""
from datetime import date, datetime, timezone
import json
import re

AGE_PHASES = {f"JO{age}": 4 if age <= 12 else 3 for age in range(8, 16)}
DAYS = ("Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag")


def init_teams_storage(connection):
    connection.execute("""
        CREATE TABLE IF NOT EXISTS amateur_club_teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            club TEXT NOT NULL,
            season TEXT NOT NULL,
            age_category TEXT NOT NULL,
            team_type TEXT NOT NULL,
            schedules_json TEXT NOT NULL DEFAULT '[]',
            levels_json TEXT NOT NULL DEFAULT '[]',
            players_json TEXT NOT NULL DEFAULT '[]',
            notes TEXT NOT NULL DEFAULT '',
            version INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)


def load_teams(connection):
    teams = []
    for row in connection.execute("SELECT * FROM amateur_club_teams ORDER BY season DESC, club COLLATE NOCASE, name COLLATE NOCASE, id"):
        team = dict(row)
        for field in ("schedules", "levels", "players"):
            team[field] = json.loads(team.pop(f"{field}_json"))
        teams.append(team)
    return teams


def team_from_form(form):
    team = {key: str(form.get(key, "")).strip() for key in (
        "id", "version", "name", "club", "season", "age_category", "team_type", "notes"
    )}
    days, starts, ends, trainers = (form.getlist(key) for key in ("day", "start", "end", "trainer"))
    if len({len(days), len(starts), len(ends), len(trainers)}) != 1:
        raise ValueError("De trainingsmomenten zijn onvolledig. Open het team opnieuw.")
    team["schedules"] = [dict(zip(("day", "start", "end", "trainer"), (str(value).strip() for value in values)))
                         for values in zip(days, starts, ends, trainers)]
    team["levels"] = [str(value).strip() for value in form.getlist("level")]
    team["players"] = []
    return team


def validate_team(team, trainer_ids):
    for field, label in (("name", "teamnaam"), ("club", "club"), ("season", "seizoen"), ("team_type", "soort training")):
        if not team[field] or len(team[field]) > 120:
            raise ValueError(f"Vul een {label} in van maximaal 120 tekens.")
    season = re.fullmatch(r"(\d{4})/(\d{4})", team["season"])
    if not season or int(season[2]) != int(season[1]) + 1:
        raise ValueError("Vul het seizoen in als 2026/2027.")
    if team["age_category"] not in AGE_PHASES:
        raise ValueError("Kies een leeftijdscategorie van JO8 tot en met JO15.")
    if len(team["levels"]) != AGE_PHASES[team["age_category"]] or any(len(level) > 120 for level in team["levels"]):
        raise ValueError("Vul voor elke fase een niveau van maximaal 120 tekens in, of laat het niveau nog leeg.")
    if len(team["notes"]) > 5000:
        raise ValueError("De opmerking mag maximaal 5000 tekens bevatten.")
    if not 1 <= len(team["schedules"]) <= 21:
        raise ValueError("Voeg tussen 1 en 21 trainingsmomenten toe.")
    seen = set()
    for schedule in team["schedules"]:
        if schedule["day"] not in DAYS:
            raise ValueError("Kies voor elk trainingsmoment een geldige dag.")
        if any(not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", schedule[key]) for key in ("start", "end")):
            raise ValueError("Vul bij elk trainingsmoment een geldige begin- en eindtijd in.")
        if schedule["end"] <= schedule["start"]:
            raise ValueError("De eindtijd moet na de begintijd liggen.")
        if schedule["trainer"] and schedule["trainer"] not in trainer_ids:
            raise ValueError("Deze trainer bestaat niet meer. Kies een andere trainer.")
        key = (schedule["day"], schedule["start"], schedule["end"])
        if key in seen:
            raise ValueError("Een trainingsmoment staat dubbel in de lijst.")
        seen.add(key)


def save_team(connection, team):
    now = datetime.now(timezone.utc).isoformat()
    values = [team[key] for key in ("name", "club", "season", "age_category", "team_type")]
    values += [json.dumps(team[key], ensure_ascii=False) for key in ("schedules", "levels")]
    values += [team["notes"], now]
    if team["id"]:
        if not str(team["id"]).isdigit() or not str(team["version"]).isdigit():
            raise ValueError("Dit team kon niet worden herkend. Open het overzicht opnieuw.")
        result = connection.execute("""
            UPDATE amateur_club_teams SET name=?, club=?, season=?, age_category=?, team_type=?,
                schedules_json=?, levels_json=?, notes=?, updated_at=?, version=version+1
            WHERE id=? AND version=?
        """, [*values, int(team["id"]), int(team["version"])])
        if result.rowcount != 1:
            raise ValueError("Dit team is intussen gewijzigd of bestaat niet meer. Bewaar je aanpassingen apart en open het overzicht opnieuw.")
        return int(team["id"])
    result = connection.execute("""
        INSERT INTO amateur_club_teams (name, club, season, age_category, team_type,
            schedules_json, levels_json, notes, updated_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [*values, now])
    return result.lastrowid


def teams_page():
    import app as legacy
    access = legacy.require_page_access("samenwerkende-amateurclubs")
    if access is not None:
        return access
    if legacy.request.method not in {"GET", "HEAD", "POST"}:
        return "Methode niet toegestaan.", 405, {"Allow": "GET, HEAD, POST"}
    trainers = [{"id": str(profile["id"]), "name": profile["fullName"]} for profile in legacy.load_trainer_profiles()]
    error, submitted, status = "", None, 200
    if legacy.request.method == "POST":
        try:
            submitted = team_from_form(legacy.request.form)
            validate_team(submitted, {trainer["id"] for trainer in trainers})
            with legacy.get_db_connection() as connection:
                save_team(connection, submitted)
            return legacy.redirect("/samenwerkende-amateurclubs/teams?saved=1")
        except ValueError as exc:
            error, status = str(exc), 400
    with legacy.get_db_connection() as connection:
        teams = load_teams(connection)
    today = date.today()
    year = today.year if today.month >= 7 else today.year - 1
    return legacy.render_template(
        "samenwerkende_amateurclubs_teams.html", active_page="samenwerkende-amateurclubs",
        teams=teams, trainers=trainers, trainer_names={item["id"]: item["name"] for item in trainers},
        clubs=sorted(set(legacy.AGENDA_AMATEUR_CLUB_OPTIONS) | {team["club"] for team in teams}),
        age_phases=AGE_PHASES, days=DAYS, default_season=f"{year}/{year + 1}",
        error=error, submitted=submitted, saved=legacy.request.args.get("saved") == "1",
    ), status
