"""Live video from the Blink camera on this PC: blinkpy opens Blink's live-view relay and serves it on a local TCP
port, then ffplay shows it. Uses the saved login in creds.json (no password needed).

    C:\\Users\\conno\\blinkenv\\Scripts\\python.exe C:\\Users\\conno\\blink\\live.py [camera name]
"""
import asyncio
import os
import subprocess
import sys

from aiohttp import ClientSession
from blinkpy.auth import Auth
from blinkpy.blinkpy import Blink
from blinkpy.helpers.util import json_load

from stream_fix import patch

patch()           # blinkpy 0.25.5 kills the stream on the first split TCP packet

CREDS = os.path.expanduser("~/blink/creds.json")   # kept outside the repo, never committed


async def main():
    async with ClientSession() as session:
        blink = Blink(session=session)
        blink.auth = Auth(await json_load(CREDS), no_prompt=True, session=session)
        if not await blink.start() or not blink.cameras:
            sys.exit("Blink login failed - run login.py again")
        await blink.save(CREDS)
        name = sys.argv[1] if len(sys.argv) > 1 else next(iter(blink.cameras))
        cam = blink.cameras[name]
        stream = await cam.init_livestream()
        await stream.start()
        print(f"Live view of '{name}' at {stream.url}  (close the video window or Ctrl+C to stop)")
        feed = asyncio.create_task(stream.feed())
        player = subprocess.Popen([
            "ffplay", "-hide_banner", "-loglevel", "error",
            "-fflags", "nobuffer+discardcorrupt", "-flags", "low_delay", "-probesize", "32", "-analyzeduration", "0",
            "-an", "-sync", "ext", "-framedrop", "-vf", "setpts=0",   # show each frame the moment it arrives
            "-window_title", f"Blink {name}", stream.url])
        while player.poll() is None and not feed.done():
            await asyncio.sleep(0.5)
        stream.stop()
        if player.poll() is None:
            player.terminate()
        feed.cancel()


asyncio.run(main())
