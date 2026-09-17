import { REVIEW_PIPELINE_MODELS } from "@/constants/ollama";
import type { ReviewPipelineInput } from "@/types/agent";

export function buildAnalysisSystemPrompt(): string {
  return `당신은 TypeScript/JavaScript 코드의 기술 분석가입니다.
반드시 JSON만 출력하세요. 설명 문장, 마크다운, 코드펜스는 쓰지 마세요.
형식:
{"summary":"한 줄 요약","findings":[{"severity":"high|medium|low","title":"제목","detail":"근거","location":"심볼 또는 줄"}],"risks":["위험"],"suggestions":["개선 제안"]}

규칙:
- 코드를 수정하거나 다시 작성하지 마세요. 분석만 하세요.
- 공개 API, 복잡도, 버그 가능성, 보안, 성능, 테스트 공백을 우선하세요.
- 근거가 없는 지적은 넣지 마세요.
- location은 함수명이나 대략적인 위치만 적어도 됩니다.`;
}

export function buildAnalysisUserPrompt(input: ReviewPipelineInput): string {
  return `파일: ${input.filename}
${input.instruction ? `\n추가 지시:\n${input.instruction}\n` : ""}
코드:
\`\`\`ts
${input.sourceCode}
\`\`\`

기술 분석 JSON만 출력하세요.`;
}

export function buildReportSystemPrompt(): string {
  return `당신은 시니어 엔지니어에게 전달할 코드리뷰 리포트를 작성합니다.
한국어 마크다운만 출력하세요. JSON은 쓰지 마세요.

구성:
1. 한 줄 결론
2. 핵심 이슈 (심각도 순)
3. 리스크
4. 개선 제안
5. 남은 질문

규칙:
- 앞 단계의 기술 분석을 근거로 쓰되, 그대로 복붙하지 말고 읽기 쉽게 재구성하세요.
- 전체 코드를 다시 작성하지 마세요.
- 분석에 없는 사실을 지어내지 마세요.

[개선 제안 작성 규칙]:
- '개선 제안'의 각 항목은 문제 위치(라인 번호 또는 식별자)와 문제 코드 1줄을 명시하세요.
- 각 항목은 다음 형식으로 작성하세요:
  * [위치] 문제 코드
    - 문제점: 왜 문제인지 기술
    - 개선 방향: 변경 방법 및 짧은 대체 코드 제시`;
}

export function buildReportUserPrompt(input: {
  filename: string;
  sourceCode: string;
  analysisJson: string;
  instruction?: string;
}): string {
  return `파일: ${input.filename}
분석 모델: ${REVIEW_PIPELINE_MODELS.analyzer}
리포트 모델: ${REVIEW_PIPELINE_MODELS.reporter}
${input.instruction ? `\n추가 지시:\n${input.instruction}\n` : ""}
기술 분석:
${input.analysisJson}

원본 코드:
\`\`\`ts
${input.sourceCode}
\`\`\`

최종 코드리뷰 리포트를 작성하세요.`;
}
