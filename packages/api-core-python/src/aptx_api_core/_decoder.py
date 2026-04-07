from __future__ import annotations

from typing import Any

from ._context import Context
from ._request import Request
from ._response import Response
from .errors import DecodeError, HttpError


class DefaultResponseDecoder:
    def decode(self, req: Request, transport: Response, ctx: Context) -> Response:
        if transport.status < 200 or transport.status >= 300:
            body_preview: Any = None
            try:
                raw = transport.raw
                if raw is not None:
                    body_preview = raw.text[:500]
            except Exception:
                pass
            raise HttpError(
                f"HTTP {transport.status}",
                status=transport.status,
                url=transport.url,
                body_preview=body_preview,
            )

        raw = transport.raw
        data: Any = None
        if raw is not None:
            ct = raw.headers.get("content-type", "")
            if "application/json" in ct:
                try:
                    data = raw.json()
                except Exception as e:
                    raise DecodeError(
                        "Failed to decode JSON response",
                        response_type="json",
                        status=transport.status,
                        url=transport.url,
                    ) from e
            else:
                data = raw.text

        return Response(
            status=transport.status,
            headers=dict(raw.headers) if raw is not None else {},
            url=transport.url,
            data=data,
            raw=raw,
        )
