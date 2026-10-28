import os
import secrets
import sqlite3
from functools import wraps
from pathlib import Path

import click
from flask import Flask, abort, g, jsonify, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash


ANIMALS = (
    "Alpaca", "Armadillo", "Badger", "Beaver", "Bison", "Bobcat", "Capybara",
    "Cheetah", "Chipmunk", "Coyote", "Cricket", "Dolphin", "Falcon", "Ferret",
    "Finch", "Gazelle", "Gecko", "Giraffe", "Hamster", "Heron", "Iguana",
    "Jackal", "Jaguar", "Kangaroo", "Koala", "Lemur", "Leopard", "Llama",
    "Lynx", "Macaw", "Manatee", "Marmot", "Meerkat", "Moose", "Narwhal",
    "Ocelot", "Octopus", "Okapi", "Otter", "Owl", "Panda", "Panther", "Parrot",
    "Pelican", "Penguin", "Platypus", "Puffin", "Puma", "Quokka", "Rabbit",
    "Raccoon", "Reindeer", "Salamander", "Seal", "Sloth", "Sparrow", "Squirrel",
    "Tapir", "Tiger", "Toucan", "Turtle", "Walrus", "Weasel", "Whale", "Wombat",
    "Yak", "Zebra", "Aardvark", "Anaconda", "Baboon", "Barracuda", "Bat", "Bear",
    "Beetle", "Bluejay", "Boar", "Butterfly", "Camel", "Cardinal", "Carp", "Cat",
    "Cobra", "Condor", "Crab", "Crane", "Crow", "Deer", "Dingo", "Eagle", "Eel",
    "Elephant", "Elk", "Emu", "Flamingo", "Fox", "Frog", "Goldfish", "Gorilla",
    "Grasshopper", "Hawk", "Antelope",
)
RESERVED_USERNAMES = {"Cricket"}
MAX_ACCOUNTS = 100
MAX_MESSAGE_LENGTH = 500


