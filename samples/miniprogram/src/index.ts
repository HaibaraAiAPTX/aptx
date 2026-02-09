import {
  DefaultBodySerializer,
  Request,
  RequestClient,
  Transport,
  TransportResult
} from "@aptx/api-core";
import { createAptxCoreApiClient } from "@aptx/api-client";

class WxTransport implements Transport {
  async send(req: Request): Promise<TransportResult> {
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return await new Promise<TransportResult>((resolve, reject) => {
      wx.request({
        url: req.url,
        method: req.method,
        data: req.body,
        header: headers,
        timeout: req.timeout,
        success: (result) => {
          resolve({
            status: result.statusCode,
            headers: new Headers(result.header),
            url: req.url,
            raw: result.data
          });
        },
        fail: (error) => {
          reject(error);
        }
      });
    });
  }
}

export function createMiniProgramApiClient(baseURL: string) {
  const core = new RequestClient({
    baseURL,
    timeout: 5000,
    bodySerializer: new DefaultBodySerializer(),
    transport: new WxTransport()
  });

  return createAptxCoreApiClient(core);
}

// 使用示例：
// const api = createMiniProgramApiClient("https://your-api.example.com");
// const users = await api.execute<{ items: Array<{ id: number; name: string }> }>({
//   method: "GET",
//   path: "/users"
// });
