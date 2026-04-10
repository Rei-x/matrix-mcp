import { LINKEDIN_SUITE } from "./linkedin";
import { PERSONAL_SUITE } from "./personal";
import type { EvalSuite } from "./types";
import { WORK_SUITE } from "./work";

export { type EvalSuite, type QaPair } from "./types";

/**
 * All eval suites the runner knows about. Order is the default execution
 * order when --suite is not specified.
 */
export const ALL_SUITES: EvalSuite[] = [
  WORK_SUITE,
  PERSONAL_SUITE,
  LINKEDIN_SUITE,
];
