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
        self.assertIn(b"v1.1.1", page.data)
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

    def create_admin(self):
        result = self.app.test_cli_runner().invoke(
            args=["create-admin"],
            input="admin-password-123\nadmin-password-123\n",
        )
        self.assertEqual(result.exit_code, 0, result.output)
        client = self.app.test_client()
        token = client.get("/api/session").json["csrf_token"]
        response = client.post(
            "/api/auth",
            json={"mode": "signin", "username": "Cricket", "password": "admin-password-123"},
            headers={"X-CSRF-Token": token},
        )
        self.assertEqual(response.status_code, 200, response.json)
        return client, response.json["csrf_token"]

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

    def test_direct_messages_are_private_and_list_contacts(self):
        first_user, first_token = self.create_account()
        second_client = self.app.test_client()
        second_user, second_token = self.create_account(second_client)
        third_client = self.app.test_client()
        third_user, _third_token = self.create_account(third_client)

        sent = self.client.post(
            f"/api/dms/{second_user['id']}",
            json={"text": "A private hello"},
            headers={"X-CSRF-Token": first_token},
        )
        self.assertEqual(sent.status_code, 201, sent.json)
        first_read = second_client.get(f"/api/dms/{first_user['id']}").json
        self.assertEqual(first_read["messages"][0]["text"], "A private hello")
        self.assertEqual(third_client.get(f"/api/dms/{first_user['id']}").json["messages"], [])

        contacts = self.client.get("/api/dms").json["contacts"]
        second_contact = next(contact for contact in contacts if contact["id"] == second_user["id"])
        self.assertEqual(second_contact["last_message"], "A private hello")
        self.assertNotIn(first_user["id"], [contact["id"] for contact in contacts])

        reply = second_client.post(
            f"/api/dms/{first_user['id']}",
            json={"text": "Only for you"},
            headers={"X-CSRF-Token": second_token},
        )
        self.assertEqual(reply.status_code, 201, reply.json)
        conversation = self.client.get(f"/api/dms/{second_user['id']}").json["messages"]
        self.assertEqual([message["text"] for message in conversation], ["A private hello", "Only for you"])
        self.assertEqual(conversation[0]["is_own"], True)
        self.assertEqual(conversation[1]["is_own"], False)
        incremental = second_client.get(
            f"/api/dms/{first_user['id']}?after={first_read['cursor']}"
        ).json["messages"]
        self.assertEqual([message["text"] for message in incremental], ["Only for you"])
        self.assertNotEqual(first_user["id"], third_user["id"])

    def test_direct_messages_validate_recipient_and_content(self):
        user, token = self.create_account()
        headers = {"X-CSRF-Token": token}
        self.assertEqual(self.client.post(
            f"/api/dms/{user['id']}", json={"text": "self"}, headers=headers
        ).status_code, 400)
        self.assertEqual(self.client.post(
            "/api/dms/9999", json={"text": "missing"}, headers=headers
        ).status_code, 404)

        other_client = self.app.test_client()
        other, _other_token = self.create_account(other_client)
        invalid = self.client.post(
            f"/api/dms/{other['id']}", json={"text": " "}, headers=headers
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(self.client.get("/api/dms/9999").status_code, 404)

    def test_deleting_account_removes_its_direct_messages(self):
        admin_client, _admin_token = self.create_admin()
        sender_client = self.app.test_client()
        sender, sender_token = self.create_account(sender_client)
        recipient_client = self.app.test_client()
        recipient, _recipient_token = self.create_account(recipient_client)
        sender_client.post(
            f"/api/dms/{recipient['id']}",
            json={"text": "Private history"},
            headers={"X-CSRF-Token": sender_token},
        )

        accounts = admin_client.get("/api/admin/accounts").json["accounts"]
        account = next(item for item in accounts if item["id"] == sender["id"])
        csrf = admin_client.get("/api/session").json["csrf_token"]
        deleted = admin_client.delete(
            f"/api/admin/accounts/{account['id']}",
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(deleted.status_code, 200, deleted.json)
        self.assertEqual(recipient_client.get(f"/api/dms/{sender['id']}").status_code, 404)
        with sqlite3.connect(self.database_path) as database:
            count = database.execute("SELECT COUNT(*) FROM direct_messages").fetchone()[0]
        self.assertEqual(count, 0)

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

    def test_only_admin_can_open_admin_api(self):
        self.create_account()
        response = self.client.get("/api/admin/accounts")
        self.assertEqual(response.status_code, 403)

    def test_admin_account_delete_tombstones_messages_and_releases_name(self):
        admin_client, _admin_token = self.create_admin()
        member_client = self.app.test_client()
        member, member_token = self.create_account(member_client)
        member_client.post(
            "/api/messages",
            json={"text": "This belongs to the deleted profile"},
            headers={"X-CSRF-Token": member_token},
        )
        message_cursor = member_client.get("/api/messages").json["cursor"]
        accounts = admin_client.get("/api/admin/accounts").json["accounts"]
        member_account = next(account for account in accounts if account["username"] == member["username"])
        admin_token = admin_client.get("/api/session").json["csrf_token"]

        deleted = admin_client.delete(
            f"/api/admin/accounts/{member_account['id']}",
            headers={"X-CSRF-Token": admin_token},
        )
        self.assertEqual(deleted.status_code, 200, deleted.json)
        with patch("app.secrets.choice", return_value=member["username"]):
            replacement, _replacement_token = self.create_account(self.app.test_client())
        self.assertEqual(replacement["username"], member["username"])

        retained = admin_client.get(f"/api/messages?after={message_cursor}").json["messages"]
        self.assertEqual(retained[0]["username"], "[DELETED]")
        self.assertEqual(retained[0]["text"], "[DELETED]")
        self.assertNotEqual(replacement["id"], member["id"])
        deleted_session = member_client.get("/api/messages")
        self.assertEqual(deleted_session.status_code, 410)
        self.assertTrue(deleted_session.json["account_deleted"])
        session_status = member_client.get("/api/session")
        self.assertTrue(session_status.json["account_deleted"])
        self.assertEqual(session_status.json["deleted_username"], member["username"])

    def test_admin_message_delete_warns_author_and_keeps_account(self):
        admin_client, _admin_token = self.create_admin()
        member_client = self.app.test_client()
        member, member_token = self.create_account(member_client)
        initial = member_client.get("/api/messages").json
        member_client.post(
            "/api/messages",
            json={"text": "This message alone will be deleted"},
            headers={"X-CSRF-Token": member_token},
        )
        message = admin_client.get("/api/admin/messages").json["messages"][0]
        admin_token = admin_client.get("/api/session").json["csrf_token"]
        deleted = admin_client.delete(
            f"/api/admin/messages/{message['id']}",
            headers={"X-CSRF-Token": admin_token},
        )
        self.assertEqual(deleted.status_code, 200, deleted.json)

        update = member_client.get(f"/api/messages?after={initial['cursor']}").json
        self.assertEqual(update["warnings"], 1)
        self.assertEqual(update["messages"][0]["username"], member["username"])
        self.assertEqual(update["messages"][0]["text"], "[DELETED]")
        status = member_client.get("/api/session").json
        self.assertEqual(status["user"]["username"], member["username"])

        acknowledgement = member_client.post(
            "/api/warnings/acknowledge",
            headers={"X-CSRF-Token": status["csrf_token"]},
        )
        self.assertEqual(acknowledgement.status_code, 200)
        self.assertEqual(member_client.get("/api/session").json["user"]["warning_count"], 0)

    def test_mutations_require_csrf_token(self):
        response = self.client.post("/api/auth", json={"mode": "create"})
        self.assertEqual(response.status_code, 400)

    def test_authentication_rotates_csrf_token(self):
        stale_token = self.client.get("/api/session").json["csrf_token"]
        _user, fresh_token = self.create_account()

        stale_response = self.client.post(
            "/api/messages",
            json={"text": "This stale token must be rejected"},
            headers={"X-CSRF-Token": stale_token},
        )
        fresh_response = self.client.post(
            "/api/messages",
            json={"text": "This fresh token should work"},
            headers={"X-CSRF-Token": fresh_token},
        )
        self.assertEqual(stale_response.status_code, 400)
        self.assertEqual(fresh_response.status_code, 201)


if __name__ == "__main__":
    unittest.main()