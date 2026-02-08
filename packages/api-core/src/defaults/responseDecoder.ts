import { ResponseDecoder, TransportResult, ResponseType } from "../types";
import { Request } from "../request";
import { Context } from "../context";
import { Response } from "../response";
import { DecodeError, HttpError } from "../errors";

function pickResponseType(
  req: Request,
  transport: TransportResult,
  defaultResponseType?: ResponseType,
  strictDecode?: boolean
): ResponseType {
  const rt = req.meta.responseType;
  if (rt) return rt;

  // auto by content-type
  const ct = transport.headers.get("content-type")?.toLowerCase() ?? "";
  if (ct.includes("application/json")) return "json";
  if (ct.includes("text/")) return "text";
  if (defaultResponseType) return defaultResponseType;
  if (strictDecode) throw new Error("Unable to determine response type");
  return "raw";
}

export class DefaultResponseDecoder implements ResponseDecoder {
  constructor(
    private readonly options: {
      defaultResponseType?: ResponseType;
      strictDecode?: boolean;
    } = {}
  ) {}

  async decode<T = unknown>(
    req: Request,
    transport: TransportResult,
    _ctx: Context
  ): Promise<Response<T>> {
    const raw = transport.raw as globalThis.Response;

    if (transport.status < 200 || transport.status >= 300) {
      let preview: unknown = undefined;
      try {
        const ct = transport.headers.get("content-type")?.toLowerCase() ?? "";
        if (ct.includes("application/json")) preview = await raw.clone().json();
        else preview = await raw.clone().text();
      } catch {
        // ignore preview failures
      }
      throw new HttpError(
        `HTTP ${transport.status}`,
        transport.status,
        transport.url,
        preview,
        transport.headers
      );
    }

    const rt = pickResponseType(
      req,
      transport,
      this.options.defaultResponseType,
      this.options.strictDecode
    );
    if (rt === "raw") {
      return new Response<T>({
        status: transport.status,
        headers: transport.headers,
        url: transport.url,
        data: undefined,
        raw: transport.raw,
      });
    }

    let data: any;
    try {
      if (rt === "json") data = await raw.clone().json();
      else if (rt === "text") data = await raw.clone().text();
      else if (rt === "blob") data = await raw.clone().blob();
      else if (rt === "arrayBuffer") data = await raw.clone().arrayBuffer();
    } catch (err) {
      throw new DecodeError("Failed to decode response body", rt, transport.status, transport.url, err);
    }

    return new Response<T>({
      status: transport.status,
      headers: transport.headers,
      url: transport.url,
      data,
      raw: transport.raw,
    });
  }
}
