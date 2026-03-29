import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { MatrixClient } from "@/matrix/client";

import { registerMessageTools } from "./messages";
import { registerRoomTools } from "./rooms";
import { registerUserTools } from "./users";

export const registerAllTools = (server: McpServer, client: MatrixClient) => {
  registerRoomTools(server, client);
  registerMessageTools(server, client);
  registerUserTools(server, client);
};
