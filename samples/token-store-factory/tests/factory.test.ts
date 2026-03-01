/**
 * TokenStore 工厂函数测试
 *
 * 演示 Auth 中间件的 store 选项支持工厂函数：
 * - 浏览器端：同步工厂函数返回单例 CookieTokenStore
 * - SSR 端：异步工厂函数返回每请求独立的 SsrCookieTokenStore
 *
 * 注意：本测试在 Node.js 环境运行，createAuthController.ensureValidToken
 * 在服务端环境下不会自动刷新 token（这是设计决策，保持服务端无状态）
 */
import { describe, expect, it, vi } from "vitest";
import { createAuthController } from "@aptx/api-plugin-auth";
import { type TokenStore, type TokenStoreResolver, resolveTokenStore } from "@aptx/token-store";
import { CookieTokenStore } from "@aptx/token-store-cookie";
import { SsrCookieTokenStore } from "@aptx/token-store-ssr-cookie";

// ============================================================================
// 工具函数和模拟
// ============================================================================

/** 模拟浏览器的 cookie 存储 */
function createMockBrowserCookieJar() {
  const jar = new Map<string, string>();
  return {
    jar,
    get: (key: string) => jar.get(key),
    set: (key: string, value: string) => jar.set(key, value),
    remove: (key: string) => jar.delete(key),
    clear: () => jar.clear(),
  };
}

