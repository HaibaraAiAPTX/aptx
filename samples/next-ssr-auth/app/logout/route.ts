import { NextRequest, NextResponse } from "next/server";
import { createServerApiContext } from "../../lib/aptx";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { store } = await createServerApiContext({ writableCookies: true });
  await store.clearToken();
  return NextResponse.redirect(new URL("/", req.url));
}
