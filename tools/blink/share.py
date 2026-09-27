"""Share the Blink live view on a password-protected web page (for friends), with low added delay.

Blink live view -> blinkpy relay (with stream_fix) -> ffmpeg decodes and re-encodes 720p JPEG frames -> this
server pushes each new frame to every open page (MJPEG, 10 fps at 960 px, about 3-4 Mbps per viewer, typically +0.3-1 s on top of Blink's own ~3 s).
Blink ends live view every few minutes; the loop starts a new session right away (viewers see a short freeze).

    python share.py [--port 8090] [--camera Garage]
    then expose it:  cloudflared tunnel --url http://localhost:8090

Login: user "robotai", password in ~/blink/share_password.txt (made on first run). Nothing is recorded to disk.
"""
import argparse
import asyncio
import base64
import os
import secrets
import time

from aiohttp import ClientSession, web
from blinkpy.auth import Auth
from blinkpy.blinkpy import Blink
from blinkpy.helpers.util import json_load

from stream_fix import patch

patch()

HOME = os.path.expanduser("~/blink")
CREDS = os.path.join(HOME, "creds.json")
PWFILE = os.path.join(HOME, "share_password.txt")
USER = "robotai"

PAGE = """<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<title>robotai live</title><style>body{margin:0;background:#111;color:#ccc;font:14px system-ui;text-align:center}
img{max-width:100%;max-height:92vh;display:block;margin:0 auto}</style>
<img src="/stream" alt="live camera"><p id=s>Blink camera, about 3-4 s behind real time.</p>"""


class Latest:
    """Newest JPEG frame plus an event that fires on every new one."""

    def __init__(self):
        self.jpeg, self.t, self.cond = None, 0.0, asyncio.Condition()

    async def put(self, jpeg):
        async with self.cond:
            self.jpeg, self.t = jpeg, time.time()
            self.cond.notify_all()

    async def next(self):
        async with self.cond:
            await self.cond.wait()
            return self.jpeg


async def camera_loop(latest, camera):
    """Keep a Blink live session running forever; decode it to JPEG frames with ffmpeg."""
    async with ClientSession() as session:
        blink = Blink(session=session)
        blink.auth = Auth(await json_load(CREDS), no_prompt=True, session=session)
        await blink.start()
        await blink.save(CREDS)
        cam = blink.cameras[camera] if camera else next(iter(blink.cameras.values()))
        while True:
            try:
                stream = await cam.init_livestream()
                await stream.start()
                feed = asyncio.create_task(stream.feed())
                ff = await asyncio.create_subprocess_exec(
                    "ffmpeg", "-hide_banner", "-loglevel", "error",
                    "-fflags", "nobuffer+discardcorrupt", "-flags", "low_delay", "-probesize", "500000",
                    "-analyzeduration", "1000000", "-an", "-i", stream.url,   # probe ~1 s once per session so the video track is always found
                    "-vf", "fps=10,scale=960:-2", "-q:v", "9", "-f", "image2pipe", "-vcodec", "mjpeg", "-",
                    stdout=asyncio.subprocess.PIPE)
                buf = b""
                while True:
                    chunk = await ff.stdout.read(65536)
                    if not chunk:
                        break
                    buf += chunk
                    while True:                       # split the pipe into whole JPEGs (FFD8 ... FFD9)
                        a = buf.find(b"\xff\xd8")
                        z = buf.find(b"\xff\xd9", a + 2)
                        if a < 0 or z < 0:
                            break
                        await latest.put(buf[a:z + 2])
                        buf = buf[z + 2:]
                ff.kill()
                stream.stop()
                feed.cancel()
                print(time.strftime("%H:%M:%S"), "Blink ended the live session, reconnecting", flush=True)
            except Exception as e:                    # network / Blink API hiccup: wait and retry
                print(time.strftime("%H:%M:%S"), "stream error:", type(e).__name__, e, flush=True)
                await asyncio.sleep(10)
            await asyncio.sleep(2)


def make_app(latest, password):
    want = "Basic " + base64.b64encode(f"{USER}:{password}".encode()).decode()

    @web.middleware
    async def auth(request, handler):
        key = request.query.get("key", "")          # the site's /live page embeds /stream?key=... after asking for it
        if not (secrets.compare_digest(request.headers.get("Authorization", ""), want)
                or (key and secrets.compare_digest(key, password))):
            return web.Response(status=401, headers={"WWW-Authenticate": 'Basic realm="robotai live"'})
        return await handler(request)

    async def page(_):
        return web.Response(text=PAGE, content_type="text/html")

    async def stream(request):
        resp = web.StreamResponse(headers={"Content-Type": "multipart/x-mixed-replace; boundary=frame",
                                           "Cache-Control": "no-store"})
        await resp.prepare(request)
        if latest.jpeg:
            await resp.write(b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + latest.jpeg + b"\r\n")
        try:
            while True:
                jpeg = await latest.next()          # always the newest frame: slow viewers skip, never lag
                await resp.write(b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n")
        except (ConnectionResetError, asyncio.CancelledError):
            pass
        return resp

    app = web.Application(middlewares=[auth])
    app.add_routes([web.get("/", page), web.get("/stream", stream)])
    return app


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8090)
    ap.add_argument("--camera", default="")
    a = ap.parse_args()
    if not os.path.exists(PWFILE):
        with open(PWFILE, "w") as f:
            f.write(secrets.token_urlsafe(9))
    password = open(PWFILE).read().strip()
    latest = Latest()
    runner = web.AppRunner(make_app(latest, password))
    await runner.setup()
    await web.TCPSite(runner, "127.0.0.1", a.port).start()
    print(f"live page on http://127.0.0.1:{a.port}  (user {USER}, password in {PWFILE})", flush=True)
    await camera_loop(latest, a.camera)


if __name__ == "__main__":
    asyncio.run(main())
