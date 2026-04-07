from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlencode

from .types import RequestSpec

_PATH_PARAM_RE = re.compile(r"\{(\w+)\}")


class DefaultUrlResolver:
    def resolve(self, spec: RequestSpec) -> str:
        path = spec.path

        if spec.input is not None and "{" in path:
            def replacer(match: re.Match[str]) -> str:
                param_name = match.group(1)
                value = getattr(spec.input, param_name, None)
                if value is None:
                    raise ValueError(
                        f"Path parameter '{param_name}' not found in input"
                    )
                return str(value)

            path = _PATH_PARAM_RE.sub(replacer, path)

        if spec.query:
            params = {k: v for k, v in spec.query.items() if v is not None}
            if params:
                path = f"{path}?{urlencode(params)}"

        return path
