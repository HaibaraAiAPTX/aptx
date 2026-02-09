declare namespace wx {
  type RequestOptions = {
    url: string;
    method?: string;
    data?: unknown;
    header?: Record<string, string>;
    timeout?: number;
    success?: (result: {
      statusCode: number;
      header: Record<string, string>;
      data: unknown;
    }) => void;
    fail?: (error: unknown) => void;
  };

  function request(options: RequestOptions): void;
}
