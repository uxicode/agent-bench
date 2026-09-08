import { spawn } from "node:child_process";
import {
  AGENT_STACK_LINES,
  AGENT_STDOUT_EXCERPT_BYTES,
  AGENT_TEST_TIMEOUT_MS,
  RUN_TEST_COMMAND,
  type RunTestCommand,
} from "@/constants/agent";
import { isRunTestCommand, resolveRunTestsArgv } from "@/lib/agent/allowlist";
import { getRepoRoot } from "@/lib/agent/guards";
import type { RunTestsResult } from "@/types/agent";

export async function runTests(
  taskId: string,
  command: RunTestCommand = RUN_TEST_COMMAND.vitest,
): Promise<RunTestsResult> {
  if (!isRunTestCommand(command))
    throw new Error("허용되지 않은 테스트 명령입니다.");

  const argv = resolveRunTestsArgv(command, taskId);
  const [file, ...args] = argv;
  const output = await spawnAllowlisted(file, args);
  const stdoutExcerpt = excerptOutput(output.text);
  const { failMessage, stackExcerpt } = extractFailBlocks(output.text);

  return {
    ok: output.exitCode === 0,
    stdoutExcerpt,
    failMessage,
    stackExcerpt,
  };
}

interface SpawnOutput {
  exitCode: number;
  text: string;
}

function spawnAllowlisted(file: string, args: string[]): Promise<SpawnOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      cwd: getRepoRoot(),
      shell: false,
      timeout: AGENT_TEST_TIMEOUT_MS,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: "test",
      },
    });

    let text = "";
    child.stdout.on("data", (chunk: Buffer) => {
      text += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      text += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ exitCode: code ?? 1, text });
    });
  });
}

export function excerptOutput(output: string | SpawnOutput): string {
  const text = typeof output === "string" ? output : output.text;
  if (text.length <= AGENT_STDOUT_EXCERPT_BYTES) return text;
  return text.slice(0, AGENT_STDOUT_EXCERPT_BYTES);
}

export function extractFailBlocks(output: string): {
  failMessage: string;
  stackExcerpt: string;
} {
  const lines = output.split("\n");
  const failLines = lines.filter((line) =>
    /FAIL|AssertionError|Error:|expected/i.test(line),
  );
  const failMessage =
    failLines.slice(0, 10).join("\n") || output.slice(0, 500);
  const stackExcerpt = lines
    .filter((line) => /^\s*at\s+/.test(line))
    .slice(0, AGENT_STACK_LINES)
    .join("\n");

  return { failMessage, stackExcerpt };
}
