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
        APP_VERSION="1.0.0",
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
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
            CREATE INDEX IF NOT EXISTS messages_id_idx ON messages(id);
            """
        )

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
        username = session.get("username")
        if not username:
            return None
        return get_db().execute(
            "SELECT id, username, role FROM accounts WHERE username = ? COLLATE NOCASE",
            (username,),
        ).fetchone()

    def login_required(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            account = get_current_account()
            if account is None:
                return jsonify(error="Sign in to continue."), 401
            g.account = account
            return view(*args, **kwargs)

        return wrapped

    @app.get("/")
    def index():
        csrf_token()
        return render_template("index.html")

    @app.get("/api/session")
    def api_session():
        account = get_current_account()
        return jsonify(
            csrf_token=csrf_token(),
            user=(
                {"username": account["username"], "role": account["role"]}
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
                database.execute(
                    "INSERT INTO accounts (username, password_hash) VALUES (?, ?)",
                    (username, password_hash),
                )
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
                "SELECT username, password_hash FROM accounts WHERE username = ? COLLATE NOCASE",
                (submitted_username,),
            ).fetchone()
            if account is None or not check_password_hash(account["password_hash"], password):
                return jsonify(error="Username or password is incorrect."), 401
            username = account["username"]
        else:
            return jsonify(error="Choose create account or sign in."), 400

        session.clear()
        session.permanent = True
        session["username"] = username
        token = csrf_token()
        return jsonify(user={"username": username}, csrf_token=token), 201 if mode == "create" else 200

    @app.post("/api/logout")
    @login_required
    def api_logout():
        session.clear()
        return jsonify(ok=True)

    @app.get("/api/messages")
    @login_required
    def api_messages():
        try:
            after_id = max(0, int(request.args.get("after", "0")))
        except ValueError:
            return jsonify(error="Invalid message cursor."), 400

        database = get_db()
        if after_id:
            rows = database.execute(
                """
                SELECT m.id, m.body, m.created_at,
                       COALESCE(a.username, '[DELETED]') AS username,
                       a.id = ? AS is_own
                FROM messages AS m
                LEFT JOIN accounts AS a ON a.id = m.author_id
                WHERE m.id > ?
                ORDER BY m.id ASC LIMIT 100
                """,
                (g.account["id"], after_id),
            ).fetchall()
        else:
            rows = database.execute(
                """
                SELECT * FROM (
                    SELECT m.id, m.body, m.created_at,
                           COALESCE(a.username, '[DELETED]') AS username,
                           a.id = ? AS is_own
                    FROM messages AS m
                    LEFT JOIN accounts AS a ON a.id = m.author_id
                    ORDER BY m.id DESC LIMIT 100
                ) ORDER BY id ASC
                """,
                (g.account["id"],),
            ).fetchall()
        return jsonify(messages=[
            {
                "id": row["id"],
                "username": row["username"],
                "text": row["body"],
                "created_at": row["created_at"],
                "is_own": bool(row["is_own"]),
            }
            for row in rows
        ])

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
        database.execute("DELETE FROM accounts WHERE id = ?", (account["id"],))
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
        cursor = database.execute(
            "DELETE FROM accounts WHERE id != ? AND role != 'admin'",
            (admin["id"],),
        )
        database.commit()
        click.echo(f"Deleted {cursor.rowcount} member accounts; chat history was preserved.")

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1")