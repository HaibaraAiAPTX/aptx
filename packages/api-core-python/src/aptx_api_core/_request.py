from __future__ import annotations

from dataclasses import dataclass, field, replace
from typing import Any

from .types import HttpMethod


@dataclass(frozen=True)
class Request:
    method: HttpMethod
    url: str
    headers: dict[str, str] = field(default_factory=dict)
    query: dict[str, Any] | None = None
    body: Any = None
    timeout: float | None = None
    meta: dict[str, Any] = field(default_factory=dict)

    def with_headers(self, patch: dict[str, str]) -> Request:
        merged = {**self.headers, **patch}
        return replace(self, headers=merged)
