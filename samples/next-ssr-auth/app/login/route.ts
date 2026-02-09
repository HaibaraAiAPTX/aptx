import { NextRequest, NextResponse } from "next/server";
import { createServerApiContext, type LoginResponse } from "../../lib/aptx";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const username = String(form.get("username") ?? "");
  const password = String(form.get("password") ?? "");

  if (!username || !password) {
    return NextResponse.redirect(new URL("/?error=invalid_credentials", req.url));
  }

  try {
    const { api, store } = await createServerApiContext({ writableCookies: true });
    const data = await api.execute<LoginResponse>({
      method: "POST",
      path: "/auth/login",
      body: { username, password }
    });
    await store.setToken(data.token, { expiresAt: data.expiresAt });
    return NextResponse.redirect(new URL("/", req.url));
  } catch {
    return NextResponse.redirect(new URL("/?error=invalid_credentials", req.url));
  }
}
