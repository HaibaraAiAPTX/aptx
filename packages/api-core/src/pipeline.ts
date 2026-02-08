import { Middleware, Next } from "./types";
import { Request } from "./request";
import { Context } from "./context";
import { Response } from "./response";

export class Pipeline {
  private middlewares: Middleware[] = [];

  use(mw: Middleware): void {
    this.middlewares.push(mw);
  }

  compose(finalHandler: Next): Next {
    const mws = [...this.middlewares];
    return async (req: Request, ctx: Context): Promise<Response> => {
      let idx = -1;
      const dispatch = async (i: number, r: Request, c: Context): Promise<Response> => {
        if (i <= idx) throw new Error("next() called multiple times");
        idx = i;
        const mw = mws[i];
        if (!mw) return finalHandler(r, c);
        return mw.handle(r, c, (nr, nc) => dispatch(i + 1, nr, nc));
      };
      return dispatch(0, req, ctx);
    };
  }
}
