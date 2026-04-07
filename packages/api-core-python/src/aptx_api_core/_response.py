from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Response:
    status: int
    headers: dict[str, str] = field(default_factory=dict)
    url: str = ""
    data: Any = None
    raw: Any = None
    meta: dict[str, Any] = field(default_factory=dict)
