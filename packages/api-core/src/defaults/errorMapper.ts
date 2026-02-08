import { ErrorMapper, TIMEOUT_BAG_KEY, TransportResult } from "../types";
import { Request } from "../request";
import { Context } from "../context";
import { CanceledError, NetworkError, TimeoutError, UniReqError } from "../errors";

function isAbortError(err: any): boolean {
  return err?.name === "AbortError";
}

export class DefaultErrorMapper implements ErrorMapper {
  map(err: unknown, _req: Request, ctx: Context, _transport?: TransportResult): Error {
    if (err instanceof UniReqError) return err;

    if (ctx.bag.get(TIMEOUT_BAG_KEY) === true) {
      return new TimeoutError("Request timed out", err);
    }

    if (isAbortError(err)) {
      return new CanceledError("Request canceled", err);
    }

    return new NetworkError("Network error", err);
  }
}
