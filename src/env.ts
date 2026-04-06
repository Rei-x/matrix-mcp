export interface AppEnv {
  Bindings: {
    MATRIX_ACCESS_TOKEN: string;
    MATRIX_BASE_URL: string;
    /** When set, MCP is only served at `/:MCP_AUTH_TOKEN/mcp` (not at `/mcp`). */
    MCP_AUTH_TOKEN?: string;
    [key: string]: string | undefined;
  };
}
