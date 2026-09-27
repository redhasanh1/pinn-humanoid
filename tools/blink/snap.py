"""Take a fresh snapshot on every Blink camera and save it as ~/blink/<name>.jpg (uses the saved login)."""
import asyncio
import os
from aiohttp import ClientSession
from blinkpy.blinkpy import Blink
from blinkpy.auth import Auth
from blinkpy.helpers.util import json_load

CREDS = os.path.expanduser("~/blink/creds.json")


async def main():
    async with ClientSession() as session:
        blink = Blink(session=session)
        blink.auth = Auth(await json_load(CREDS), no_prompt=True, session=session)
        await blink.start()
        for name, cam in blink.cameras.items():
            await cam.snap_picture()
            await asyncio.sleep(8)       # give the camera time to upload the new still
            await blink.refresh(force=True)
            path = os.path.expanduser(f"~/blink/{name.replace(' ', '_')}.jpg")
            await cam.image_to_file(path)
            print("saved", path)
        await blink.save(CREDS)


asyncio.run(main())
