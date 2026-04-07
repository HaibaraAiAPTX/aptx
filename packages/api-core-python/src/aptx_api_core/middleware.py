from __future__ import annotations

from typing import Awaitable, Callable, Protocol

from ._context import Context
from ._request import Request
from ._response import Response


class Middleware(Protocol):
    async def handle(
        self,
        req: Request,
        ctx: Context,
        next: Callable[[Request, Context], Awaitable[Response]],
    ) -> Response: ...
