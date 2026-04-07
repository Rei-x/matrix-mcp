import { env } from "cloudflare:test";

import { registerConversationTests } from "./mcp/register-conversations";
import { registerErrorHandlingTests } from "./mcp/register-errors";
import { registerHttpTransportTests } from "./mcp/register-http";
import { registerToolListingTests } from "./mcp/register-tool-listing";
import { createMcpSuite } from "./mcp/suite";

describe.sequential("mcp server", () => {
  const s = createMcpSuite(env);

  test("prepares shared conversation", async () => {
    await s.ensureSharedRoom();
    expect(s.room.id).toMatch(/^!/);
  });

  /* Register nested describe blocks synchronously (must run during suite setup, not in a hook). */
  /* eslint-disable jest/require-hook -- Vitest describe registration pattern */
  registerToolListingTests(s);
  registerConversationTests(s);
  registerErrorHandlingTests(s);
  registerHttpTransportTests(s);
  /* eslint-enable jest/require-hook */

  test("suite completes with shared conversation", () => {
    expect(s.room.id).toMatch(/^!/);
  });
});
