import type { MatrixToolClient } from "@/matrix/client";

import { createConversationTools } from "./conversations";
import { createUserTools } from "./users";

export const createAllTools = (client: MatrixToolClient) => ({
  ...createConversationTools(client),
  ...createUserTools(client),
});
