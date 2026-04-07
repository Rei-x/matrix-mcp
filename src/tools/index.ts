import type { MatrixClient } from "@/matrix/client";

import { createConversationTools } from "./conversations";
import { createUserTools } from "./users";

export const createAllTools = (client: MatrixClient) => ({
  ...createConversationTools(client),
  ...createUserTools(client),
});
