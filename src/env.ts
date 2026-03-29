export interface AppEnv {
  Bindings: {
    MATRIX_ACCESS_TOKEN: string;
    MATRIX_BASE_URL: string;
    MCP_AUTH_TOKEN?: string;
    [key: string]: string | undefined;
  };
}
