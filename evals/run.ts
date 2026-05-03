/**
 * Anthropic-style eval runner for matrix-mcp.
 *
 * Patterned after `anthropics/skills/skills/mcp-builder/scripts/evaluation.py`:
 * for each qa_pair, drive Claude through a tool-use loop with the matrix-mcp
 * tools (backed by an in-memory fixture), extract the model's `<answer>` tag,
 * and compare it byte-for-byte against the expected answer.
 *
 * Multiple eval suites are registered in `evals/suites/index.ts`. By default
 * the runner executes them all; pass `--suite <slug>` to scope down.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... bun run evals/run.ts                  # all suites
 *   bun run evals/run.ts --suite personal                       # one suite
 *   bun run evals/run.ts --task most-recent-conversation        # one task (any suite)
 *   bun run evals/run.ts --trials 3                             # pass^k style
 *   bun run evals/run.ts --json evals/report.json               # write report
 *   bun run evals/run.ts --model claude-opus-4-6 --verbose      # override model
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  ContentBlock,
  MessageParam,
  Tool,
  ToolResultBlockParam,
  ToolUseBlock,
} from "@anthropic-ai/sdk/resources/messages";

import type { MatrixToolClient } from "@/matrix/client";
import { callTool, toMcpTool } from "@/mcp/tool";
import { ALL_TOOLS } from "@/tools";

import { FixtureMatrixClient } from "./fixture/client";
import { ALL_SUITES } from "./suites";
import type { EvalSuite, QaPair } from "./suites";

const DEFAULT_MODEL = "claude-sonnet-4-5";
const DEFAULT_TRIALS = 1;
const DEFAULT_MAX_STEPS = 20;
const DEFAULT_MAX_TOKENS = 4096;

interface RunnerFlags {
  json: string | null;
  maxSteps: number;
  model: string;
  suite: string | null;
  task: string | null;
  trials: number;
  verbose: boolean;
}

interface TrialResult {
  answer: string;
  correct: boolean;
  duration_ms: number;
  expected: string;
  steps: number;
  stop_reason: string;
  tool_calls: number;
}

interface TaskReport {
  passes: number;
  question: string;
  slug: string;
  trials: TrialResult[];
}

interface SuiteReport {
  description: string;
  pass_at_k: number;
  pass_pow_k: number;
  slug: string;
  tasks: TaskReport[];
  total_pass: number;
  total_trials: number;
}

interface SummaryReport {
  flags: RunnerFlags;
  pass_at_k: number;
  pass_pow_k: number;
  suites: SuiteReport[];
  total_pass: number;
  total_tasks: number;
  total_trials: number;
}

const HELP_TEXT = [
  "matrix-mcp eval runner",
  "",
  "Flags:",
  "  --suite <slug>      run only one eval suite (default: all)",
  "  --task <slug>       run a single qa_pair by slug (across whichever suites match)",
  "  --model <name>      Claude model id (default: claude-sonnet-4-5)",
  "  --trials <n>        runs per qa_pair (default: 1)",
  "  --json <path>       write JSON report to <path>",
  "  --max-steps <n>     max agent loop iterations per trial (default: 20)",
  "  --verbose, -v       print model output on failure",
  "",
  `Available suites: ${ALL_SUITES.map((s) => s.slug).join(", ")}`,
  "",
  "ANTHROPIC_API_KEY must be set in the environment.",
].join("\n");

const requireArg = (flag: string, value: string | undefined): string => {
  if (value === undefined) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
};

const parseFlags = (argv: string[]): RunnerFlags => {
  const flags: RunnerFlags = {
    json: null,
    maxSteps: DEFAULT_MAX_STEPS,
    model: DEFAULT_MODEL,
    suite: null,
    task: null,
    trials: DEFAULT_TRIALS,
    verbose: false,
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--model") {
      flags.model = requireArg("--model", next);
      i += 2;
    } else if (arg === "--trials") {
      flags.trials = Math.max(
        1,
        Number.parseInt(requireArg("--trials", next), 10)
      );
      i += 2;
    } else if (arg === "--suite") {
      flags.suite = requireArg("--suite", next);
      i += 2;
    } else if (arg === "--task") {
      flags.task = requireArg("--task", next);
      i += 2;
    } else if (arg === "--json") {
      flags.json = requireArg("--json", next);
      i += 2;
    } else if (arg === "--max-steps") {
      flags.maxSteps = Math.max(
        1,
        Number.parseInt(requireArg("--max-steps", next), 10)
      );
      i += 2;
    } else if (arg === "--verbose" || arg === "-v") {
      flags.verbose = true;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(HELP_TEXT);
      process.exit(0);
    } else {
      throw new Error(`unknown flag: ${arg ?? "<empty>"}`);
    }
  }
  return flags;
};

const SYSTEM_PROMPT = [
  "You are evaluating a Matrix MCP server. Use the provided MCP tools to answer the user's question — you have NO other context.",
  "",
  "Typical workflow:",
  "  1. Call `list_conversations` (optionally with `query`) to find the relevant chat. If you can't find it on the first try, broaden or change the query.",
  "  2. Call `read_conversation` with the chat's `conversation_id` to read its messages. Page back with `cursor` if you need older history.",
  "  3. Reason about what you read to compute the final answer.",
  "",
  "When you are confident, output your final answer wrapped in <answer> tags, exactly like:",
  "  <answer>your-answer-here</answer>",
  "Inside the tags put ONLY the answer — no quotes, no JSON, no surrounding prose, no trailing punctuation. Match the exact format the question asks for (case, date format, etc.).",
  "",
  "Do not call write tools (e.g. send_message) — they are blocked in eval mode and will return an error.",
].join("\n");

// Module-level: tool definitions are frozen, JSON-Schema generation is the
// expensive part. Compute once and reuse across every suite.
const ANTHROPIC_TOOL_DEFS: Tool[] = ALL_TOOLS.map((tool) => {
  const mcpTool = toMcpTool(tool);
  return {
    description: tool.description,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- our zod inputs are z.object so the JSON schema has type:object, matching Tool.InputSchema
    input_schema: mcpTool.inputSchema as Tool.InputSchema,
    name: tool.name,
  };
});

type ToolExecutor = (input: unknown) => Promise<string>;

const buildExecutors = (
  client: MatrixToolClient
): Map<string, ToolExecutor> => {
  const executors = new Map<string, ToolExecutor>();
  for (const tool of ALL_TOOLS) {
    executors.set(tool.name, async (input) => {
      const result = await callTool(tool, input ?? {}, { client });
      const textBlock = result.content.find((c) => c.type === "text");
      const text = textBlock?.text ?? JSON.stringify(result);
      if (result.isError === true) {
        // eslint-disable-next-line unicorn/prefer-type-error -- isError is a flag, not a typeof check
        throw new Error(text);
      }
      return text;
    });
  }
  return executors;
};

interface AgentRunResult {
  answer: string;
  steps: number;
  stop_reason: string;
  tool_calls: number;
}

const extractAnswer = (text: string): string => {
  const m = /<answer>([\s\S]*?)<\/answer>/.exec(text);
  return m?.[1]?.trim() ?? text.trim();
};

const collectAssistantText = (blocks: ContentBlock[]): string =>
  blocks
    .filter(
      (b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text"
    )
    .map((b) => b.text)
    .join("\n");

const runOneTrial = async (
  client: Anthropic,
  flags: RunnerFlags,
  tools: Tool[],
  executors: Map<string, ToolExecutor>,
  qa: QaPair
): Promise<AgentRunResult> => {
  const messages: MessageParam[] = [{ content: qa.question, role: "user" }];
  let toolCalls = 0;
  let stopReason = "max_steps";
  let answer = "";

  for (let step = 1; step <= flags.maxSteps; step += 1) {
    const response = await client.messages.create({
      max_tokens: DEFAULT_MAX_TOKENS,
      messages,
      model: flags.model,
      system: SYSTEM_PROMPT,
      tools,
    });
    messages.push({ content: response.content, role: "assistant" });
    stopReason = response.stop_reason ?? "unknown";

    if (response.stop_reason === "end_turn") {
      answer = extractAnswer(collectAssistantText(response.content));
      return {
        answer,
        steps: step,
        stop_reason: stopReason,
        tool_calls: toolCalls,
      };
    }

    if (response.stop_reason !== "tool_use") {
      // refusal, max_tokens, pause_turn, etc. — bail with whatever text we have
      answer = extractAnswer(collectAssistantText(response.content));
      return {
        answer,
        steps: step,
        stop_reason: stopReason,
        tool_calls: toolCalls,
      };
    }

    const toolUseBlocks = response.content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use"
    );
    const toolResults: ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      toolCalls += 1;
      const exec = executors.get(block.name);
      if (exec === undefined) {
        toolResults.push({
          content: `Error: unknown tool ${block.name}`,
          is_error: true,
          tool_use_id: block.id,
          type: "tool_result",
        });
        continue;
      }
      try {
        const text = await exec(block.input);
        toolResults.push({
          content: text,
          tool_use_id: block.id,
          type: "tool_result",
        });
      } catch (error) {
        toolResults.push({
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          is_error: true,
          tool_use_id: block.id,
          type: "tool_result",
        });
      }
    }
    messages.push({ content: toolResults, role: "user" });
  }

  return {
    answer,
    steps: flags.maxSteps,
    stop_reason: stopReason,
    tool_calls: toolCalls,
  };
};

const formatStatus = (correct: boolean): string => (correct ? "✓" : "✗");

const printTrial = (
  flags: RunnerFlags,
  qa: QaPair,
  trialIndex: number,
  result: TrialResult
): void => {
  const head = `${formatStatus(result.correct)} ${qa.slug}`;
  const tail = `(trial ${trialIndex + 1}/${flags.trials}, ${result.tool_calls} tool calls, ${result.steps} steps, ${result.duration_ms}ms)`;
  console.log(`${head} ${tail}`);
  if (!result.correct || flags.verbose) {
    console.log(`    expected: ${JSON.stringify(result.expected)}`);
    console.log(`    got:      ${JSON.stringify(result.answer)}`);
    console.log(`    stop:     ${result.stop_reason}`);
  }
};

const taskStatusGlyph = (task: TaskReport, trials: number): string => {
  if (task.passes === trials) {
    return "✓";
  }
  if (task.passes > 0) {
    return "~";
  }
  return "✗";
};

const printSuiteHeader = (suite: EvalSuite, taskCount: number): void => {
  console.log("");
  console.log(`▶ suite: ${suite.slug} — ${taskCount} tasks`);
  console.log(`  ${suite.description}`);
  console.log("");
};

const printSuiteFooter = (report: SuiteReport, trials: number): void => {
  console.log("");
  console.log(`  ── ${report.slug} ──`);
  for (const task of report.tasks) {
    console.log(
      `    ${taskStatusGlyph(task, trials)} ${task.slug} — ${task.passes}/${trials}`
    );
  }
  console.log(
    `    pass^k ${report.pass_pow_k}/${report.tasks.length}  pass@k ${report.pass_at_k}/${report.tasks.length}  trials ${report.total_pass}/${report.total_trials}`
  );
};

const printSummary = (report: SummaryReport): void => {
  console.log("");
  console.log("═".repeat(60));
  console.log("  overall");
  console.log("═".repeat(60));
  for (const suite of report.suites) {
    console.log(
      `  ${suite.slug.padEnd(12)} pass^k ${suite.pass_pow_k}/${suite.tasks.length}  pass@k ${suite.pass_at_k}/${suite.tasks.length}`
    );
  }
  console.log("─".repeat(60));
  console.log(
    `  pass^k: ${report.pass_pow_k}/${report.total_tasks} (every trial correct)`
  );
  console.log(
    `  pass@k: ${report.pass_at_k}/${report.total_tasks} (any trial correct)`
  );
  console.log(
    `  trials: ${report.total_pass}/${report.total_trials} correct overall`
  );
  console.log("");
};

const selectSuites = (flags: RunnerFlags): EvalSuite[] => {
  const bySuite =
    flags.suite === null
      ? ALL_SUITES
      : ALL_SUITES.filter((s) => s.slug === flags.suite);
  if (bySuite.length === 0) {
    console.error(
      `no suite matches --suite ${flags.suite ?? ""}; available: ${ALL_SUITES.map((s) => s.slug).join(", ")}`
    );
    process.exit(1);
  }
  if (flags.task === null) {
    return bySuite;
  }
  // Filter each suite's qa_pairs to just the matching task slug; drop empty suites.
  const filtered: EvalSuite[] = bySuite
    .map((s) => ({
      ...s,
      questions: s.questions.filter((q) => q.slug === flags.task),
    }))
    .filter((s) => s.questions.length > 0);
  if (filtered.length === 0) {
    console.error(
      `no qa_pair matches --task ${flags.task ?? ""} in the selected suite(s)`
    );
    process.exit(1);
  }
  return filtered;
};

const runSuite = async (
  client: Anthropic,
  flags: RunnerFlags,
  suite: EvalSuite
): Promise<SuiteReport> => {
  const fixture = new FixtureMatrixClient(suite.fixture);
  const executors = buildExecutors(fixture);

  printSuiteHeader(suite, suite.questions.length);

  const taskReports: TaskReport[] = [];
  for (const qa of suite.questions) {
    const trials: TrialResult[] = [];
    for (let t = 0; t < flags.trials; t += 1) {
      const start = Date.now();
      const run = await runOneTrial(
        client,
        flags,
        ANTHROPIC_TOOL_DEFS,
        executors,
        qa
      );
      const duration = Date.now() - start;
      const correct = run.answer === qa.answer;
      const trial: TrialResult = {
        answer: run.answer,
        correct,
        duration_ms: duration,
        expected: qa.answer,
        steps: run.steps,
        stop_reason: run.stop_reason,
        tool_calls: run.tool_calls,
      };
      trials.push(trial);
      printTrial(flags, qa, t, trial);
    }
    taskReports.push({
      passes: trials.filter((tr) => tr.correct).length,
      question: qa.question,
      slug: qa.slug,
      trials,
    });
  }

  const report: SuiteReport = {
    description: suite.description,
    pass_at_k: taskReports.filter((t) => t.passes > 0).length,
    pass_pow_k: taskReports.filter((t) => t.passes === flags.trials).length,
    slug: suite.slug,
    tasks: taskReports,
    total_pass: taskReports.reduce(
      (acc, t) => acc + t.trials.filter((tr) => tr.correct).length,
      0
    ),
    total_trials: taskReports.reduce((acc, t) => acc + t.trials.length, 0),
  };
  printSuiteFooter(report, flags.trials);
  return report;
};

const main = async (): Promise<void> => {
  const flags = parseFlags(process.argv.slice(2));

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey === undefined || apiKey === "") {
    console.error(
      "ANTHROPIC_API_KEY is required (the eval drives a real Claude tool-use loop)"
    );
    process.exit(1);
  }

  const selectedSuites = selectSuites(flags);
  const totalTaskCount = selectedSuites.reduce(
    (acc, s) => acc + s.questions.length,
    0
  );

  const client = new Anthropic({ apiKey });

  console.log(
    `matrix-mcp eval — model=${flags.model} trials=${flags.trials} suites=${selectedSuites.length} tasks=${totalTaskCount}`
  );

  const suiteReports: SuiteReport[] = [];
  for (const suite of selectedSuites) {
    const report = await runSuite(client, flags, suite);
    suiteReports.push(report);
  }

  const summary: SummaryReport = {
    flags,
    pass_at_k: suiteReports.reduce((acc, s) => acc + s.pass_at_k, 0),
    pass_pow_k: suiteReports.reduce((acc, s) => acc + s.pass_pow_k, 0),
    suites: suiteReports,
    total_pass: suiteReports.reduce((acc, s) => acc + s.total_pass, 0),
    total_tasks: suiteReports.reduce((acc, s) => acc + s.tasks.length, 0),
    total_trials: suiteReports.reduce((acc, s) => acc + s.total_trials, 0),
  };

  printSummary(summary);

  if (flags.json !== null) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(flags.json, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`report written to ${flags.json}`);
  }

  process.exit(summary.pass_pow_k === summary.total_tasks ? 0 : 1);
};

try {
  await main();
} catch (error: unknown) {
  console.error("eval runner failed:", error);
  process.exit(2);
}
