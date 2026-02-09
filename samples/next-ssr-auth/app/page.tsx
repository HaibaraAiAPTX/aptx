import { cookies } from "next/headers";
import { createServerApiContext, SSR_TOKEN_COOKIE, type MeResponse } from "../lib/aptx";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const { api } = await createServerApiContext({ writableCookies: false });
  let me: MeResponse | null = null;
  try {
    me = await api.execute<MeResponse>({
      method: "GET",
      path: "/me"
    });
  } catch {
    me = null;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SSR_TOKEN_COOKIE)?.value ?? "";
  const tokenPreview = token ? `${token.slice(0, 10)}...` : "(none)";
  const error = params.error === "invalid_credentials" ? "Invalid username/password." : "";

  return (
    <main className="container">
      <h1>Next SSR Package Integration Demo</h1>
      <p>
        This page uses <code>@aptx/api-core</code>, <code>@aptx/api-client</code>,{" "}
        <code>@aptx/api-plugin-auth</code> and <code>@aptx/token-store-ssr-cookie</code> in SSR. Login in browser A
        with <code>user_a/pass_a</code>, browser B with <code>user_b/pass_b</code>, then refresh both pages.
      </p>

      <section className="panel">
        <h3>SSR Snapshot</h3>
        <p>RenderedAt: {new Date().toISOString()}</p>
        <p>Token Cookie: {tokenPreview}</p>
        <p>Current User (/me): {me ? `${me.displayName} (${me.username})` : "(anonymous)"}</p>
      </section>

      {!me ? (
        <section className="panel">
          <h3>Login</h3>
          <form action="/login" method="post">
            <label htmlFor="username">Username</label>
            <input id="username" name="username" placeholder="user_a or user_b" />
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" placeholder="pass_a or pass_b" />
            <button type="submit">Login</button>
          </form>
          {error ? <p style={{ color: "#b0203f" }}>{error}</p> : null}
        </section>
      ) : (
        <section className="panel">
          <h3>Logout</h3>
          <form action="/logout" method="post">
            <button className="danger" type="submit">
              Logout
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
