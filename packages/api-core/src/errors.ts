export abstract class UniReqError extends Error {
  override readonly name: string = "UniReqError";
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NetworkError extends UniReqError {
  override readonly name = "NetworkError";
}

export class TimeoutError extends UniReqError {
  override readonly name = "TimeoutError";
  constructor(message = "Request timed out", cause?: unknown) {
    super(message, cause);
  }
}

export class CanceledError extends UniReqError {
  override readonly name = "CanceledError";
  constructor(message = "Request canceled", cause?: unknown) {
    super(message, cause);
  }
}

export class HttpError extends UniReqError {
  override readonly name = "HttpError";
  private readonly _headers?: Headers;
  constructor(
    message: string,
    public readonly status: number,
    public readonly url: string,
    public readonly bodyPreview?: unknown,
    headers?: Headers,
    cause?: unknown
  ) {
    super(message, cause);
    this._headers = headers;
  }

  get headers(): Headers | undefined {
    return this._headers ? new Headers(this._headers) : undefined;
  }
}

export class ConfigError extends UniReqError {
  override readonly name = "ConfigError";
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export class SerializeError extends UniReqError {
  override readonly name = "SerializeError";
  constructor(message: string, cause?: unknown) {
    super(message, cause);
  }
}

export class DecodeError extends UniReqError {
  override readonly name = "DecodeError";
  constructor(
    message: string,
    public readonly responseType: string,
    public readonly status: number,
    public readonly url: string,
    cause?: unknown
  ) {
    super(message, cause);
  }
}
