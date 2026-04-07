from __future__ import annotations

import httpx

from ._context import Context
from ._request import Request
from .errors import HttpError, NetworkError, TimeoutError, UniReqError


class DefaultErrorMapper:
    def map(self, err: Exception, req: Request, ctx: Context) -> UniReqError:
        if isinstance(err, UniReqError):
            return err
        if isinstance(err, httpx.TimeoutException):
            return TimeoutError(str(err) or "Request timed out")
        if isinstance(err, httpx.ConnectError):
            return NetworkError(str(err) or "Connection failed")
        if isinstance(err, httpx.HTTPStatusError):
            return HttpError(
                f"HTTP {err.response.status_code}",
                status=err.response.status_code,
                url=str(err.request.url),
            )
        return UniReqError(str(err))
