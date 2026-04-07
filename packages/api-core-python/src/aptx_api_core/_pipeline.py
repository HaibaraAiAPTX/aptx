from __future__ import annotations

from typing import Awaitable, Callable

from ._context import Context
from ._request import Request
from ._response import Response


class Pipeline:
    def __init__(self) -> None:
        self._middlewares: list = []

    def use(self, mw) -> None:
        self._middlewares.append(mw)

    def compose(
        self, final: Callable[[Request, Context], Awaitable[Response]]
    ) -> Callable[[Request, Context], Awaitable[Response]]:
        mws = list(self._middlewares)

        async def dispatch(i: int, req: Request, ctx: Context) -> Response:
            if i < len(mws):
                async def nxt(r: Request, c: Context) -> Response:
                    return await dispatch(i + 1, r, c)

                return await mws[i].handle(req, ctx, nxt)
            return await final(req, ctx)

        return lambda req, ctx: dispatch(0, req, ctx)
