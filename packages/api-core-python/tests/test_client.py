from __future__ import annotations

import pytest
import respx

from aptx_api_core._client import (
    ApiClient,
    RequestClient,
    create_api_client,
    get_api_client,
    set_api_client,
)
from aptx_api_core._pipeline import Pipeline
from aptx_api_core.errors import HttpError, UniReqError
from aptx_api_core.types import PerCallOptions, RequestSpec


def _reset_global():
    import aptx_api_core._client as mod

    mod._global_client = None


@pytest.fixture(autouse=True)
def reset_global():
    _reset_global()
    yield
    _reset_global()


@respx.mock
@pytest.mark.asyncio
async def test_execute_async_normal_request():
    respx.get("http://example.com/api/users").respond(
        json={"id": 1, "name": "Alice"}
    )

    client = RequestClient(base_url="http://example.com")
    spec = RequestSpec(method="GET", path="/api/users")
    result = await client.execute_async(spec)

    assert result == {"id": 1, "name": "Alice"}


@respx.mock
@pytest.mark.asyncio
async def test_execute_async_with_response_type():
    respx.get("http://example.com/api/users/1").respond(
        json={"id": 1, "name": "Alice"}
    )

    class User:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

    client = RequestClient(base_url="http://example.com")
    spec = RequestSpec(method="GET", path="/api/users/1")
    result = await client.execute_async(spec, response_type=User)

    assert isinstance(result, User)
    assert result.id == 1
    assert result.name == "Alice"


def test_set_and_get_api_client():
    client = create_api_client(base_url="http://example.com")
    set_api_client(client)
    assert get_api_client() is client


def test_get_api_client_uninitialized_raises():
    with pytest.raises(RuntimeError, match="ApiClient not initialized"):
        get_api_client()


@respx.mock
@pytest.mark.asyncio
async def test_middleware_integration():
    respx.get("http://example.com/api/data").respond(json={"ok": True})

    call_log: list[str] = []

    class _LogMiddleware:
        async def handle(self, req, ctx, next):
            call_log.append("before")
            res = await next(req, ctx)
            call_log.append("after")
            return res

    client = RequestClient(
        base_url="http://example.com", middlewares=[_LogMiddleware()]
    )
    spec = RequestSpec(method="GET", path="/api/data")
    await client.execute_async(spec)

    assert call_log == ["before", "after"]


@respx.mock
@pytest.mark.asyncio
async def test_http_error_on_status_error():
    respx.get("http://example.com/api/missing").respond(status_code=404, json={"error": "not found"})

    client = RequestClient(base_url="http://example.com")
    spec = RequestSpec(method="GET", path="/api/missing")

    with pytest.raises(HttpError) as exc_info:
        await client.execute_async(spec)

    assert exc_info.value.status == 404
