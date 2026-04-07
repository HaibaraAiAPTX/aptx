from __future__ import annotations

import pytest

from aptx_api_core.errors import (
    DecodeError,
    HttpError,
    NetworkError,
    TimeoutError,
    UniReqError,
)


def test_unireq_error_is_base_of_all():
    assert issubclass(NetworkError, UniReqError)
    assert issubclass(TimeoutError, UniReqError)
    assert issubclass(HttpError, UniReqError)
    assert issubclass(DecodeError, UniReqError)


def test_http_error_attributes():
    err = HttpError("Bad Request", status=400, url="/users", body_preview='{"msg":"fail"}')
    assert err.status == 400
    assert err.url == "/users"
    assert err.body_preview == '{"msg":"fail"}'
    assert str(err) == "Bad Request"


def test_http_error_default_body_preview():
    err = HttpError("Server Error", status=500, url="/")
    assert err.body_preview is None


def test_decode_error_attributes():
    err = DecodeError("Failed", response_type="json", status=200, url="/api")
    assert err.response_type == "json"
    assert err.status == 200
    assert err.url == "/api"


def test_all_errors_can_raise_and_catch():
    for cls in (NetworkError, TimeoutError, HttpError, DecodeError):
        with pytest.raises(UniReqError):
            if cls in (HttpError,):
                raise cls("msg", 500, "/")
            elif cls in (DecodeError,):
                raise cls("msg", "json", 500, "/")
            else:
                raise cls("msg")
