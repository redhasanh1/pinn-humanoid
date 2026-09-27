"""Fix for blinkpy 0.25.5's live stream dying after a few seconds.

BlinkLiveStream.recv() does reader.read(n), which returns *up to* n bytes. Whenever TCP splits a packet (every few
seconds on a real network) it gets e.g. 114 of 1316 bytes, logs "Insufficient data for payload" and kills the whole
session. Same protocol, but readexactly(): wait until the full header / payload has arrived.

    from stream_fix import patch; patch()     # before init_livestream()
"""
import asyncio
import logging
import ssl

from blinkpy.livestream import BlinkLiveStream

_LOGGER = logging.getLogger(__name__)


async def _recv(self):
    try:
        while not self.target_reader.at_eof():
            header = await self.target_reader.readexactly(9)
            msgtype = header[0]
            length = int.from_bytes(header[5:9], byteorder="big")
            if length <= 0:
                continue
            data = await self.target_reader.readexactly(length)
            if msgtype != 0x00 or data[0] != 0x47:          # only MPEG-TS video packets go to the clients
                continue
            for writer in self.clients:
                if not writer.is_closing():
                    writer.write(data)
                    await writer.drain()
    except asyncio.IncompleteReadError:
        _LOGGER.info("Blink closed the live stream")
    except ssl.SSLError as e:
        if e.reason != "APPLICATION_DATA_AFTER_CLOSE_NOTIFY":
            _LOGGER.exception("SSL error while receiving data")
    except Exception:
        _LOGGER.exception("Error while receiving data")
    finally:
        self.target_writer.close()


def patch():
    BlinkLiveStream.recv = _recv
