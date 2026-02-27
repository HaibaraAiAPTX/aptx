export interface TokenMeta {
  expiresAt?: number;
  [key: string]: unknown;
}

export interface TokenRecord {
  token?: string;
  meta?: TokenMeta;
}

export interface TokenStore {
  getToken(): string | undefined | Promise<string | undefined>;
  setToken(token: string, meta?: TokenMeta): void | Promise<void>;
  clearToken(): void | Promise<void>;
  getMeta?(): TokenMeta | undefined | Promise<TokenMeta | undefined>;
  setMeta?(meta: TokenMeta): void | Promise<void>;
  getRecord?(): TokenRecord | undefined | Promise<TokenRecord | undefined>;
  setRecord?(record: TokenRecord): void | Promise<void>;
}

export interface TokenStoreFactory<TOptions = unknown> {
  create(options: TOptions): TokenStore;
}

/** Store 选项：直接实例 | 同步工厂 | 异步工厂 */
export type TokenStoreResolver =
  | TokenStore
  | (() => TokenStore)
  | (() => Promise<TokenStore>);

/** 解析 TokenStoreResolver，返回 TokenStore 实例 */
export async function resolveTokenStore(
  resolver: TokenStoreResolver,
): Promise<TokenStore> {
  if (typeof resolver === "function") {
    return await resolver();
  }
  return resolver;
}
