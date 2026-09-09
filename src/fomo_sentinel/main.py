from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse

from .config import get_settings
from .dashboard import DASHBOARD_HTML
from .service import ScannerService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
service = ScannerService(get_settings())


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(service.run_forever())
    try:
        yield
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        await service.stop()


app = FastAPI(title="Fomo Sentinel", version="0.1.0", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, object]:
    status = service.status()
    return {"ok": status["ok"], "running": status["running"], "last_scan_at": status["last_scan_at"]}


@app.get("/status")
async def status() -> dict[str, object]:
    return service.status()


@app.get("/recent")
async def recent(limit: int = 100) -> list[dict[str, object]]:
    return await service.storage.recent_evaluations(limit)


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard() -> str:
    return DASHBOARD_HTML


def run() -> None:
    uvicorn.run("fomo_sentinel.main:app", host="0.0.0.0", port=8080)


if __name__ == "__main__":
    run()
