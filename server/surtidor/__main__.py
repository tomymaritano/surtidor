"""Run the API and keep the official price file fresh."""

from __future__ import annotations

import logging
import os
import threading
import time

from surtidor.http_app import serve
from surtidor.service import sync_once

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("surtidor")


def _sync_loop() -> None:
    while True:
        time.sleep(60 * 60)
        try:
            sync_once()
        except Exception:
            log.exception("sync failed")


def main() -> None:
    try:
        sync_once()
    except Exception:
        log.exception("initial sync failed")
    threading.Thread(target=_sync_loop, name="sync", daemon=True).start()
    host = os.environ.get("SURTIDOR_HOST", "0.0.0.0")
    # 8787 is Wrangler's default. Binding there makes 127.0.0.1 hit the other process.
    port = int(os.environ.get("SURTIDOR_PORT", "8791"))
    serve(host, port)


if __name__ == "__main__":
    main()
