from __future__ import annotations

from typing import Any, Literal

HttpMethod = Literal["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]


class RequestSpec:
    """Return value of generated spec builders."""

    __slots__ = ("method", "path", "query", "headers", "body", "input", "meta")

    def __init__(
        self,
        method: HttpMethod,
        path: str,
        *,
        query: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        body: Any = None,
        input: Any = None,
        meta: dict[str, Any] | None = None,
    ) -> None:
        self.method = method
        self.path = path
        self.query = query
        self.headers = headers
        self.body = body
        self.input = input
        self.meta = meta or {}


class PerCallOptions:
    """Per-call override options."""

    __slots__ = ("headers", "query", "timeout", "meta")

    def __init__(
        self,
        *,
        headers: dict[str, str] | None = None,
        query: dict[str, Any] | None = None,
        timeout: float | None = None,
        meta: dict[str, Any] | None = None,
    ) -> None:
        self.headers = headers
        self.query = query
        self.timeout = timeout
        self.meta = meta