/** 模拟 SSR 请求的 cookie 上下文 */
function createMockSsrRequestContext(initialCookies: Record<string, string> = {}) {
  const requestCookies = new Map(Object.entries(initialCookies));
  const responseCookies: Array<{ name: string; value: string; options?: Record<string, unknown> }> = [];

  return {
    /** 读取请求的 Cookie header */
    getCookieHeader: () => {
      return Array.from(requestCookies.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    },
    /** 写入响应的 Set-Cookie header */
    setCookie: (value: string) => {
      // 简单解析 Set-Cookie 格式
      const [nameValue] = value.split(";");
      if (!nameValue) return;
      const eq = nameValue.indexOf("=");
      if (eq < 0) return;
      const name = nameValue.slice(0, eq).trim();
      const val = nameValue.slice(eq + 1).trim();
      if (val === "") {
        requestCookies.delete(name);
      } else {
        requestCookies.set(name, val);
      }
      responseCookies.push({ name, value: val });
    },
    /** 获取响应的 Set-Cookie 记录 */
    getResponseCookies: () => [...responseCookies],
    /** 获取当前请求的 cookie */
    getRequestCookie: (name: string) => requestCookies.get(name),
  };
}

// ============================================================================
// resolveTokenStore 基础测试
// ============================================================================

describe("resolveTokenStore", () => {
  it("直接返回 TokenStore 实例", async () => {
    const store: TokenStore = {
      getToken: () => "test-token",
      setToken: vi.fn(),
      clearToken: vi.fn(),
    };

    const result = await resolveTokenStore(store);
    expect(result).toBe(store);
    expect(await result.getToken()).toBe("test-token");
  });

  it("调用同步工厂函数并返回结果", async () => {
    const store: TokenStore = {
      getToken: () => "factory-token",
      setToken: vi.fn(),
      clearToken: vi.fn(),
    };

    const factory = () => store;
    const result = await resolveTokenStore(factory);
    expect(result).toBe(store);
    expect(await result.getToken()).toBe("factory-token");
  });

  it("调用异步工厂函数并返回结果", async () => {
    const store: TokenStore = {
      getToken: () => "async-factory-token",
      setToken: vi.fn(),
      clearToken: vi.fn(),
    };

    const factory = async () => {
      // 模拟异步初始化（如 Next.js cookies()）
      await new Promise((resolve) => setTimeout(resolve, 1));
      return store;
    };

    const result = await resolveTokenStore(factory);
    expect(result).toBe(store);
    expect(await result.getToken()).toBe("async-factory-token");
  });
});

// ============================================================================
// 浏览器端场景：同步工厂函数 + 单例 store
// ============================================================================

describe("浏览器端场景", () => {
  it("使用同步工厂函数创建 AuthController", async () => {
    // 模拟浏览器 cookie 环境
    const cookieJar = createMockBrowserCookieJar();
    cookieJar.set("auth_token", "browser-token-123");

    // 创建单例 store（模拟 CookieTokenStore）
    const store = new CookieTokenStore({ tokenKey: "auth_token" });

    // 模拟 js-cookie 行为
    vi.spyOn(store, "getToken").mockImplementation(() => cookieJar.get("auth_token"));
    vi.spyOn(store, "setToken").mockImplementation((token) => cookieJar.set("auth_token", token));

    // 使用同步工厂函数（推荐模式）
    const storeResolver: TokenStoreResolver = () => store;

    const controller = createAuthController({
      store: storeResolver,
      refreshToken: async () => ({ token: "new-browser-token", expiresAt: Date.now() + 3600000 }),
    });

    const token = await controller.ensureValidToken();
    expect(token).toBe("browser-token-123");

    // 验证每次调用都会执行工厂函数
    const token2 = await controller.ensureValidToken();
    expect(token2).toBe("browser-token-123");
  });
});

// ============================================================================
// SSR 场景：异步工厂函数 + 每请求独立 store
// ============================================================================

describe("SSR 场景", () => {
  it("使用异步工厂函数创建每请求独立的 store", async () => {
    // 模拟两个不同用户的 SSR 请求
    const userAContext = createMockSsrRequestContext({
      aptx_token: "user-a-token",
      aptx_token_meta: JSON.stringify({ expiresAt: Date.now() + 3600000 }),
    });

    const userBContext = createMockSsrRequestContext({
      aptx_token: "user-b-token",
      aptx_token_meta: JSON.stringify({ expiresAt: Date.now() + 3600000 }),
    });

    // 模拟 Next.js App Router 的 cookies() API
    const createSsrStoreFactory = (ctx: ReturnType<typeof createMockSsrRequestContext>) => {
      return async () => {
        // 模拟 await cookies()
        await Promise.resolve();
        return new SsrCookieTokenStore({
          tokenKey: "aptx_token",
          metaKey: "aptx_token_meta",
          getCookieHeader: () => ctx.getCookieHeader(),
          setCookie: (v) => ctx.setCookie(v),
        });
      };
    };

    // 用户 A 的 AuthController
    const controllerA = createAuthController({
      store: createSsrStoreFactory(userAContext),
      refreshToken: async () => ({ token: "user-a-new-token", expiresAt: Date.now() + 3600000 }),
    });

    // 用户 B 的 AuthController
    const controllerB = createAuthController({
      store: createSsrStoreFactory(userBContext),
      refreshToken: async () => ({ token: "user-b-new-token", expiresAt: Date.now() + 3600000 }),
    });

    // 并发执行两个用户的请求
    const [tokenA, tokenB] = await Promise.all([
      controllerA.ensureValidToken(),
      controllerB.ensureValidToken(),
    ]);

    // 验证 token 不会串
    expect(tokenA).toBe("user-a-token");
    expect(tokenB).toBe("user-b-token");
  });

  it("SSR 环境下即使 token 过期也不会自动刷新", async () => {
    // 模拟过期的 token
    const ctx = createMockSsrRequestContext({
      aptx_token: "expired-token",
      aptx_token_meta: JSON.stringify({ expiresAt: Date.now() - 1000 }), // 已过期
    });

    const storeFactory = async () => {
      await Promise.resolve();
      return new SsrCookieTokenStore({
        tokenKey: "aptx_token",
        metaKey: "aptx_token_meta",
        getCookieHeader: () => ctx.getCookieHeader(),
        setCookie: (v) => ctx.setCookie(v),
      });
    };

    let refreshCalled = false;
    const controller = createAuthController({
      store: storeFactory,
      refreshToken: async () => {
        refreshCalled = true;
        return {
          token: "new-ssr-token",
          expiresAt: Date.now() + 3600000,
        };
      },
    });

    const token = await controller.ensureValidToken();

    // SSR 环境下不会自动刷新，返回原始 token
    expect(token).toBe("expired-token");
    expect(refreshCalled).toBe(false);

    // 验证 setCookie 没有被调用
    const responseCookies = ctx.getResponseCookies();
    expect(responseCookies).toHaveLength(0);
  });
});

// ============================================================================
// 向后兼容性测试
// ============================================================================

describe("向后兼容性", () => {
  it("直接传入 TokenStore 实例仍然有效", async () => {
    const store: TokenStore = {
      getToken: () => "legacy-token",
      setToken: vi.fn(),
      clearToken: vi.fn(),
    };

    // 直接传实例（旧用法）
    const controller = createAuthController({
      store, // 注意：直接传实例，不是工厂函数
      refreshToken: async () => ({ token: "new-token", expiresAt: Date.now() + 3600000 }),
    });

    const token = await controller.ensureValidToken();
    expect(token).toBe("legacy-token");
  });
});

// ============================================================================
// 类型安全测试
// ============================================================================

describe("类型安全", () => {
  it("TokenStoreResolver 类型接受三种形式", () => {
    const instanceStore: TokenStore = {
      getToken: () => "instance",
      setToken: () => {},
      clearToken: () => {},
    };

    const syncFactory: TokenStoreResolver = () => instanceStore;
    const asyncFactory: TokenStoreResolver = async () => instanceStore;
    const directInstance: TokenStoreResolver = instanceStore;

    // 类型检查通过即测试通过
    expect(typeof syncFactory).toBe("function");
    expect(typeof asyncFactory).toBe("function");
    expect(typeof directInstance.getToken).toBe("function");
  });
});
