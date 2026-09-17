import { CHAT_SUB_QUESTION_COUNT } from "@/constants/chat";
import type { ChatMessage, ChatWorkerAnswer } from "@/types/chat";

export function buildRouteSystemPrompt(): string {
  return `당신은 채팅 요청을 분류하는 라우터입니다.
반드시 JSON만 출력하세요. 설명 문장, 마크다운, 코드펜스는 쓰지 마세요.
형식:
{"route":"direct|decompose","reason":"한 줄"}

규칙:
- direct: 인사, 짧은 확인, 한 문장으로 끝나는 단순 질문
- decompose: 비교, 설계, 여러 조건, 왜/어떻게가 겹친 질문
- 도구가 필요해 보여도 tools를 쓰지 말고 decompose로 보내세요.`;
}

export function buildRouteUserPrompt(input: {
  question: string;
  history: ChatMessage[];
}): string {
  return `${formatHistory(input.history)}

현재 질문:
${input.question}

direct 또는 decompose JSON만 출력하세요.`;
}

export function buildDecomposeSystemPrompt(): string {
  return `당신은 사용자 질문을 실행 가능한 하위 질문으로 나누는 오케스트레이터입니다.
반드시 JSON만 출력하세요. 설명 문장, 마크다운, 코드펜스는 쓰지 마세요.
형식:
{"goal":"한 줄 목표","subQuestions":["하위 질문 1","하위 질문 2","하위 질문 3"]}

규칙:
- subQuestions는 정확히 ${CHAT_SUB_QUESTION_COUNT}개여야 합니다.
- 각 하위 질문은 원래 질문을 빠짐없이 커버하도록 서로 다른 각도를 가지세요.
  1) 핵심 개념/의도 파악
  2) 조건, 제약, 맥락
  3) 구체적 답 또는 다음 행동
- 원래 질문에 없는 주제를 새로 만들지 마세요.
- 답을 쓰지 마세요. 질문만 만드세요.`;
}

export function buildDecomposeUserPrompt(input: {
  question: string;
  history: ChatMessage[];
}): string {
  return `${formatHistory(input.history)}

현재 질문:
${input.question}

위 질문을 ${CHAT_SUB_QUESTION_COUNT}개의 하위 질문 JSON으로 나누세요.`;
}

export function buildWorkerSystemPrompt(): string {
  return `당신은 할당된 하위 질문 하나만 답하는 워커입니다.
다른 하위 질문은 추측하지 마세요.
한국어로 짧게 답하세요.`;
}

export function buildWorkerUserPrompt(input: {
  question: string;
  subQuestion: string;
}): string {
  return `원래 질문:
${input.question}

이 하위 질문만 답하세요:
${input.subQuestion}`;
}

export function buildSynthesizeSystemPrompt(): string {
  return `당신은 하위 워커 답변을 모아 원래 질문에 답하는 종합자입니다.
워커 답에 없는 사실을 지어내지 마세요.
한국어로 답하고 마지막에 한 줄 결론을 쓰세요.`;
}

export function buildSynthesizeUserPrompt(input: {
  question: string;
  goal: string;
  answers: ChatWorkerAnswer[];
}): string {
  const listed = input.answers
    .map((item, index) => `${index + 1}. ${item.question}\n${item.answer || "(답 없음)"}`)
    .join("\n\n");

  return `원래 질문:
${input.question}

목표:
${input.goal}

워커 답변:
${listed}

세 답을 근거로 원래 질문에 답하세요.`;
}

function formatHistory(history: ChatMessage[]): string {
  const text = history
    .slice(-6)
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
  return `최근 대화:\n${text || "(없음)"}`;
}
