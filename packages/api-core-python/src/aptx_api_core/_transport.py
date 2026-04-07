from __future__ import annotations

from typing import Any

import httpx

from ._context import Context
from ._request import Request
from ._response import Response


class HttpxTransport:
    def __init__(self, client: httpx.AsyncClient | None = None) -> None:
        self._client = client or httpx.AsyncClient()

    async def send(self, req: Request, ctx: Context) -> Response:
        response = await self._client.request(
            method=req.method,
            url=req.url,
            headers=req.headers,
            params=req.query,
            content=req.body if isinstance(req.body, (bytes, str)) else None,
            json=req.body if not isinstance(req.body, (bytes, str)) else None,
        )
        return Response(
            status=response.status_code,
            headers=dict(response.headers),
            url=str(response.url),
            raw=response,
        )
