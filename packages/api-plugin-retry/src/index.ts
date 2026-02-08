import { Middleware, Request, Context, Response } from "@aptx/api-core";

export interface RetryOptions {
  retries: number;
  delayMs?: number | ((attempt: number, error: Error, req: Request, ctx: Context) => number);
  retryOn?: (error: Error, req: Request, ctx: Context) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createRetryMiddleware(options: RetryOptions): Middleware {
  const retries = Math.max(0, options.retries);

  return {
    async handle(req: Request, ctx: Context, next: (req: Request, ctx: Context) => Promise<Response>) {
      for (let attempt = 0; ; attempt++) {
        ctx.attempt = attempt;
        try {
          return await next(req, ctx);
        } catch (err) {
          const error = err as Error;
          if (attempt >= retries) throw error;
          if (options.retryOn && !options.retryOn(error, req, ctx)) throw error;

          const delay =
            typeof options.delayMs === "function"
              ? options.delayMs(attempt + 1, error, req, ctx)
              : options.delayMs;
          if (delay && delay > 0) await sleep(delay);
        }
      }
    },
  };
}
