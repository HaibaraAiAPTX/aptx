from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
import time
import uuid


@dataclass
class Context:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:16])
    attempt: int = 0
    start_time: float = field(default_factory=lambda: time.monotonic())
    bag: dict[str, Any] = field(default_factory=dict)
