from __future__ import annotations

from typing import Awaitable, Callable

from ._context import Context
from ._request import Request
from ._response import Response


class AuthMiddleware:
    def __init__(
        self,
        get_token: Callable[[], Awaitable[str | None]],
        *,
        header_name: str = "Authorization",
        token_prefix: str = "Bearer ",
    ) -> None:
        self._get_token = get_token
        self._header_name = header_name
        self._token_prefix = token_prefix

    async def handle(self, req: Request, ctx: Context, next):
        token = await self._get_token()
        if token:
            req = req.with_headers(
                {self._header_name: f"{self._token_prefix}{token}"}
            )
        return await next(req, ctx)
