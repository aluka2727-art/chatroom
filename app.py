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
RESERVED_USERNAMES = {"Cricket", "Viper"}
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
                reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            CREATE INDEX IF NOT EXISTS messages_id_idx ON messages(id);
            CREATE TABLE IF NOT EXISTS direct_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                recipient_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
                body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            CREATE INDEX IF NOT EXISTS direct_messages_sender_idx
                ON direct_messages(sender_id, recipient_id, id);
            CREATE INDEX IF NOT EXISTS direct_messages_recipient_idx
                ON direct_messages(recipient_id, sender_id, id);
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
        if "reply_to_id" not in message_columns:
            database.execute(
                "ALTER TABLE messages ADD COLUMN reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL"
            )
        database.executescript(
            """
            CREATE TRIGGER IF NOT EXISTS messages_insert_event
            AFTER INSERT ON messages
            BEGIN
                INSERT INTO message_events (message_id) VALUES (NEW.id);
            END;

            DROP TRIGGER IF EXISTS messages_update_event;
            CREATE TRIGGER messages_update_event
            AFTER UPDATE OF author_id, body, is_deleted ON messages
            BEGIN
                INSERT INTO message_events (message_id) VALUES (NEW.id);
                INSERT INTO message_events (message_id)
                    SELECT id FROM messages WHERE reply_to_id = NEW.id;
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
            if g.account["role"] != "admin":
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
                       replied.id AS reply_id,
                       CASE WHEN replied.is_deleted = 1 OR replied.author_id IS NULL
                            THEN '[DELETED]' ELSE replied_author.username END AS reply_username,
                       CASE WHEN replied.is_deleted = 1 OR replied.author_id IS NULL
                            THEN '[DELETED]' ELSE replied.body END AS reply_body,
                       changed.change_id
                FROM messages AS m
                JOIN changed ON changed.message_id = m.id
                LEFT JOIN accounts AS a ON a.id = m.author_id
                LEFT JOIN messages AS replied ON replied.id = m.reply_to_id
                LEFT JOIN accounts AS replied_author ON replied_author.id = replied.author_id
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
                           m.is_deleted,
                           replied.id AS reply_id,
                           CASE WHEN replied.is_deleted = 1 OR replied.author_id IS NULL
                                THEN '[DELETED]' ELSE replied_author.username END AS reply_username,
                           CASE WHEN replied.is_deleted = 1 OR replied.author_id IS NULL
                                THEN '[DELETED]' ELSE replied.body END AS reply_body
                    FROM messages AS m
                    LEFT JOIN accounts AS a ON a.id = m.author_id
                    LEFT JOIN messages AS replied ON replied.id = m.reply_to_id
                    LEFT JOIN accounts AS replied_author ON replied_author.id = replied.author_id
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
                "reply_to": None if row["reply_id"] is None else {
                    "id": row["reply_id"],
                    "username": row["reply_username"],
                    "text": row["reply_body"],
                },
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
        reply_to_id = data.get("reply_to_id")
        if reply_to_id is not None:
            if type(reply_to_id) is not int or reply_to_id < 1:
                return jsonify(error="Invalid reply target."), 400
            reply_to = database.execute(
                """
                SELECT id FROM messages
                WHERE id = ? AND is_deleted = 0 AND author_id IS NOT NULL
                """,
                (reply_to_id,),
            ).fetchone()
            if reply_to is None:
                return jsonify(error="This message is no longer available to reply to."), 400
        cursor = database.execute(
            "INSERT INTO messages (author_id, body, reply_to_id) VALUES (?, ?, ?)",
            (g.account["id"], text, reply_to_id),
        )
        database.commit()
        return jsonify(id=cursor.lastrowid), 201

    @app.get("/api/dms")
    @login_required
    def api_dm_contacts():
        rows = get_db().execute(
            """
            SELECT a.id, a.username, d.body AS last_message, d.created_at AS last_message_at
            FROM accounts AS a
            LEFT JOIN direct_messages AS d ON d.id = (
                SELECT latest.id
                FROM direct_messages AS latest
                WHERE (latest.sender_id = ? AND latest.recipient_id = a.id)
                   OR (latest.sender_id = a.id AND latest.recipient_id = ?)
                ORDER BY latest.id DESC
                LIMIT 1
            )
            WHERE a.id != ?
            ORDER BY CASE WHEN d.id IS NULL THEN 1 ELSE 0 END,
                     d.id DESC,
                     a.username COLLATE NOCASE
            """,
            (g.account["id"], g.account["id"], g.account["id"]),
        ).fetchall()
        return jsonify(contacts=[dict(row) for row in rows])

    @app.get("/api/dms/<int:account_id>")
    @login_required
    def api_dm_messages(account_id):
        if account_id == g.account["id"]:
            return jsonify(error="You can't start a conversation with yourself."), 400
        try:
            after_id = max(0, int(request.args.get("after", "0")))
        except ValueError:
            return jsonify(error="Invalid message cursor."), 400

        database = get_db()
        if database.execute("SELECT 1 FROM accounts WHERE id = ?", (account_id,)).fetchone() is None:
            return jsonify(error="Account not found."), 404
        parameters = (g.account["id"], account_id, account_id, g.account["id"])
        if after_id:
            rows = database.execute(
                """
                SELECT d.id, d.sender_id, d.body, d.created_at, a.username
                FROM direct_messages AS d
                JOIN accounts AS a ON a.id = d.sender_id
                WHERE ((d.sender_id = ? AND d.recipient_id = ?)
                    OR (d.sender_id = ? AND d.recipient_id = ?))
                  AND d.id > ?
                ORDER BY d.id ASC
                LIMIT 100
                """,
                (*parameters, after_id),
            ).fetchall()
        else:
            rows = database.execute(
                """
                SELECT * FROM (
                    SELECT d.id, d.sender_id, d.body, d.created_at, a.username
                    FROM direct_messages AS d
                    JOIN accounts AS a ON a.id = d.sender_id
                    WHERE (d.sender_id = ? AND d.recipient_id = ?)
                       OR (d.sender_id = ? AND d.recipient_id = ?)
                    ORDER BY d.id DESC
                    LIMIT 100
                ) ORDER BY id ASC
                """,
                parameters,
            ).fetchall()
        cursor = max((row["id"] for row in rows), default=after_id)
        return jsonify(
            messages=[
                {
                    "id": row["id"],
                    "username": row["username"],
                    "text": row["body"],
                    "created_at": row["created_at"],
                    "is_own": row["sender_id"] == g.account["id"],
                }
                for row in rows
            ],
            cursor=cursor,
        )

    @app.post("/api/dms/<int:account_id>")
    @login_required
    def api_send_dm(account_id):
        if account_id == g.account["id"]:
            return jsonify(error="You can't send a message to yourself."), 400
        data = request.get_json(silent=True) or {}
        text = data.get("text", "")
        if not isinstance(text, str):
            return jsonify(error="Message must be text."), 400
        text = text.strip()
        if not text or len(text) > MAX_MESSAGE_LENGTH:
            return jsonify(error="Messages must be between 1 and 500 characters."), 400

        database = get_db()
        if database.execute("SELECT 1 FROM accounts WHERE id = ?", (account_id,)).fetchone() is None:
            return jsonify(error="Account not found."), 404
        cursor = database.execute(
            "INSERT INTO direct_messages (sender_id, recipient_id, body) VALUES (?, ?, ?)",
            (g.account["id"], account_id, text),
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
            ORDER BY CASE WHEN a.role = 'admin' THEN 0 ELSE 1 END,
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
        """Create or promote the protected Cricket admin account."""
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

    @app.cli.command("promote-admin")
    @click.argument("username")
    @click.option("--rename-to", "new_username", help="Rename the account while promoting it.")
    def promote_admin(username, new_username):
        """Promote an existing account to admin, optionally renaming it."""
        database = get_db()
        database.execute("BEGIN IMMEDIATE")
        account = database.execute(
            "SELECT id, username FROM accounts WHERE username = ? COLLATE NOCASE",
            (username,),
        ).fetchone()
        if account is None:
            database.rollback()
            raise click.ClickException("Account not found.")

        updated_username = new_username or account["username"]
        conflict = database.execute(
            "SELECT 1 FROM accounts WHERE username = ? COLLATE NOCASE AND id != ?",
            (updated_username, account["id"]),
        ).fetchone()
        if conflict:
            database.rollback()
            raise click.ClickException(f"Username {updated_username} is already in use.")

        database.execute(
            "UPDATE accounts SET username = ?, role = 'admin' WHERE id = ?",
            (updated_username, account["id"]),
        )
        database.commit()
        click.echo(f"{account['username']} is now {updated_username} and is an admin.")

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
            "SELECT id FROM accounts WHERE role = 'admin' LIMIT 1"
        ).fetchone()
        if admin is None:
            raise click.ClickException("No admin account exists; nothing was deleted.")
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
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#101116">
<title>Chat</title>

<style>
:root {
  color-scheme: dark;
  --bg: #101116;
  --panel: #191a22;
  --message: #242630;
  --border: #363844;
  --accent: #647cff;
  --text: #f5f5f7;
  --muted: #a6a8b5;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, -apple-system, sans-serif;
}

button, input, textarea { font: inherit; }

button {
  border: 0;
  border-radius: 8px;
  background: var(--accent);
  color: white;
  padding: 10px 14px;
  cursor: pointer;
}

button:disabled { opacity: .5; }

input, textarea {
  width: 100%;
  padding: 12px;
  background: #12131a;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: white;
}

.app {
  max-width: 850px;
  margin: auto;
  padding: 16px;
  min-height: 100dvh;
}

header, .chat-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

header {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}

h1 { font-size: 24px; }

#status, .hint {
  color: var(--muted);
  font-size: 13px;
}

.panel {
  max-width: 420px;
  margin: 40px auto;
  padding: 20px;
  background: var(--panel);
  border-radius: 12px;
}

#login-form { display: grid; gap: 12px; }

.login-buttons { display: flex; gap: 10px; }
.login-buttons button { flex: 1; }

#error { color: #ff9696; }

#chat-panel {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 115px);
  min-height: 400px;
}

#chat-panel[hidden], #login-panel[hidden] { display: none; }

#messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px 0;
}

.message {
  position: relative;
  padding: 12px;
  margin: 10px 0;
  border: 1px solid transparent;
  border-radius: 10px;
  background: var(--message);
  overflow-wrap: anywhere;
}

.message:hover, .message:focus-within {
  border-color: var(--border);
}

.message-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.username { font-weight: bold; }

.timestamp {
  color: var(--muted);
  font-size: 12px;
}

.message-text {
  margin: 0;
  white-space: pre-wrap;
}

.reply-button {
  display: none;
  position: absolute;
  top: 8px;
  right: 8px;
  background: #393d50;
  padding: 6px 10px;
}

.message:hover .reply-button,
.message:focus-within .reply-button {
  display: block;
}

.reply-quote {
  display: block;
  width: 100%;
  text-align: left;
  margin-bottom: 10px;
  background: #171923;
  border-left: 3px solid var(--accent);
  color: var(--muted);
  overflow-wrap: anywhere;
}

#reply-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 12px;
  margin-bottom: 10px;
  background: var(--panel);
  border-left: 4px solid var(--accent);
}

#reply-preview[hidden] { display: none; }

#reply-preview-text {
  overflow-wrap: anywhere;
  color: var(--muted);
}

#chat-form {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

#message-input {
  resize: vertical;
  min-height: 44px;
  max-height: 140px;
}

@media (hover: none) {
  .reply-button {
    display: inline-block;
    position: static;
    margin-top: 10px;
  }
}

@media (max-width: 520px) {
  .app { padding: 10px; }
  header { align-items: flex-start; flex-direction: column; }
  #notifications-button { width: 100%; }
  #chat-panel { height: calc(100dvh - 160px); }
  #chat-form { gap: 6px; }
}
</style>
</head>

<body>
<div class="app">

  <header>
    <div>
      <h1>Chat</h1>
      <p id="status">Sign in to start chatting</p>
    </div>
    <button id="notifications-button">
      🔔 Enable notifications
    </button>
  </header>

  <section id="login-panel" class="panel">
    <h2>Welcome to Chat</h2>

    <form id="login-form">
      <input id="email" type="email"
        placeholder="Email address" autocomplete="email" required>

      <input id="password" type="password"
        placeholder="Password" minlength="6"
        autocomplete="current-password" required>

      <input id="display-name" type="text"
        placeholder="Display name (for registration)"
        maxlength="40">

      <div class="login-buttons">
        <button type="submit">Sign in</button>
        <button type="button" id="register-button">
          Create account
        </button>
      </div>
    </form>

    <p id="error" role="alert"></p>
  </section>

  <section id="chat-panel" hidden>
    <div class="chat-heading">
      <span id="current-user"></span>
      <button id="logout-button">Sign out</button>
    </div>

    <main id="messages" aria-live="polite"></main>

    <div id="reply-preview" hidden>
      <div>
        <strong>Replying to</strong>
        <div id="reply-preview-text"></div>
      </div>
      <button type="button" id="cancel-reply">✕</button>
    </div>

    <form id="chat-form">
      <textarea id="message-input" maxlength="4000"
        placeholder="Write a message..." rows="2" required></textarea>
      <button id="send-button" type="submit">Send</button>
    </form>

    <p class="hint">Hover over a message and click Reply.</p>
  </section>
</div>

<script type="module">
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";

import {
  getAuth, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, onAuthStateChanged,
  updateProfile, signOut
} from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

import {
  getFirestore, collection, addDoc, doc, setDoc,
  query, orderBy, onSnapshot, serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

import {
  getMessaging, getToken, onMessage, isSupported
} from
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging.js";

/*
  FIREBASE SETUP REQUIRED:
  Replace every placeholder with your Firebase web configuration.
*/
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const VAPID_PUBLIC_KEY = "YOUR_PUBLIC_VAPID_KEY";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let messaging = null;

try {
  if (await isSupported()) messaging = getMessaging(app);
} catch (error) {
  console.warn("Push messaging is unavailable", error);
}

const $ = id => document.getElementById(id);

let currentUser = null;
let replyingTo = null;
let stopMessages = null;
let sending = false;

function setStatus(text) {
  $("status").textContent = text;
}

function clearReply() {
  replyingTo = null;
  $("reply-preview").hidden = true;
  $("reply-preview-text").textContent = "";
}

function selectReply(id, message) {
  replyingTo = {
    id,
    username: message.username || "User",
    text: message.text
  };

  $("reply-preview-text").textContent =
    `${replyingTo.username}: ${replyingTo.text}`;

  $("reply-preview").hidden = false;
  $("message-input").focus();
}

function jumpToMessage(id) {
  const target = [...$("messages").children]
    .find(el => el.dataset.messageId === id);

  if (!target) {
    alert("Original message isn't currently loaded.");
    return;
  }

  target.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderMessage(id, message) {
  const article = document.createElement("article");
  article.className = "message";
  article.dataset.messageId = id;

  if (message.replyTo) {
    const quote = document.createElement("button");
    quote.type = "button";
    quote.className = "reply-quote";
    quote.textContent =
      `↩ ${message.replyTo.username}: ${message.replyTo.text}`;

    quote.addEventListener("click", () => {
      jumpToMessage(message.replyTo.id);
    });

    article.appendChild(quote);
  }

  const header = document.createElement("div");
  header.className = "message-header";

  const name = document.createElement("span");
  name.className = "username";
  name.textContent = message.username || "User";

  const time = document.createElement("span");
  time.className = "timestamp";

  if (message.createdAt?.toDate) {
    time.textContent = message.createdAt.toDate().toLocaleTimeString(
      [], { hour: "numeric", minute: "2-digit" }
    );
  }

  header.append(name, time);

  const body = document.createElement("p");
  body.className = "message-text";
  body.textContent = message.text || "";

  const replyButton = document.createElement("button");
  replyButton.type = "button";
  replyButton.className = "reply-button";
  replyButton.textContent = "↩ Reply";

  replyButton.addEventListener("click", () => {
    selectReply(id, message);
  });

  article.append(header, body, replyButton);
  $("messages").appendChild(article);
}

function listenToMessages() {
  if (stopMessages) stopMessages();

  const messagesQuery = query(
    collection(db, "messages"),
    orderBy("createdAt", "asc")
  );

  stopMessages = onSnapshot(messagesQuery, snapshot => {
    const nearBottom =
      $("messages").scrollHeight -
      $("messages").scrollTop -
      $("messages").clientHeight < 100;

    $("messages").replaceChildren();

    snapshot.forEach(item => renderMessage(item.id, item.data()));

    if (nearBottom) {
      $("messages").scrollTop = $("messages").scrollHeight;
    }

    setStatus("Connected");
  }, error => {
    console.error(error);
    setStatus("Couldn't load messages");
  });
}

// Sign in.
$("login-form").addEventListener("submit", async event => {
  event.preventDefault();
  $("error").textContent = "";

  try {
    await signInWithEmailAndPassword(
      auth, $("email").value.trim(), $("password").value
    );
  } catch (error) {
    $("error").textContent = error.message;
  }
});

// Register.
$("register-button").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  const name = $("display-name").value.trim();

  if (!name) {
    $("error").textContent = "Enter a display name first.";
    return;
  }

  try {
    const credential = await createUserWithEmailAndPassword(
      auth, email, password
    );

    await updateProfile(credential.user, { displayName: name });

    await setDoc(doc(db, "users", credential.user.uid), {
      displayName: name,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    $("error").textContent = error.message;
  }
});

// Sign out.
$("logout-button").addEventListener("click", async () => {
  if (stopMessages) stopMessages();
  stopMessages = null;
  clearReply();
  await signOut(auth);
});

// Cancel reply.
$("cancel-reply").addEventListener("click", clearReply);

// Send message or reply.
$("chat-form").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser || sending) return;

  const text = $("message-input").value.trim();
  if (!text) return;

  sending = true;
  $("send-button").disabled = true;

  try {
    await addDoc(collection(db, "messages"), {
      text,
      uid: currentUser.uid,
      username: currentUser.displayName || "User",
      replyTo: replyingTo ? { ...replyingTo } : null,
      createdAt: serverTimestamp()
    });

    $("message-input").value = "";
    clearReply();
  } catch (error) {
    console.error(error);
    alert("Couldn't send your message. Check your database setup.");
  } finally {
    sending = false;
    $("send-button").disabled = false;
  }
});

// Enable push notifications on this device.
$("notifications-button").addEventListener("click", async () => {
  try {
    if (!currentUser) {
      alert("Sign in first.");
      return;
    }

    if (!messaging || !("Notification" in window) ||
        !("serviceWorker" in navigator)) {
      alert("Push notifications aren't supported in this browser.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("Please allow notifications in your browser settings.");
      return;
    }

    const registration = await navigator.serviceWorker.register(
      "./firebase-messaging-sw.js"
    );

    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });

    if (!token) throw new Error("No push token was returned.");

    /*
      For a GitHub Pages website, this only stores the device token.
      It does NOT send push notifications by itself.

      Deploy a secure backend/Cloud Function that sends messages
      to registered tokens when other users send chat messages.
    */
    await setDoc(
      doc(db, "users", currentUser.uid, "pushTokens", token),
      { token, updatedAt: serverTimestamp() }
    );

    alert("This device is registered for notifications!");
  } catch (error) {
    console.error(error);
    alert("Notification setup failed: " + error.message);
  }
});

if (messaging) {
  onMessage(messaging, payload => {
    setStatus(payload.notification?.title || "New message received");
  });
}

// Watch authentication.
onAuthStateChanged(auth, user => {
  currentUser = user;

  $("login-panel").hidden = !!user;
  $("chat-panel").hidden = !user;

  if (!user) {
    if (stopMessages) stopMessages();
    stopMessages = null;
    $("messages").replaceChildren();
    clearReply();
    setStatus("Sign in to start chatting");
    return;
  }

  $("current-user").textContent =
    `Signed in as ${user.displayName || user.email}`;

  listenToMessages();
});
</script>
</body>
</html>
```
