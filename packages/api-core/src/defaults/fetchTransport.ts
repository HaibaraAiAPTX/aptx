import { ProgressInfo, Transport, TransportResult } from "../types";
import { Request } from "../request";
import { Context } from "../context";
import { BodySerializer } from "../types";

function sizeOfBody(body: any): number | undefined {
  if (typeof body === "string") return new TextEncoder().encode(body).length;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (body instanceof Uint8Array) return body.byteLength;
  if (body instanceof Blob) return body.size;
  return undefined;
}

async function readWithProgress(
  res: Response,
  onProgress: (info: ProgressInfo) => void
): Promise<Response> {
  const reader = res.body?.getReader();
  if (!reader) return res;

  const chunks: ArrayBuffer[] = [];
  let loaded = 0;
  const totalHeader = res.headers.get("content-length");
  const total = totalHeader ? Number(totalHeader) : undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
      loaded += value.byteLength;
      onProgress({
        loaded,
        total,
        progress: total ? loaded / total : undefined,
        type: "download",
      });
    }
  }

  const body = new Blob(chunks);
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

export class FetchTransport implements Transport {
  constructor(private readonly serializer: BodySerializer) {}

  async send(req: Request, ctx: Context): Promise<TransportResult> {
    const { body, headers: extraHeaders } = this.serializer.serialize(req, ctx);

    const headers = new Headers(extraHeaders as any);
    req.headers.forEach((v, k) => headers.set(k, v));

    const onUploadProgress = req.meta.onUploadProgress;
    if (onUploadProgress) {
      const total = sizeOfBody(body);
      if (total !== undefined) {
        onUploadProgress({ loaded: total, total, progress: 1, type: "upload" });
      }
    }

    const res = await fetch(req.url, {
      method: req.method,
      headers,
      body: body as any,
      signal: ctx.signal,
    });

    const onDownloadProgress = req.meta.onDownloadProgress;
    const finalRes = onDownloadProgress ? await readWithProgress(res, onDownloadProgress) : res;

    return {
      status: finalRes.status,
      headers: finalRes.headers,
      url: finalRes.url,
      raw: finalRes,
    };
  }
}
