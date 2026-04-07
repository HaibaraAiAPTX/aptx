from __future__ import annotations

from typing import Any


class UniReqError(Exception):
    """Base class for all api-core errors."""


class NetworkError(UniReqError):
    """Network-level error (DNS, connection refused, etc.)."""


class TimeoutError(UniReqError):
    """Request timed out."""


class HttpError(UniReqError):
    """Server returned 4xx / 5xx."""

    def __init__(
        self, message: str, status: int, url: str, body_preview: Any = None
    ) -> None:
        super().__init__(message)
        self.status = status
        self.url = url
        self.body_preview = body_preview


class DecodeError(UniReqError):
    """Response body decode failure."""

    def __init__(
        self, message: str, response_type: str, status: int, url: str
    ) -> None:
        super().__init__(message)
        self.response_type = response_type
        self.status = status
        self.url = url
