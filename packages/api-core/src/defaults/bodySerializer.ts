import { BodySerializer, HeadersInitLike } from "../types";
import { Request } from "../request";
import { Context } from "../context";
import { SerializeError } from "../errors";

export class DefaultBodySerializer implements BodySerializer {
  serialize(req: Request, _ctx: Context): { body: any; headers?: HeadersInitLike } {
    const body = req.body;

    if (body === undefined || body === null) return { body: undefined };

    if (
      typeof body === "string" ||
      body instanceof Blob ||
      body instanceof ArrayBuffer ||
      body instanceof FormData ||
      body instanceof URLSearchParams
    ) {
      return { body };
    }

    const hasContentType = req.headers.get("content-type") !== null;
    if (hasContentType) {
      try {
        return { body: JSON.stringify(body) };
      } catch (err) {
        throw new SerializeError("Failed to serialize request body", err);
      }
    }

    try {
      return {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      };
    } catch (err) {
      throw new SerializeError("Failed to serialize request body", err);
    }
  }
}
