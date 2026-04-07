from __future__ import annotations

import pytest

from aptx_api_core._pipeline import Pipeline
from aptx_api_core._context import Context
from aptx_api_core._request import Request
from aptx_api_core._response import Response


def _make_req(url: str = "/") -> Request:
    return Request(method="GET", url=url)


def _make_response(status: int = 200, data=None) -> Response:
    return Response(status=status, data=data)


@pytest.fixture
def ctx():
    return Context()


class _OrderMiddleware:
    def __init__(self, name: str, order: list[str]):
        self._name = name
        self._order = order

    async def handle(self, req, ctx, next):
        self._order.append(f"before-{self._name}")
        res = await next(req, ctx)
        self._order.append(f"after-{self._name}")
        return res


class _ShortcircuitMiddleware:
    async def handle(self, req, ctx, next):
        return _make_response(status=403, data="blocked")


class _ModifyMiddleware:
    async def handle(self, req, ctx, next):
        modified = req.with_headers({"X-Custom": "value"})
        return await next(modified, ctx)


@pytest.mark.asyncio
async def test_middleware_execution_order(ctx):
    order: list[str] = []
    pipeline = Pipeline()
    pipeline.use(_OrderMiddleware("A", order))
    pipeline.use(_OrderMiddleware("B", order))

    async def final(req, ctx):
        return _make_response()

    handler = pipeline.compose(final)
    await handler(_make_req(), ctx)

    assert order == ["before-A", "before-B", "after-B", "after-A"]


@pytest.mark.asyncio
async def test_middleware_shortcircuit(ctx):
    pipeline = Pipeline()
    pipeline.use(_ShortcircuitMiddleware())

    async def final(req, ctx):
        return _make_response(status=200)

    handler = pipeline.compose(final)
    res = await handler(_make_req(), ctx)

    assert res.status == 403
    assert res.data == "blocked"


@pytest.mark.asyncio
async def test_no_middleware_goes_to_final(ctx):
    pipeline = Pipeline()

    async def final(req, ctx):
        return _make_response(status=200, data="ok")

    handler = pipeline.compose(final)
    res = await handler(_make_req(), ctx)

    assert res.status == 200
    assert res.data == "ok"


@pytest.mark.asyncio
async def test_middleware_can_modify_request(ctx):
    captured: list[Request] = []

    class _CaptureMiddleware:
        async def handle(self, req, ctx, next):
            captured.append(req)
            return await next(req, ctx)

    pipeline = Pipeline()
    pipeline.use(_ModifyMiddleware())
    pipeline.use(_CaptureMiddleware())

    async def final(req, ctx):
        return _make_response()

    handler = pipeline.compose(final)
    await handler(_make_req(), ctx)

    assert captured[0].headers.get("X-Custom") == "value"
