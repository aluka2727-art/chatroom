import json
import sqlite3
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from pywebpush import WebPushException

from app import create_app


class ChatroomTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temp_dir.name) / "test.sqlite3"
        self.app = create_app({
            "TESTING": True,
            "SECRET_KEY": "test-secret-key",
            "DATABASE": str(self.database_path),
            "VAPID_PUBLIC_KEY": "",
            "VAPID_PRIVATE_KEY_FILE": "",
            "SESSION_COOKIE_SECURE": False,
        })
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_home_and_static_client_are_served(self):
        page = self.client.get("/")
        script = self.client.get("/static/app.js")
        self.assertEqual(page.status_code, 200)
        self.assertIn(b"v1.7.1", page.data)
        self.assertIn(b"unread-dot", page.data)
        self.assertIn(b"id=\"menuButton\"", page.data)
        self.assertIn(b"/static/app.js", page.data)
        self.assertIn(b"id=\"replyPreview\"", page.data)
        self.assertIn(b"id=\"settingsPanel\"", page.data)
        self.assertIn(b"id=\"pushToggle\"", page.data)
        self.assertIn(b"id=\"themeToggle\"", page.data)
        self.assertIn(b"/manifest.webmanifest", page.data)
        self.assertIn(b"favicon.ico", page.data)
        self.assertIn(b"apple-touch-icon.png", page.data)
        self.assertEqual(script.status_code, 200)
        self.assertIn(b"/api/push/subscriptions", script.data)
        self.assertIn(b"/api/reads", script.data)
        self.assertIn(b"/api/push/presence", script.data)
        self.assertIn(b"setAppBadge", script.data)
        self.assertIn(b"/sw.js", script.data)
        self.assertIn(b"Add to Home Screen", script.data)
        self.assertIn(b"pigin-notifications", script.data)
        self.assertIn(b"pigin-theme", script.data)
        self.assertIn(b"message-image", script.data)
        self.assertIn(b"noopener noreferrer", script.data)
        script.close()
        manifest = self.client.get("/manifest.webmanifest")
        self.assertEqual(manifest.status_code, 200)
        self.assertIn("application/manifest+json", manifest.content_type)
        self.assertIn(b'"display": "standalone"', manifest.data)

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
        self.assertIsNone(messages[0]["reply_to"])
        self.assertNotEqual(first_user["username"], second_user["username"])

    def test_room_messages_can_quote_and_refresh_deleted_messages(self):
        original_user, original_token = self.create_account()
        original = self.client.post(
            "/api/messages",
            json={"text": "A message worth quoting"},
            headers={"X-CSRF-Token": original_token},
        )
        self.assertEqual(original.status_code, 201, original.json)

        reply_client = self.app.test_client()
        _reply_user, reply_token = self.create_account(reply_client)
        cursor = reply_client.get("/api/messages").json["cursor"]
        invalid_reply = reply_client.post(
            "/api/messages",
            json={"text": "Invalid quote", "reply_to_id": 9999},
            headers={"X-CSRF-Token": reply_token},
        )
        self.assertEqual(invalid_reply.status_code, 400)

        sent = reply_client.post(
            "/api/messages",
            json={"text": "This is my reply", "reply_to_id": original.json["id"]},
            headers={"X-CSRF-Token": reply_token},
        )
        self.assertEqual(sent.status_code, 201, sent.json)
        reply = reply_client.get(f"/api/messages?after={cursor}").json["messages"][0]
        self.assertEqual(reply["username"], reply_client.get("/api/session").json["user"]["username"])
        self.assertEqual(reply["text"], "This is my reply")
        self.assertEqual(reply["reply_to"], {
            "id": original.json["id"],
            "username": original_user["username"],
            "text": "A message worth quoting",
        })

        admin_client, admin_token = self.create_admin()
        cursor = reply_client.get("/api/messages").json["cursor"]
        deleted = admin_client.delete(
            f"/api/admin/messages/{original.json['id']}",
            headers={"X-CSRF-Token": admin_token},
        )
        self.assertEqual(deleted.status_code, 200, deleted.json)
        updates = reply_client.get(f"/api/messages?after={cursor}").json["messages"]
        updated_reply = next(message for message in updates if message["id"] == sent.json["id"])
        self.assertEqual(updated_reply["reply_to"]["username"], "[DELETED]")
        self.assertEqual(updated_reply["reply_to"]["text"], "[DELETED]")

    def test_existing_database_migrates_reply_target_column(self):
        legacy_database = Path(self.temp_dir.name) / "legacy.sqlite3"
        with sqlite3.connect(legacy_database) as database:
            database.executescript(
                """
                CREATE TABLE accounts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL DEFAULT 'member',
                    created_at TEXT NOT NULL
                );
                CREATE TABLE messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    author_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
                    body TEXT NOT NULL,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE direct_messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sender_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                    recipient_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                    body TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                INSERT INTO accounts (username, password_hash, created_at)
                    VALUES ('Otter', 'hash', '2026-01-01T00:00:00Z');
                INSERT INTO messages (author_id, body, created_at)
                    VALUES (1, 'Existing message', '2026-01-01T00:00:00Z');
                """
            )

        create_app({
            "TESTING": True,
            "SECRET_KEY": "test-secret-key",
            "DATABASE": str(legacy_database),
            "SESSION_COOKIE_SECURE": False,
        })
        with sqlite3.connect(legacy_database) as database:
            columns = {row[1] for row in database.execute("PRAGMA table_info(messages)")}
            direct_message_columns = {
                row[1] for row in database.execute("PRAGMA table_info(direct_messages)")
            }
            existing_message = database.execute(
                "SELECT body, reply_to_id FROM messages WHERE id = 1"
            ).fetchone()
            direct_message_reply = database.execute(
                "SELECT reply_to_id FROM direct_messages"
            ).fetchone()
        self.assertIn("reply_to_id", columns)
        self.assertIn("reply_to_id", direct_message_columns)
        self.assertEqual(existing_message, ("Existing message", None))
        self.assertIsNone(direct_message_reply)

    def test_direct_messages_are_private_and_list_contacts(self):
        first_user, first_token = self.create_account()
        second_client = self.app.test_client()
        second_user, second_token = self.create_account(second_client)
        third_client = self.app.test_client()
        third_user, third_token = self.create_account(third_client)

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
            json={"text": "Only for you", "reply_to_id": sent.json["id"]},
            headers={"X-CSRF-Token": second_token},
        )
        self.assertEqual(reply.status_code, 201, reply.json)
        conversation = self.client.get(f"/api/dms/{second_user['id']}").json["messages"]
        self.assertEqual([message["text"] for message in conversation], ["A private hello", "Only for you"])
        self.assertEqual(conversation[0]["is_own"], True)
        self.assertEqual(conversation[1]["is_own"], False)
        self.assertEqual(conversation[1]["reply_to"], {
            "id": sent.json["id"],
            "username": first_user["username"],
            "text": "A private hello",
        })
        incremental = second_client.get(
            f"/api/dms/{first_user['id']}?after={first_read['cursor']}"
        ).json["messages"]
        self.assertEqual([message["text"] for message in incremental], ["Only for you"])

        third_message = third_client.post(
            f"/api/dms/{first_user['id']}",
            json={"text": "A different private conversation"},
            headers={"X-CSRF-Token": third_token},
        )
        cross_conversation_reply = self.client.post(
            f"/api/dms/{second_user['id']}",
            json={"text": "This must not quote the other DM", "reply_to_id": third_message.json["id"]},
            headers={"X-CSRF-Token": first_token},
        )
        self.assertEqual(cross_conversation_reply.status_code, 400)
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
        invalid_reply_id = self.client.post(
            f"/api/dms/{other['id']}",
            json={"text": "Invalid quote", "reply_to_id": "not-an-id"},
            headers=headers,
        )
        self.assertEqual(invalid_reply_id.status_code, 400)
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

    def test_existing_account_can_be_renamed_and_promoted_to_admin(self):
        user, _token = self.create_account()
        result = self.app.test_cli_runner().invoke(
            args=["promote-admin", user["username"], "--rename-to", "Viper"],
        )
        self.assertEqual(result.exit_code, 0, result.output)

        with sqlite3.connect(self.database_path) as database:
            account = database.execute(
                "SELECT username, role FROM accounts WHERE id = ?",
                (user["id"],),
            ).fetchone()
        self.assertEqual(account, ("Viper", "admin"))

        admin_client = self.app.test_client()
        token = admin_client.get("/api/session").json["csrf_token"]
        response = admin_client.post(
            "/api/auth",
            json={"mode": "signin", "username": "Viper", "password": "correct-horse-battery"},
            headers={"X-CSRF-Token": token},
        )
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(admin_client.get("/api/admin/accounts").status_code, 200)

        self.create_account(self.app.test_client())
        cleanup = self.app.test_cli_runner().invoke(args=["delete-non-admin-accounts"])
        self.assertEqual(cleanup.exit_code, 0, cleanup.output)
        with sqlite3.connect(self.database_path) as database:
            remaining = database.execute("SELECT username, role FROM accounts").fetchall()
        self.assertEqual(remaining, [("Viper", "admin")])

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

    def test_push_stays_off_until_the_server_has_keys(self):
        _user, token = self.create_account()
        config = self.client.get("/api/push/config")
        self.assertEqual(config.status_code, 200)
        self.assertFalse(config.json["enabled"])
        self.assertIsNone(config.json["public_key"])
        rejected = self.client.post(
            "/api/push/subscriptions",
            json={"endpoint": "https://push.example.test/device", "keys": {"p256dh": "key", "auth": "auth"}},
            headers={"X-CSRF-Token": token},
        )
        self.assertEqual(rejected.status_code, 503)
        self.assertEqual(self.client.post("/api/send-message", headers={"X-CSRF-Token": token}).status_code, 404)

    def test_direct_message_push_uses_saved_subscription(self):
        recipient, _recipient_token = self.create_account()
        sender_client = self.app.test_client()
        sender, sender_token = self.create_account(sender_client)
        private_key = Path(self.temp_dir.name) / "vapid.pem"
        private_key.write_text("test-private-key")
        self.app.config["VAPID_PUBLIC_KEY"] = "B" * 87
        self.app.config["VAPID_PRIVATE_KEY_FILE"] = str(private_key)
        self.app.config["VAPID_SUBJECT"] = "mailto:pigin@example.com"

        config = self.client.get("/api/push/config")
        self.assertTrue(config.json["enabled"])
        self.assertEqual(config.json["public_key"], "B" * 87)
        invalid = self.client.post(
            "/api/push/subscriptions",
            json={"endpoint": "http://push.example.test/device", "keys": {"p256dh": "key", "auth": "auth"}},
            headers={"X-CSRF-Token": self.client.get("/api/session").json["csrf_token"]},
        )
        self.assertEqual(invalid.status_code, 400)
        saved = self.client.post(
            "/api/push/subscriptions",
            json={
                "endpoint": "https://push.example.test/device",
                "keys": {"p256dh": "recipient-key", "auth": "recipient-auth"},
            },
            headers={"X-CSRF-Token": self.client.get("/api/session").json["csrf_token"]},
        )
        self.assertEqual(saved.status_code, 201, saved.json)

        with patch("app.webpush") as webpush:
            delivered = sender_client.post(
                f"/api/dms/{recipient['id']}",
                json={"text": "Ping"},
                headers={"X-CSRF-Token": sender_token},
            )
            self.assertEqual(delivered.status_code, 201, delivered.json)
            webpush.assert_called_once()
            subscription = webpush.call_args.kwargs["subscription_info"]
            self.assertEqual(subscription["endpoint"], "https://push.example.test/device")
            self.assertEqual(subscription["keys"]["p256dh"], "recipient-key")
            payload = webpush.call_args.kwargs["data"]
            self.assertIn(sender["username"], payload)
            self.assertIn(f"/?view=dms&with={sender['id']}", payload)
            self.assertEqual(webpush.call_args.kwargs["vapid_claims"]["sub"], "mailto:pigin@example.com")

        other_client = self.app.test_client()
        _other_user, other_token = self.create_account(other_client)
        untouched = other_client.delete(
            "/api/push/subscriptions",
            json={"endpoint": "https://push.example.test/device"},
            headers={"X-CSRF-Token": other_token},
        )
        self.assertEqual(untouched.status_code, 200)
        connection = sqlite3.connect(self.database_path)
        self.assertEqual(connection.execute("SELECT COUNT(*) FROM push_subscriptions").fetchone()[0], 1)

        removed = self.client.delete(
            "/api/push/subscriptions",
            json={"endpoint": "https://push.example.test/device"},
            headers={"X-CSRF-Token": self.client.get("/api/session").json["csrf_token"]},
        )
        self.assertEqual(removed.status_code, 200)
        self.assertEqual(connection.execute("SELECT COUNT(*) FROM push_subscriptions").fetchone()[0], 0)
        connection.close()

    def test_expired_push_subscription_is_removed(self):
        recipient, _recipient_token = self.create_account()
        sender_client = self.app.test_client()
        _sender, sender_token = self.create_account(sender_client)
        private_key = Path(self.temp_dir.name) / "vapid.pem"
        private_key.write_text("test-private-key")
        self.app.config["VAPID_PUBLIC_KEY"] = "B" * 87
        self.app.config["VAPID_PRIVATE_KEY_FILE"] = str(private_key)
        self.client.post(
            "/api/push/subscriptions",
            json={
                "endpoint": "https://push.example.test/gone",
                "keys": {"p256dh": "recipient-key", "auth": "recipient-auth"},
            },
            headers={"X-CSRF-Token": self.client.get("/api/session").json["csrf_token"]},
        )

        class Gone:
            status_code = 410
            text = "gone"

        with patch("app.webpush", side_effect=WebPushException("expired", response=Gone())):
            delivered = sender_client.post(
                f"/api/dms/{recipient['id']}",
                json={"text": "Still delivered in the app"},
                headers={"X-CSRF-Token": sender_token},
            )
        self.assertEqual(delivered.status_code, 201, delivered.json)
        connection = sqlite3.connect(self.database_path)
        self.assertEqual(connection.execute("SELECT COUNT(*) FROM push_subscriptions").fetchone()[0], 0)
        connection.close()

    def test_runtime_creates_vapid_keys_next_to_the_database(self):
        database = Path(self.temp_dir.name) / "runtime" / "chat.sqlite3"
        app = create_app({
            "SECRET_KEY": "test-secret-key",
            "DATABASE": str(database),
            "TESTING": False,
            "VAPID_PUBLIC_KEY": "",
            "VAPID_PRIVATE_KEY_FILE": "",
            "SESSION_COOKIE_SECURE": False,
        })
        client = app.test_client()
        token = client.get("/api/session").json["csrf_token"]
        created = client.post(
            "/api/auth",
            json={"mode": "create", "password": "correct-horse-battery", "confirm_password": "correct-horse-battery"},
            headers={"X-CSRF-Token": token},
        )
        self.assertEqual(created.status_code, 201, created.json)
        config = client.get("/api/push/config")
        public_key = config.json["public_key"]
        private_key = Path(app.config["VAPID_PRIVATE_KEY_FILE"])
        self.assertTrue(config.json["enabled"])
        self.assertTrue(public_key)
        self.assertNotIn("=", public_key)
        self.assertTrue(private_key.is_file())
        self.assertEqual(private_key.parent, database.resolve().parent)
        self.assertEqual((private_key.parent / "vapid_public.txt").read_text().strip(), public_key)
        worker = client.get("/sw.js")
        self.assertIn(b"badgeCount", worker.data)
        self.assertIn(b"setAppBadge", worker.data)
        worker.close()

    def enable_push(self, client, endpoint):
        private_key = Path(self.temp_dir.name) / "vapid.pem"
        private_key.write_text("test-private-key")
        self.app.config["VAPID_PUBLIC_KEY"] = "B" * 87
        self.app.config["VAPID_PRIVATE_KEY_FILE"] = str(private_key)
        self.app.config["VAPID_SUBJECT"] = "mailto:pigin@example.com"
        token = client.get("/api/session").json["csrf_token"]
        saved = client.post(
            "/api/push/subscriptions",
            json={"endpoint": endpoint, "keys": {"p256dh": "key", "auth": "auth"}},
            headers={"X-CSRF-Token": token},
        )
        self.assertEqual(saved.status_code, 201, saved.json)
        return token

    def test_unread_counts_follow_the_open_chat(self):
        first_user, first_token = self.create_account()
        self.client.post(
            "/api/messages",
            json={"text": "Already in the room"},
            headers={"X-CSRF-Token": first_token},
        )
        second_client = self.app.test_client()
        second_user, second_token = self.create_account(second_client)
        self.assertEqual(second_client.get("/api/messages").json["unread"]["group"], 0)
        third_client = self.app.test_client()
        _third_user, _third_token = self.create_account(third_client)
        self.assertEqual(third_client.get("/api/messages").json["unread"]["group"], 0)

        sent = self.client.post(
            "/api/messages",
            json={"text": "Hello room"},
            headers={"X-CSRF-Token": first_token},
        )
        self.assertEqual(sent.status_code, 201, sent.json)
        unread = second_client.get("/api/messages").json["unread"]
        self.assertEqual(unread["group"], 1)
        self.assertEqual(unread["total"], 1)
        self.assertEqual(self.client.get("/api/messages").json["unread"]["group"], 0)

        marked = second_client.post(
            "/api/reads",
            json={"kind": "chat"},
            headers={"X-CSRF-Token": second_token},
        )
        self.assertEqual(marked.status_code, 200, marked.json)
        self.assertEqual(marked.json["group"], 0)
        self.assertEqual(marked.json["total"], 0)

        self.client.post(
            f"/api/dms/{second_user['id']}",
            json={"text": "psst"},
            headers={"X-CSRF-Token": first_token},
        )
        dm_unread = second_client.get("/api/messages").json["unread"]
        self.assertEqual(dm_unread["dms"], 1)
        self.assertEqual(dm_unread["conversations"][str(first_user["id"])], 1)
        self.assertEqual(dm_unread["group"], 0)
        self.assertEqual(self.client.get("/api/messages").json["unread"]["dms"], 0)

        cleared = second_client.post(
            "/api/reads",
            json={"kind": "dm", "partner_id": first_user["id"]},
            headers={"X-CSRF-Token": second_token},
        )
        self.assertEqual(cleared.status_code, 200, cleared.json)
        self.assertEqual(cleared.json["total"], 0)
        rejected = second_client.post(
            "/api/reads",
            json={"kind": "nope"},
            headers={"X-CSRF-Token": second_token},
        )
        self.assertEqual(rejected.status_code, 400)

    def test_room_push_skips_the_open_tab_and_counts_the_badge(self):
        recipient, recipient_token = self.create_account()
        sender_client = self.app.test_client()
        sender, sender_token = self.create_account(sender_client)
        self.enable_push(self.client, "https://push.example.test/phone")
        self.enable_push(self.client, "https://push.example.test/desktop")
        self.enable_push(sender_client, "https://push.example.test/sender")

        with patch("app.webpush") as webpush:
            delivered = sender_client.post(
                "/api/messages",
                json={"text": "Hello room"},
                headers={"X-CSRF-Token": sender_token},
            )
            self.assertEqual(delivered.status_code, 201, delivered.json)
            self.assertEqual(webpush.call_count, 2)
            endpoints = {
                call.kwargs["subscription_info"]["endpoint"] for call in webpush.call_args_list
            }
            self.assertEqual(
                endpoints,
                {"https://push.example.test/phone", "https://push.example.test/desktop"},
            )
            payload = json.loads(webpush.call_args.kwargs["data"])
            self.assertEqual(payload["url"], "/?view=chat")
            self.assertIn(sender["username"], payload["title"])
            self.assertEqual(payload["badgeCount"], 1)
            self.assertEqual(payload["tag"], "pigin-chat")

        now_ms = int(time.time() * 1000)
        visible = self.client.post(
            "/api/push/presence",
            json={
                "endpoint": "https://push.example.test/desktop",
                "client_id": "desktop-tab-1",
                "visible": True,
                "reported_at": now_ms,
            },
            headers={"X-CSRF-Token": recipient_token},
        )
        self.assertEqual(visible.status_code, 200, visible.json)
        stale = self.client.post(
            "/api/push/presence",
            json={
                "endpoint": "https://push.example.test/desktop",
                "client_id": "desktop-tab-1",
                "visible": False,
                "reported_at": now_ms - 1_000,
            },
            headers={"X-CSRF-Token": recipient_token},
        )
        self.assertEqual(stale.status_code, 200, stale.json)

        with patch("app.webpush") as webpush:
            sender_client.post(
                "/api/messages",
                json={"text": "Still in the other tab"},
                headers={"X-CSRF-Token": sender_token},
            )
            self.assertEqual(webpush.call_count, 1)
            endpoint = webpush.call_args.kwargs["subscription_info"]["endpoint"]
            self.assertEqual(endpoint, "https://push.example.test/phone")
            self.assertEqual(json.loads(webpush.call_args.kwargs["data"])["badgeCount"], 2)

        hidden = self.client.post(
            "/api/push/presence",
            json={
                "endpoint": "https://push.example.test/desktop",
                "client_id": "desktop-tab-1",
                "visible": False,
                "reported_at": now_ms + 1_000,
            },
            headers={"X-CSRF-Token": recipient_token},
        )
        self.assertEqual(hidden.status_code, 200, hidden.json)
        with patch("app.webpush") as webpush:
            sender_client.post(
                f"/api/dms/{recipient['id']}",
                json={"text": "A direct one"},
                headers={"X-CSRF-Token": sender_token},
            )
            self.assertEqual(webpush.call_count, 2)
            payload = json.loads(webpush.call_args.kwargs["data"])
            self.assertIn(f"/?view=dms&with={sender['id']}", payload["url"])
            self.assertEqual(payload["badgeCount"], 3)


if __name__ == "__main__":
    unittest.main()