# Blink camera (Blink Mini 2K+, "Garage")

Cloud-only camera: its USB port is power-only and it has no local stream, so everything goes through Blink's servers.

Scripts:
- `login.py` - one-time login. You type your email, password and the SMS code yourself. Saves `~/blink/creds.json` (outside the repo, never committed).
- `snap.py` - takes one still (2560x1440) per camera and saves it to `~/blink/<name>.jpg`. It takes about 10 s; don't poll more often than about once a minute.
- `live.py` - live view through Blink's relay, shown in ffplay. It runs a few seconds behind and Blink cuts it after a few minutes. Nothing is saved to disk.

Setup: install `blinkpy` 0.25.5 in its own venv. `login.py` patches the sign-in so that Blink's SMS two-step answer (HTTP 202) counts as "code needed", because blinkpy only knows HTTP 412.
