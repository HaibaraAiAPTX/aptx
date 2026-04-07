from __future__ import annotations

from typing import Any

import httpx

from ._context import Context
from ._decoder import DefaultResponseDecoder
from ._error_mapper import DefaultErrorMapper
from ._pipeline import Pipeline
from ._request import Request
from ._response import Response
from ._transport import HttpxTransport
from ._url_resolver import DefaultUrlResolver
from .errors import UniReqError
from .types import PerCallOptions, RequestSpec


class RequestClient:
    def __init__(
        self,
        *,
        base_url: str = "",
        headers: dict[str, str] | None = None,
        timeout: float | None = None,
        middlewares: list[Any] | None = None,
    ) -> None:
        self._http = httpx.AsyncClient(
            base_url=base_url, headers=headers, timeout=timeout
        )
        self._pipeline = Pipeline()
        self._transport = HttpxTransport(self._http)
        self._decoder = DefaultResponseDecoder()
        self._error_mapper = DefaultErrorMapper()
        self._url_resolver = DefaultUrlResolver()
        for mw in middlewares or []:
            self._pipeline.use(mw)

    @property
    def pipeline(self) -> Pipeline:
        return self._pipeline

    async def execute_async(
        self,
        spec: RequestSpec,
        response_type: type | None = None,
        options: PerCallOptions | None = None,
    ) -> Any:
        options = options or PerCallOptions()
        req = self._build_request(spec, options)
        ctx = Context()

        async def final_handler(r: Request, c: Context) -> Response:
            transport_res = await self._transport.send(r, c)
            return self._decoder.decode(r, transport_res, c)

        handler = self._pipeline.compose(final_handler)

        try:
            res = await handler(req, ctx)
            if response_type is not None and isinstance(res.data, dict):
                return response_type(**res.data)
            return res.data
        except UniReqError:
            raise
        except Exception as e:
            raise self._error_mapper.map(e, req, ctx) from e

    def _build_request(
        self, spec: RequestSpec, options: PerCallOptions
    ) -> Request:
        url = self._url_resolver.resolve(spec)

        merged_headers: dict[str, str] = {}
        if spec.headers:
            merged_headers.update(spec.headers)
        if options.headers:
            merged_headers.update(options.headers)

        merged_query = {**(spec.query or {}), **(options.query or {})} or None

        return Request(
            method=spec.method,
            url=url,
            headers=merged_headers,
            query=merged_query,
            body=spec.body,
            timeout=options.timeout,
            meta=spec.meta or {},
        )


class ApiClient:
    def __init__(self, client: RequestClient) -> None:
        self._client = client

    async def execute_async(
        self,
        spec: RequestSpec,
        response_type: type | None = None,
        options: PerCallOptions | None = None,
    ) -> Any:
        return await self._client.execute_async(spec, response_type, options)


_global_client: ApiClient | None = None


def set_api_client(client: ApiClient) -> None:
    global _global_client
    _global_client = client


def get_api_client() -> ApiClient:
    if _global_client is None:
        raise RuntimeError("ApiClient not initialized. Call set_api_client() first.")
    return _global_client


def create_api_client(
    base_url: str = "",
    *,
    middlewares: list[Any] | None = None,
    timeout: float | None = None,
) -> ApiClient:
    client = RequestClient(
        base_url=base_url, timeout=timeout, middlewares=middlewares
    )
    return ApiClient(client)
