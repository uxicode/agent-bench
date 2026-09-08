import {
  RUN_TEST_COMMAND,
  type RunTestCommand,
} from "@/constants/agent";
import { assertSafeTaskId } from "@/lib/agent/guards";

export const ALLOWLIST_ARGV = {
  vitest: ["npx", "vitest", "run", "--config", "vitest.sandbox.config.ts"],
  npmTest: ["npm", "test"],
  tsc: ["tsc", "--noEmit"],
} as const;

export function isRunTestCommand(value: unknown): value is RunTestCommand {
  return (
    typeof value === "string" &&
    Object.values(RUN_TEST_COMMAND).includes(value as RunTestCommand)
  );
}

export function resolveRunTestsArgv(
  command: RunTestCommand,
  taskId: string,
): string[] {
  assertSafeTaskId(taskId);

  if (command === RUN_TEST_COMMAND.vitest)
    return [...ALLOWLIST_ARGV.vitest, `sandbox/tasks/${taskId}`];

  if (command === RUN_TEST_COMMAND.npmTest) return [...ALLOWLIST_ARGV.npmTest];

  return [...ALLOWLIST_ARGV.tsc];
}
