import json
import sqlite3
from unittest.mock import patch

from django.test import Client, SimpleTestCase

import app as legacy
from core.amateur_teams import AGE_PHASES, init_teams_storage, load_teams
from core import tests as existing_tests


class AmateurTeamsTests(SimpleTestCase):
    TEST_CSRF_TOKEN = existing_tests.LegacyDjangoSmokeTests.TEST_CSRF_TOKEN
    build_authenticated_client = existing_tests.LegacyDjangoSmokeTests.build_authenticated_client

    def setUp(self):
        self.client = self.build_authenticated_client()
        self.path = '/samenwerkende-amateurclubs/teams'
        self.payload = {
            'csrf_token': self.TEST_CSRF_TOKEN, 'name': 'Test clubteam JO10-1',
            'club': 'WWNA', 'season': '2026/2027', 'age_category': 'JO10',
            'team_type': 'Techniektraining', 'day': ['Maandag', 'Woensdag'],
            'start': ['17:00', '18:00'], 'end': ['18:00', '19:00'],
            'trainer': [str(legacy.load_trainer_profiles()[0]['id']), ''],
            'level': ['1e klasse', 'Hoofdklasse', '', ''], 'notes': 'Extra aandacht voor samenspel.',
        }

    def tearDown(self):
        with legacy.get_db_connection() as connection:
            connection.execute("DELETE FROM amateur_club_teams WHERE name LIKE 'Test clubteam%'")
        super().tearDown()

    def current_team(self):
        with legacy.get_db_connection() as connection:
            return next(team for team in load_teams(connection) if team['name'].startswith('Test clubteam'))

    def test_create_reopen_and_edit_preserves_players(self):
        response = self.client.post(self.path, self.payload, secure=True)
        self.assertEqual(response.status_code, 302)
        team = self.current_team()
        self.assertEqual(len(team['schedules']), 2)
        self.assertEqual(team['levels'], self.payload['level'])
        self.assertContains(self.client.get(self.path, secure=True), 'Test clubteam JO10-1')
        with legacy.get_db_connection() as connection:
            connection.execute('UPDATE amateur_club_teams SET players_json=? WHERE id=?', (json.dumps([{'id': 'future-player'}]), team['id']))
        changed = {**self.payload, 'id': team['id'], 'version': team['version'],
                   'name': 'Test clubteam JO13-2', 'age_category': 'JO13', 'club': 'VV Oeken',
                   'season': '2027/2028', 'team_type': 'Teamtraining', 'level': ['2e klasse', '', '1e klasse'],
                   'day': ['Vrijdag'], 'start': ['16:30'], 'end': ['17:30'], 'trainer': [''],
                   'notes': 'Nieuwe bijzonderheden'}
        self.assertEqual(self.client.post(self.path, changed, secure=True).status_code, 302)
        updated = self.current_team()
        self.assertEqual(updated['id'], team['id'])
        self.assertEqual(updated['version'], 2)
        self.assertEqual(updated['club'], 'VV Oeken')
        self.assertEqual(updated['season'], '2027/2028')
        self.assertEqual(updated['team_type'], 'Teamtraining')
        self.assertEqual(updated['levels'], ['2e klasse', '', '1e klasse'])
        self.assertEqual(updated['notes'], 'Nieuwe bijzonderheden')
        self.assertEqual(updated['schedules'][0]['day'], 'Vrijdag')
        self.assertEqual(updated['players'], [{'id': 'future-player'}])
        self.assertEqual(self.client.post(self.path, changed, secure=True).status_code, 400)
        self.assertEqual(self.current_team()['version'], 2)

    def test_every_age_category_has_correct_phases(self):
        for age, count in AGE_PHASES.items():
            with self.subTest(age=age):
                self.assertEqual(count, 4 if int(age[2:]) <= 12 else 3)
                payload = {**self.payload, 'age_category': age, 'level': [''] * count}
                self.assertEqual(self.client.post(self.path, payload, secure=True).status_code, 302)
                payload['level'] = [''] * (count + 1)
                self.assertEqual(self.client.post(self.path, payload, secure=True).status_code, 400)

    def test_invalid_input_keeps_form_and_does_not_save(self):
        for changes in (
            {'end': ['16:00', '19:00']}, {'start': ['25:00', '18:00']},
            {'day': ['Fout', 'Woensdag']}, {'trainer': ['999999999', '']},
            {'season': '2026/2028'}, {'age_category': 'JO16'}, {'name': ''},
            {'day': []}, {'notes': 'x' * 5001},
        ):
            with self.subTest(changes=changes.keys()):
                response = self.client.post(self.path, {**self.payload, **changes}, secure=True)
                self.assertEqual(response.status_code, 400)
                self.assertIn('role="alert"', response.content.decode())
        with legacy.get_db_connection() as connection:
            self.assertFalse(any(team['name'].startswith('Test clubteam') for team in load_teams(connection)))

    def test_login_permissions_and_csrf_are_required(self):
        self.assertEqual(Client().get(self.path, secure=True).status_code, 302)
        without_csrf = {**self.payload}
        without_csrf.pop('csrf_token')
        self.assertEqual(self.client.post(self.path, without_csrf, secure=True).status_code, 403)
        with patch.object(legacy, 'user_has_permission', return_value=False):
            self.assertEqual(self.client.post(self.path, self.payload, secure=True).status_code, 403)
            self.assertEqual(self.client.get(self.path, secure=True).status_code, 302)

    def test_unknown_team_does_not_create_and_text_is_escaped(self):
        self.assertEqual(self.client.post(self.path, {**self.payload, 'id': '999999999', 'version': '1'}, secure=True).status_code, 400)
        payload = {**self.payload, 'notes': '</script><script>alert(1)</script>'}
        self.assertEqual(self.client.post(self.path, payload, secure=True).status_code, 302)
        response = self.client.get(self.path, secure=True)
        self.assertNotIn(payload['notes'], response.content.decode())
        self.assertContains(response, '&lt;script&gt;')

    def test_storage_initialization_is_idempotent(self):
        with sqlite3.connect(':memory:') as connection:
            init_teams_storage(connection)
            init_teams_storage(connection)
            self.assertEqual(connection.execute('SELECT count(*) FROM amateur_club_teams').fetchone()[0], 0)
