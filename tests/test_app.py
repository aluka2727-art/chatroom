import tempfile
import sqlite3
import unittest
from pathlib import Path
from unittest.mock import patch

from app import create_app


class ChatroomTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "test.sqlite3"
        self.app = create_app({
            "TESTING": True,
            "SECRET_KEY": "test-secret-key",
            "DATABASE": str(self.database_path),
            "SESSION_COOKIE_SECURE": False,
        })
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_home_and_static_client_are_served(self):
        page = self.client.get("/")
        script = self.client.get("/static/app.js")
        self.assertEqual(page.status_code, 200)
        self.assertIn(b"/static/app.js", page.data)
        self.assertEqual(script.status_code, 200)
        script.close()

    def create_account(self, client=None):
        client = client or self.client
        token = client.get("/api/session").json["csrf_token"]
        response = client.post(
            "/api/auth",
            json={
                "mode": "create",
                "password": "correct-horse-battery",
                "confirm_password": "correct-horse-battery",
            },
            headers={"X-CSRF-Token": token},
        )
        self.assertEqual(response.status_code, 201, response.json)
        return response.json["user"], response.json["csrf_token"]

    def test_users_share_messages_between_clients(self):
        first_user, first_token = self.create_account()
        response = self.client.post(
            "/api/messages",
            json={"text": "Hello from another device"},
            headers={"X-CSRF-Token": first_token},
        )
        self.assertEqual(response.status_code, 201)

        second_client = self.app.test_client()
        second_user, _second_token = self.create_account(second_client)
        messages = second_client.get("/api/messages").json["messages"]
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0]["username"], first_user["username"])
        self.assertNotEqual(first_user["username"], second_user["username"])

    def test_existing_account_can_sign_in_from_another_client(self):
        user, _token = self.create_account()
        second_client = self.app.test_client()
        csrf = second_client.get("/api/session").json["csrf_token"]
        response = second_client.post(
            "/api/auth",
            json={"mode": "signin", "username": user["username"], "password": "correct-horse-battery"},
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(response.json["user"]["username"], user["username"])

    def test_deleted_author_stays_deleted_after_username_reuse(self):
        old_user, old_token = self.create_account()
        self.client.post(
            "/api/messages",
            json={"text": "The original author's message"},
            headers={"X-CSRF-Token": old_token},
        )
        old_username = old_user["username"]
        with sqlite3.connect(self.database_path) as database:
            database.execute("DELETE FROM accounts WHERE username = ?", (old_username,))

        with patch("app.secrets.choice", return_value=old_username):
            new_user, new_token = self.create_account()
        self.assertEqual(new_user["username"], old_username)

        response = self.client.get("/api/messages").json["messages"]
        self.assertEqual(response[0]["username"], "[DELETED]")
        self.client.post(
            "/api/messages",
            json={"text": "The new owner's message"},
            headers={"X-CSRF-Token": new_token},
        )
        response = self.client.get("/api/messages").json["messages"]
        self.assertEqual([message["username"] for message in response], ["[DELETED]", old_username])

    def test_cricket_is_reserved_and_delete_command_protects_admin(self):
        result = self.app.test_cli_runner().invoke(
            args=["create-admin"],
            input="admin-password-123\nadmin-password-123\n",
        )
        self.assertEqual(result.exit_code, 0, result.output)
        user, _token = self.create_account()
        self.assertNotEqual(user["username"], "Cricket")

        cleanup_result = self.app.test_cli_runner().invoke(args=["delete-non-admin-accounts"])
        self.assertEqual(cleanup_result.exit_code, 0, cleanup_result.output)
        with sqlite3.connect(self.database_path) as database:
            remaining = database.execute("SELECT username, role FROM accounts").fetchall()
        self.assertEqual(remaining, [("Cricket", "admin")])

        delete_result = self.app.test_cli_runner().invoke(args=["delete-user", "Cricket"])
        self.assertNotEqual(delete_result.exit_code, 0)
        self.assertIn("Admin accounts cannot be deleted", delete_result.output)

    def test_mutations_require_csrf_token(self):
        response = self.client.post("/api/auth", json={"mode": "create"})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()