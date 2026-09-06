export interface AppEnv {
  Bindings: {
    MATRIX_ACCESS_TOKEN: string;
    MATRIX_BASE_URL: string;
    /** Backend credential accepted only through Authorization: Bearer. */
    MCP_AUTH_TOKEN?: string;
    MCP_DEV_MODE?: string;
    [key: string]: string | undefined;
  };
}
