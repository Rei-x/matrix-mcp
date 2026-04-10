import type { Fixture } from "../fixture/types";

export interface QaPair {
  /** Single string-comparable answer (case-sensitive). */
  answer: string;
  /** Free-form question for the agent. */
  question: string;
  /** Short slug for reporting and the --task filter. */
  slug: string;
}

export interface EvalSuite {
  /** One-line description of what kind of usage this suite represents. */
  description: string;
  /** Which fixture (frozen Matrix world) this suite's questions are written against. */
  fixture: Fixture;
  /** The qa_pairs that make up this suite. */
  questions: QaPair[];
  /** Stable id for `--suite <slug>` filtering. */
  slug: string;
}
