# PIGIN Chat Room

This is a Flask chat app backed by SQLite. Accounts and messages are stored on the server and shared between visitors/devices. Passwords are hashed by Werkzeug; sessions use signed, HTTP-only cookies; mutating API calls require a CSRF token. Message authors are stored by account ID, so deleting an account leaves its messages visible as `[DELETED]`, and the username can be reused safely.

Browser-local profiles from the earlier static demo are not imported. Create the server-backed Cricket account with the CLI command below, then create/sign in to any other accounts on the deployed site.

The app has a 100-account limit. `Cricket` is reserved for the admin account. Never delete Cricket; the admin cleanup command refuses to do so.

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export CHATROOM_SECRET_KEY="$(python -c 'import secrets; print(secrets.token_hex(32))')"
flask --app app run --debug
```

Open `http://127.0.0.1:5000`. To create the protected Cricket account, run this in another terminal with the same virtual environment and database settings:

```bash
flask --app app create-admin
```

The command prompts for Cricket's password without echoing it. Use at least 8 characters. Local SQLite data is stored in `chatroom.sqlite3` unless `CHATROOM_DATABASE` is set.

## Test

```bash
python -m unittest discover -s tests -v
```

## Deploy on PythonAnywhere

1. In a PythonAnywhere Bash console, clone this public repository into your home directory:

	```bash
	git clone https://github.com/aluka2727-art/chatroom.git /home/YOURUSERNAME/chatroom
	```

	Replace `YOURUSERNAME` with your PythonAnywhere username. Do not put database files or secrets in the repository.
2. In a PythonAnywhere Bash console, create a private data directory and virtual environment. Match the Python version you select for the web app:

	```bash
	mkdir -p /home/YOURUSERNAME/chatroom/data
	mkvirtualenv --python=/usr/bin/python3.12 chatroom-venv
	pip install -r /home/YOURUSERNAME/chatroom/requirements.txt
	```

	Replace `YOURUSERNAME` and `python3.12` with your PythonAnywhere username and selected Python version.
3. Generate a long session secret in the Bash console and keep it private:

	```bash
	python -c 'import secrets; print(secrets.token_hex(32))'
	```

4. Open **Web** → **Add a new web app** → **Manual configuration**. Choose the same Python version as the virtual environment.
5. In **Virtualenv**, enter `/home/YOURUSERNAME/.virtualenvs/chatroom-venv`.
6. Open the WSGI configuration file linked on the Web tab and replace its contents with the following, substituting your username and the generated secret:

	```python
	import os
	import sys

	project_dir = "/home/YOURUSERNAME/chatroom"
	if project_dir not in sys.path:
	    sys.path.insert(0, project_dir)

	os.environ["CHATROOM_SECRET_KEY"] = "PASTE_YOUR_PRIVATE_RANDOM_SECRET_HERE"
	os.environ["CHATROOM_DATABASE"] = "/home/YOURUSERNAME/chatroom/data/chatroom.sqlite3"
	os.environ["CHATROOM_COOKIE_SECURE"] = "1"

	from app import app as application
	```

7. In the Web tab, add a static-files mapping for URL `/static/` to `/home/YOURUSERNAME/chatroom/static`.
8. Back in the Bash console, activate the virtual environment and create Cricket's admin profile. The database path must match the WSGI configuration:

	```bash
	workon chatroom-venv
	export CHATROOM_DATABASE=/home/YOURUSERNAME/chatroom/data/chatroom.sqlite3
	flask --app /home/YOURUSERNAME/chatroom/app.py create-admin
	```

	Set a strong, unique password at the prompt. The command creates Cricket or promotes an existing Cricket profile to admin; it does not delete messages.
9. Click **Reload** in the Web tab, then visit `https://YOURUSERNAME.pythonanywhere.com`.

10. To deploy later changes, push them to GitHub from your development machine, then update the PythonAnywhere checkout and reload the app:

	```bash
	cd /home/YOURUSERNAME/chatroom
	git pull --ff-only
	```

The SQLite database and secret must remain in your PythonAnywhere account and must not be committed or shared. Back up `data/chatroom.sqlite3` periodically. Set the same `CHATROOM_DATABASE` path in both WSGI and maintenance commands so they operate on the deployed database.

## Admin maintenance

Run these in a Bash console after activating the web app's virtual environment and setting `CHATROOM_DATABASE` to the deployed database path:

```bash
flask --app /home/YOURUSERNAME/chatroom/app.py delete-user USERNAME
flask --app /home/YOURUSERNAME/chatroom/app.py delete-non-admin-accounts
```

The second command requires an existing Cricket admin account, deletes only non-admin accounts, and retains messages as `[DELETED]`. Cricket is protected from the single-user delete command as well.