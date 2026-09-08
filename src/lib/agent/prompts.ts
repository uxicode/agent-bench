import {
  AGENT_ACTION,
  type AgentAction,
  type PatchStrategy,
} from "@/constants/agent";

export function buildSystemPrompt(): string {
  return `당신은 로컬 TypeScript 코딩 에이전트입니다.
반드시 JSON만 출력하세요. 설명 문장은 쓰지 마세요.
형식:
{"files":[{"path":"src/example.ts","content":"...전체 파일..."}]}

규칙:
- path는 sandbox 상대 경로입니다. 이미 있는 src/*.ts 파일명만 사용하세요.
- 파일은 구현 1개 + 테스트 1개만 다루세요.
- 테스트는 vitest (describe/it/expect)를 사용하세요.
- 외부 패키지와 실제 네트워크 호출은 금지입니다.
- import는 상대 경로와 vitest만 사용하세요.`;
}

export function buildWriteTestsPrompt(input: {
  action: AgentAction;
  sourceCode: string;
  implPath: string;
  testPath: string;
  instruction?: string;
}): string {
  const goal =
    input.action === AGENT_ACTION.test
      ? "이 코드의 동작을 검증하는 테스트를 작성하세요. 구현 파일은 수정하지 마세요."
      : "이 코드의 현재 동작을 고정하는 특성화 테스트를 작성하세요. 이후 최적화/리팩터링이 동작을 바꾸지 못하게 잠급니다. 구현 파일은 수정하지 마세요.";

  return `${goal}

대상 파일: ${input.implPath}
테스트 파일: ${input.testPath}
${input.instruction ? `\n추가 지시:\n${input.instruction}\n` : ""}
코드:
\`\`\`ts
${input.sourceCode}
\`\`\`

테스트 파일만 JSON files 배열로 출력하세요.`;
}

export function buildTransformPrompt(input: {
  action: AgentAction;
  sourceCode: string;
  filesContext: string;
  implPath: string;
  instruction?: string;
}): string {
  const goal =
    input.action === AGENT_ACTION.optimize
      ? "구현만 최적화하세요. 공개 API와 동작을 유지하고, 불필요한 반복/복사/비효율을 줄이세요."
      : "구현만 리팩터링하세요. 가독성과 구조를 개선하고 공개 API와 동작은 유지하세요.";

  return `${goal}
테스트 파일은 절대 수정하지 마세요. ${input.implPath}만 출력하세요.
${input.instruction ? `\n추가 지시:\n${input.instruction}\n` : ""}
원본:
\`\`\`ts
${input.sourceCode}
\`\`\`

현재 파일:
${input.filesContext}

JSON files 배열만 출력하세요.`;
}

export function buildPatchPrompt(input: {
  filesContext: string;
  failMessage: string;
  stackExcerpt: string;
  strategy: PatchStrategy;
  lockKind: "impl" | "test";
}): string {
  const strategyHint =
    input.strategy === "rewrite"
      ? "같은 실패가 반복되었습니다. 대상 파일을 처음부터 다시 작성하세요."
      : "실패한 부분만 최소로 수정하세요.";

  const lockHint =
    input.lockKind === "impl"
      ? "구현 파일은 수정하지 마세요. 테스트 파일만 고치세요."
      : "테스트 파일은 수정하지 마세요. 구현 파일만 고치세요.";

  return `${strategyHint}
${lockHint}

현재 파일:
${input.filesContext}

실패 요약:
${input.failMessage}

스택:
${input.stackExcerpt}

JSON files 배열만 출력하세요.`;
}

export function buildJsonRetryPrompt(): string {
  return `이전 응답은 JSON이 아닙니다. {"files":[{"path":"...","content":"..."}]} 만 출력하세요. 다른 텍스트는 넣지 마세요.`;
}