def create_app(test_config=None):
    project_dir = Path(__file__).resolve().parent
    app = Flask(__name__, template_folder=str(project_dir))
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("CHATROOM_SECRET_KEY"),
        DATABASE=os.environ.get("CHATROOM_DATABASE", str(project_dir / "chatroom.sqlite3")),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.environ.get("CHATROOM_COOKIE_SECURE", "0") == "1",
        PERMANENT_SESSION_LIFETIME=60 * 60 * 24 * 14,
        MAX_CONTENT_LENGTH=64 * 1024,
    )
    if test_config:
        app.config.update(test_config)

    def get_db():
        if "db" not in g:
            database_path = Path(app.config["DATABASE"])
            database_path.parent.mkdir(parents=True, exist_ok=True)
            connection = sqlite3.connect(database_path, timeout=10)
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys = ON")
            connection.execute("PRAGMA journal_mode = WAL")
            g.db = connection
        return g.db

    @app.teardown_appcontext
    def close_db(_error=None):
        connection = g.pop("db", None)
        if connection is not None:
            connection.close()

    def init_db():
        database = get_db()
        database.executescript(
            """
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL COLLATE NOCASE UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'member'
                    CHECK (role IN ('member', 'admin')),
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                author_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
                body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
                is_deleted INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            CREATE INDEX IF NOT EXISTS messages_id_idx ON messages(id);
            CREATE TABLE IF NOT EXISTS message_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS deleted_accounts (
                account_id INTEGER PRIMARY KEY,
                username TEXT NOT NULL,
                deleted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            CREATE TABLE IF NOT EXISTS account_warnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                message_id INTEGER,
                seen_at TEXT,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            """
        )
        message_columns = {
            row["name"] for row in database.execute("PRAGMA table_info(messages)")
        }
        if "is_deleted" not in message_columns:
            database.execute("ALTER TABLE messages ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0")
        database.executescript(
            """
            CREATE TRIGGER IF NOT EXISTS messages_insert_event
            AFTER INSERT ON messages
            BEGIN
                INSERT INTO message_events (message_id) VALUES (NEW.id);
            END;

            CREATE TRIGGER IF NOT EXISTS messages_update_event
            AFTER UPDATE OF author_id, body, is_deleted ON messages
            BEGIN
                INSERT INTO message_events (message_id) VALUES (NEW.id);
            END;
            """
        )
        if database.execute("SELECT COUNT(*) FROM message_events").fetchone()[0] == 0:
            database.execute("INSERT INTO message_events (message_id) SELECT id FROM messages")
            database.commit()

    with app.app_context():
        init_db()

    def csrf_token():
        token = session.get("csrf_token")
        if not token:
            token = secrets.token_urlsafe(32)
            session["csrf_token"] = token
        return token

    @app.before_request
    def protect_mutations():
        if request.method not in {"POST", "PUT", "PATCH", "DELETE"}:
            return None
        expected = session.get("csrf_token", "")
        supplied = request.headers.get("X-CSRF-Token", "")
        if not expected or not supplied or not secrets.compare_digest(expected, supplied):
            return jsonify(error="The request expired. Refresh and try again."), 400
        return None

    @app.after_request
    def prevent_private_caching(response):
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        return response

    def get_current_account():
        account_id = session.get("account_id")
        if not isinstance(account_id, int):
            return None
        return get_db().execute(
            "SELECT id, username, role FROM accounts WHERE id = ?",
            (account_id,),
        ).fetchone()

    def pending_warning_count(database, account_id):
        return database.execute(
            "SELECT COUNT(*) FROM account_warnings WHERE account_id = ? AND seen_at IS NULL",
            (account_id,),
        ).fetchone()[0]

    def login_required(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            account = get_current_account()
            if account is None:
                account_id = session.get("account_id")
                deleted = None
                if isinstance(account_id, int):
                    deleted = get_db().execute(
                        "SELECT username FROM deleted_accounts WHERE account_id = ?",
                        (account_id,),
                    ).fetchone()
                if deleted:
                    return jsonify(
                        error="This account was deleted by an admin.",
                        account_deleted=True,
                        deleted_username=deleted["username"],
                    ), 410
                return jsonify(error="Sign in to continue."), 401
            g.account = account
            return view(*args, **kwargs)

        return wrapped

    def admin_required(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if g.account["role"] != "admin" or g.account["username"].casefold() != "cricket":
                return jsonify(error="Admin access required."), 403
            return view(*args, **kwargs)

        return wrapped

    def tombstone_account(database, account):
        database.execute(
            "INSERT OR REPLACE INTO deleted_accounts (account_id, username) VALUES (?, ?)",
            (account["id"], account["username"]),
        )
        database.execute(
            "UPDATE messages SET body = '[DELETED]', is_deleted = 1, author_id = NULL WHERE author_id = ?",
            (account["id"],),
        )
        database.execute("DELETE FROM accounts WHERE id = ?", (account["id"],))

    @app.get("/")
    def index():
        csrf_token()
        return render_template("index.html")

    @app.get("/api/session")
    def api_session():
        database = get_db()
        account = get_current_account()
        account_id = session.get("account_id")
        deleted = None
        if account is None and isinstance(account_id, int):
            deleted = database.execute(
                "SELECT username FROM deleted_accounts WHERE account_id = ?",
                (account_id,),
            ).fetchone()
        return jsonify(
            csrf_token=csrf_token(),
            account_deleted=bool(deleted),
            deleted_username=deleted["username"] if deleted else None,
            user=(
                {
                    "id": account["id"],
                    "username": account["username"],
                    "role": account["role"],
                    "warning_count": pending_warning_count(database, account["id"]),
                }
                if account else None
            ),
        )

    @app.post("/api/auth")
    def api_auth():
        data = request.get_json(silent=True) or {}
        mode = data.get("mode")
        password = data.get("password", "")
        if not isinstance(password, str) or not 8 <= len(password) <= 1024:
            return jsonify(error="Use a password between 8 and 1024 characters."), 400

        database = get_db()
        account_id = None
        if mode == "create":
            if password != data.get("confirm_password"):
                return jsonify(error="Those passwords don't match."), 400
            database.execute("BEGIN IMMEDIATE")
            try:
                count = database.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
                if count >= MAX_ACCOUNTS:
                    database.rollback()
                    return jsonify(error="The room is full. There are no more account slots."), 409
                existing = {
                    row[0].casefold()
                    for row in database.execute("SELECT username FROM accounts")
                }
                available = [
                    name for name in ANIMALS
                    if name.casefold() not in RESERVED_USERNAMES
                    and name.casefold() not in existing
                ]
                if not available:
                    database.rollback()
                    return jsonify(error="No animal usernames are available."), 409
                username = secrets.choice(available)
                password_hash = generate_password_hash(password)
                cursor = database.execute(
                    "INSERT INTO accounts (username, password_hash) VALUES (?, ?)",
                    (username, password_hash),
                )
                account_id = cursor.lastrowid
                database.commit()
            except sqlite3.Error:
                database.rollback()
                app.logger.exception("Account creation failed")
                return jsonify(error="Could not create the account. Please try again."), 500
        elif mode == "signin":
            submitted_username = data.get("username", "")
            if not isinstance(submitted_username, str) or not submitted_username.isalpha():
                return jsonify(error="Username or password is incorrect."), 401
            account = database.execute(
                "SELECT id, username, password_hash, role FROM accounts WHERE username = ? COLLATE NOCASE",
                (submitted_username,),
            ).fetchone()
            if account is None:
                deleted = database.execute(
                    "SELECT username FROM deleted_accounts WHERE username = ? COLLATE NOCASE ORDER BY deleted_at DESC LIMIT 1",
                    (submitted_username,),
                ).fetchone()
                if deleted:
                    return jsonify(
                        error="This account was deleted by an admin.",
                        account_deleted=True,
                        deleted_username=deleted["username"],
                    ), 410
                return jsonify(error="Username or password is incorrect."), 401
            if not check_password_hash(account["password_hash"], password):
                return jsonify(error="Username or password is incorrect."), 401
            username = account["username"]
            account_id = account["id"]
            role = account["role"]
        else:
            return jsonify(error="Choose create account or sign in."), 400

        if mode == "create":
            role = "member"
        session.clear()
        session.permanent = True
        session["account_id"] = account_id
        token = csrf_token()
        return jsonify(
            user={"id": account_id, "username": username, "role": role, "warning_count": 0},
            csrf_token=token,
        ), 201 if mode == "create" else 200

    @app.post("/api/logout")
    def api_logout():
        session.clear()
        return jsonify(ok=True)

    @app.post("/api/warnings/acknowledge")
    @login_required
    def api_acknowledge_warnings():
        get_db().execute(
            "UPDATE account_warnings SET seen_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE account_id = ? AND seen_at IS NULL",
            (g.account["id"],),
        )
        get_db().commit()
        return jsonify(ok=True)

    @app.get("/api/messages")
    @login_required
    def api_messages():
        try:
            after_event = max(0, int(request.args.get("after", "0")))
        except ValueError:
            return jsonify(error="Invalid message cursor."), 400

        database = get_db()
        cursor = after_event
        if after_event:
            rows = database.execute(
                """
                WITH changed AS (
                    SELECT message_id, MAX(id) AS change_id
                    FROM message_events
                    WHERE id > ?
                    GROUP BY message_id
                    ORDER BY change_id ASC
                    LIMIT 100
                )
                SELECT m.id,
                       CASE WHEN m.is_deleted = 1 OR a.id IS NULL THEN '[DELETED]' ELSE m.body END AS body,
                       m.created_at,
                       COALESCE(a.username, '[DELETED]') AS username,
                       a.id = ? AS is_own,
                       m.is_deleted,
                       changed.change_id
                FROM messages AS m
                JOIN changed ON changed.message_id = m.id
                LEFT JOIN accounts AS a ON a.id = m.author_id
                ORDER BY changed.change_id ASC
                """,
                (after_event, g.account["id"]),
            ).fetchall()
            if rows:
                cursor = max(row["change_id"] for row in rows)
        else:
            rows = database.execute(
                """
                SELECT * FROM (
                    SELECT m.id,
                           CASE WHEN m.is_deleted = 1 OR a.id IS NULL THEN '[DELETED]' ELSE m.body END AS body,
                           m.created_at,
                           COALESCE(a.username, '[DELETED]') AS username,
                           a.id = ? AS is_own,
                           m.is_deleted
                    FROM messages AS m
                    LEFT JOIN accounts AS a ON a.id = m.author_id
                    ORDER BY m.id DESC LIMIT 100
                ) ORDER BY id ASC
                """,
                (g.account["id"],),
            ).fetchall()
            cursor = database.execute("SELECT COALESCE(MAX(id), 0) FROM message_events").fetchone()[0]
        return jsonify(messages=[
            {
                "id": row["id"],
                "username": row["username"],
                "text": row["body"],
                "created_at": row["created_at"],
                "is_own": bool(row["is_own"]),
                "is_deleted": bool(row["is_deleted"]),
            }
            for row in rows
        ], warnings=pending_warning_count(database, g.account["id"]), cursor=cursor)

    @app.post("/api/messages")
    @login_required
    def api_send_message():
        data = request.get_json(silent=True) or {}
        text = data.get("text", "")
        if not isinstance(text, str):
            return jsonify(error="Message must be text."), 400
        text = text.strip()
        if not text or len(text) > MAX_MESSAGE_LENGTH:
            return jsonify(error="Messages must be between 1 and 500 characters."), 400
        database = get_db()
        cursor = database.execute(
            "INSERT INTO messages (author_id, body) VALUES (?, ?)",
            (g.account["id"], text),
        )
        database.commit()
        return jsonify(id=cursor.lastrowid), 201

    @app.get("/api/admin/accounts")
    @login_required
    @admin_required
    def api_admin_accounts():
        rows = get_db().execute(
            """
            SELECT a.id, a.username, a.role, a.created_at, COUNT(m.id) AS message_count
            FROM accounts AS a
            LEFT JOIN messages AS m ON m.author_id = a.id
            GROUP BY a.id
            ORDER BY CASE WHEN a.username = 'Cricket' COLLATE NOCASE THEN 0 ELSE 1 END,
                     a.username COLLATE NOCASE
            """
        ).fetchall()
        return jsonify(accounts=[dict(row) for row in rows])

    @app.get("/api/admin/messages")
    @login_required
    @admin_required
    def api_admin_messages():
        rows = get_db().execute(
            """
            SELECT m.id,
                   CASE WHEN m.is_deleted = 1 OR a.id IS NULL THEN '[DELETED]' ELSE m.body END AS body,
                   m.created_at,
                   COALESCE(a.username, '[DELETED]') AS username,
                   m.is_deleted
            FROM messages AS m
            LEFT JOIN accounts AS a ON a.id = m.author_id
            ORDER BY m.id DESC LIMIT 200
            """
        ).fetchall()
        return jsonify(messages=[dict(row) for row in rows])

    @app.delete("/api/admin/accounts/<int:account_id>")
    @login_required
    @admin_required
    def api_admin_delete_account(account_id):
        database = get_db()
        database.execute("BEGIN IMMEDIATE")
        account = database.execute(
            "SELECT id, username, role FROM accounts WHERE id = ?",
            (account_id,),
        ).fetchone()
        if account is None:
            database.rollback()
            return jsonify(error="Account not found."), 404
        if account["id"] == g.account["id"] or account["username"].casefold() == "cricket" or account["role"] == "admin":
            database.rollback()
            return jsonify(error="Admin accounts cannot be deleted."), 403

        tombstone_account(database, account)
        database.commit()
        return jsonify(ok=True, username=account["username"])

    @app.delete("/api/admin/messages/<int:message_id>")
    @login_required
    @admin_required
    def api_admin_delete_message(message_id):
        database = get_db()
        database.execute("BEGIN IMMEDIATE")
        message = database.execute(
            "SELECT id, author_id, is_deleted FROM messages WHERE id = ?",
            (message_id,),
        ).fetchone()
        if message is None:
            database.rollback()
            return jsonify(error="Message not found."), 404
        if message["is_deleted"]:
            database.rollback()
            return jsonify(error="This message is already deleted."), 409
        if message["author_id"] is not None:
            database.execute(
                "INSERT INTO account_warnings (account_id, message_id) VALUES (?, ?)",
                (message["author_id"], message["id"]),
            )
        database.execute(
            "UPDATE messages SET body = '[DELETED]', is_deleted = 1 WHERE id = ?",
            (message_id,),
        )
        database.commit()
        return jsonify(ok=True, message_id=message_id)

    @app.cli.command("create-admin")
    def create_admin():
        """Create or promote the protected Cricket account."""
        database = get_db()
        existing = database.execute(
            "SELECT id FROM accounts WHERE username = 'Cricket' COLLATE NOCASE"
        ).fetchone()
        if existing:
            database.execute("UPDATE accounts SET role = 'admin' WHERE id = ?", (existing["id"],))
            database.commit()
            click.echo("Cricket is already registered and is now protected as admin.")
            return
        count = database.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
        if count >= MAX_ACCOUNTS:
            raise click.ClickException("The account limit has been reached.")
        password = click.prompt("Set Cricket's password", hide_input=True, confirmation_prompt=True)
        if not 8 <= len(password) <= 1024:
            raise click.ClickException("Password must be between 8 and 1024 characters.")
        database.execute(
            "INSERT INTO accounts (username, password_hash, role) VALUES ('Cricket', ?, 'admin')",
            (generate_password_hash(password),),
        )
        database.commit()
        click.echo("Cricket admin account created.")

    @app.cli.command("delete-user")
    @click.argument("username")
    def delete_user(username):
        """Delete a member; their messages remain marked [DELETED]."""
        database = get_db()
        account = database.execute(
            "SELECT id, username, role FROM accounts WHERE username = ? COLLATE NOCASE",
            (username,),
        ).fetchone()
        if account is None:
            raise click.ClickException("Account not found.")
        if account["username"].casefold() == "cricket" or account["role"] == "admin":
            raise click.ClickException("Admin accounts cannot be deleted with this command.")
        tombstone_account(database, account)
        database.commit()
        click.echo(f"Deleted {account['username']}; their messages are retained as [DELETED].")

    @app.cli.command("delete-non-admin-accounts")
    def delete_non_admin_accounts():
        """Delete all member accounts while preserving Cricket and message history."""
        database = get_db()
        admin = database.execute(
            "SELECT id FROM accounts WHERE username = 'Cricket' COLLATE NOCASE AND role = 'admin'"
        ).fetchone()
        if admin is None:
            raise click.ClickException("Cricket admin account is missing; nothing was deleted.")
        members = database.execute(
            "SELECT id, username FROM accounts WHERE id != ? AND role != 'admin'",
            (admin["id"],),
        ).fetchall()
        for member in members:
            tombstone_account(database, member)
        database.commit()
        click.echo(f"Deleted {len(members)} member accounts; chat history was preserved.")

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1")