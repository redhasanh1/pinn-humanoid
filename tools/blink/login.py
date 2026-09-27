"""Log into Blink once (you type email, password and the 2FA code yourself) and save the token to ~/blink/creds.json."""
import asyncio
import os
import re
from aiohttp import ClientSession
from blinkpy import api
from blinkpy.blinkpy import Blink
from blinkpy.auth import Auth, BlinkTwoFARequiredError
from blinkpy.helpers.util import json_load

CREDS = os.path.expanduser("~/blink/creds.json")

_signin = api.oauth_signin


async def signin_verbose(auth, email, password, csrf_token):
    """Same request as blinkpy's, but say what Blink answered (status + visible message; never the password)."""
    response = await auth.session.post(
        api.OAUTH_SIGNIN_URL,
        headers={"User-Agent": api.OAUTH_USER_AGENT, "Accept": "*/*",
                 "Content-Type": "application/x-www-form-urlencoded",
                 "Origin": "https://api.oauth.blink.com", "Referer": api.OAUTH_SIGNIN_URL},
        data={"username": email, "password": password, "csrf-token": csrf_token},
        allow_redirects=False)
    print("Blink sign-in answered HTTP", response.status)
    if response.status in (202, 412):   # 202 = new SMS "two-step verification" answer; blinkpy 0.25.5 only knows 412
        return "2FA_REQUIRED"
    if response.status in (301, 302, 303, 307, 308):
        return "SUCCESS"
    text = re.sub(r"<[^>]+>", " ", await response.text())
    print("Blink says:", " ".join(text.split())[:300])
    return None


api.oauth_signin = signin_verbose


async def verify_verbose(auth, csrf_token, twofa_code):
    """blinkpys 2FA verify, but print Blinks answer so a failure is visible."""
    response = await auth.session.post(
        api.OAUTH_2FA_VERIFY_URL,
        headers={"User-Agent": api.OAUTH_USER_AGENT, "Accept": "*/*",
                 "Content-Type": "application/x-www-form-urlencoded",
                 "Origin": "https://api.oauth.blink.com", "Referer": api.OAUTH_SIGNIN_URL},
        data={"2fa_code": twofa_code, "csrf-token": csrf_token, "remember_me": "false"})
    body = await response.text()
    print("Blink code check answered HTTP", response.status, body[:200])
    return response.status in (200, 201) and "auth-completed" in body


api.oauth_verify_2fa = verify_verbose


async def main():
    async with ClientSession() as session:
        blink = Blink(session=session)
        if os.path.exists(CREDS):
            blink.auth = Auth(await json_load(CREDS), session=session)
        try:
            ok = await blink.start()
        except BlinkTwoFARequiredError:
            code = input("Enter the code Blink just sent you: ").strip()
            await blink.send_2fa_code(code)
            ok = await blink.setup_post_verify()
        if not ok or not blink.cameras:
            print("Login did NOT work (see the message above). Nothing saved.")
            return
        await blink.save(CREDS)
        os.chmod(CREDS, 0o600)
        print("Logged in. Cameras:", list(blink.cameras))


asyncio.run(main())
