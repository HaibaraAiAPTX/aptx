from __future__ import annotations

import pytest

from aptx_api_core._url_resolver import DefaultUrlResolver
from aptx_api_core.types import RequestSpec


class _FakeInput:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


@pytest.fixture
def resolver():
    return DefaultUrlResolver()


def test_no_params_path_returned_as_is(resolver):
    spec = RequestSpec(method="GET", path="/health")
    assert resolver.resolve(spec) == "/health"


def test_extract_path_param_from_input(resolver):
    inp = _FakeInput(id=123)
    spec = RequestSpec(method="GET", path="/users/{id}", input=inp)
    assert resolver.resolve(spec) == "/users/123"


def test_missing_path_param_raises(resolver):
    inp = _FakeInput(name="foo")
    spec = RequestSpec(method="GET", path="/users/{id}", input=inp)
    with pytest.raises(ValueError, match="Path parameter 'id' not found"):
        resolver.resolve(spec)


def test_query_serialization(resolver):
    spec = RequestSpec(method="GET", path="/search", query={"q": "hello", "page": 1})
    result = resolver.resolve(spec)
    assert "/search?" in result
    assert "q=hello" in result
    assert "page=1" in result


def test_query_filters_none(resolver):
    spec = RequestSpec(method="GET", path="/search", query={"q": "test", "opt": None})
    result = resolver.resolve(spec)
    assert "opt=" not in result
    assert "q=test" in result


def test_path_and_query_combined(resolver):
    inp = _FakeInput(id=42)
    spec = RequestSpec(
        method="GET",
        path="/users/{id}/posts",
        input=inp,
        query={"limit": 10},
    )
    result = resolver.resolve(spec)
    assert result.startswith("/users/42/posts?")
    assert "limit=10" in result


def test_none_input_skips_path_replacement(resolver):
    spec = RequestSpec(method="GET", path="/users/{id}", input=None)
    assert resolver.resolve(spec) == "/users/{id}"
