# AI Agent

Next.js App Router에 `@langchain/core`, `@langchain/ollama`를 붙인 로컬 플레이그라운드입니다. Chat은 질문 라우팅·분해 오케스트레이션, Agent는 코드리뷰 순차 파이프라인을 씁니다. 모델 호출은 서버 Route Handler에서만 합니다.

## 사전 준비

1. [Ollama](https://ollama.com/)가 실행 중이어야 합니다.
2. 사용할 모델을 받아 둡니다.

```bash
ollama pull gemma2:9b
ollama pull qwen2.5-coder:7b
```

## 시작하기

```bash
cp .env.example .env.local
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 Chat과 Agent 탭을 사용할 수 있습니다.

Chat·Agent 모두 응답이 2분을 넘기면 모델 호출과 API 연결을 끊습니다.

```bash
npm run test:unit    # 가드/파이프라인 단위 테스트
npm test             # sandbox 과제 테스트만
```

## 모델 역할

| 모델 | Chat | Agent |
| --- | --- | --- |
| `qwen2.5-coder:7b` | planner. 바로 답할지(`direct`) 나눌지(`decompose`) 고르고, 나눌 때는 하위 질문 3개를 JSON으로 만듦 | analyzer. 코드 기술 분석 JSON |
| `gemma2:9b` (또는 Chat에서 고른 모델) | worker. 직접 답, 하위 질문 답, 최종 종합 스트림 | reporter. 분석 JSON을 한국어 리포트로 작성 |
| `nomic-embed-text` | 셀렉트에 보이지만 임베딩용. 채팅에 부적합 | 사용하지 않음 |

로컬 Ollama는 보통 한 모델만 메모리에 올립니다. planner/analyzer가 끝나면 `keep_alive: 0`으로 내리고 worker/reporter를 올립니다. 같은 모델을 worker로 3번 부를 때는 내리지 않고 순차 호출합니다.

---

## Chat 워크플로우

엔드포인트: `POST /api/chat`  
코드: `src/lib/chat/orchestrate.ts`, `src/lib/chat/prompts.ts`

사용자가 메시지를 보내면 브라우저가 대화 목록을 `/api/chat`으로 보냅니다. 서버는 LangChain `RunnableSequence`로 계획을 만든 뒤, **마지막 단계만** worker로 스트리밍합니다.

```text
사용자 질문
    │
    ▼
qwen2.5-coder:7b  (planner)
{"route":"direct"|"decompose"}
    │
    ├─ direct ─────────────────────────────► worker 스트림
    │                                        (고른 모델, 없으면 gemma2:9b)
    │                                        원래 대화 그대로 답변
    │
    └─ decompose
           │
           ▼
      qwen이 하위 질문 3개 JSON 생성
           │
           ▼
      qwen 언로드 (worker와 다를 때)
           │
           ▼
      worker 순차 invoke × 3
      (하위 질문마다 짧은 답)
           │
           ▼
      worker 스트림
      (세 답을 근거로 원래 질문 종합)
```

- 라우터가 `tools`를 내도 툴은 없고 `decompose`로 폴백합니다.
- 라우트 JSON이 깨지면 `direct`로 떨어집니다.
- 화면에는 최종 스트림만 보입니다. 중간 하위 답은 종합 프롬프트에만 들어갑니다.

---

## Agent 워크플로우

엔드포인트: `POST /api/agent/run` (NDJSON 스트림)  
코드: `src/lib/agent/review-pipeline.ts`, `src/lib/agent/loop.ts`, `src/lib/agent/prompts.ts`

코드리뷰만 합니다. 테스트/최적화/리팩터링으로 파일을 고치지 않습니다. 붙여넣은 코드, 파일 열기, 드래그 앤 드롭, 절대 경로를 받습니다. 브라우저 파일 선택은 실제 경로를 주지 않아 내용으로 실행됩니다.

```text
소스 로드 (붙여넣기 또는 경로 읽기)
    │
    ▼
qwen2.5-coder:7b  (analyzer)
기술 분석 JSON
summary / findings / risks / suggestions
    │
    ▼
qwen 언로드  keep_alive: 0
    │
    ▼
gemma2:9b  (reporter)
한국어 마크다운 리포트
    │
    ▼
타임라인 + 리포트 표시, runs/에 기록
```

- 단계는 LangChain `RunnableSequence`(분석 → 언로드 → 리포트)입니다.
- UI는 NDJSON으로 연결 상태, 단계(소스/분석/언로드/리포트), 로그를 실시간으로 받습니다.
- 코드는 다시 쓰지 않습니다. Diff를 원본에 적용하지 않습니다.

결과는 `runs/`에 저장되며 gitignore 됩니다.

---

## 환경 변수

| 키 | 기본값 | 설명 |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama 서버 주소 |
| `OLLAMA_MODEL` | `gemma2:9b` | Chat worker 기본값. Agent reporter는 이 값과 별개로 `gemma2:9b` 고정 |
| `OLLAMA_TEMPERATURE` | `0.7` | Chat worker 말투. planner/analyzer는 더 낮은 temperature를 코드에서 씀 |

## 구조

```text
src/
  app/api/chat/route.ts       Chat 오케스트레이션 + worker 스트림
  app/api/agent/run/route.ts  코드리뷰 Sequential Pipeline (NDJSON)
  app/api/health/route.ts     Ollama 연결/모델 확인
  lib/chat/                   라우트·분해·워커·종합 프롬프트
  lib/agent/                  코드리뷰 파이프라인, 가드
  lib/ollama/                 ChatOllama 팩토리, keep_alive 언로드
  constants/ollama.ts         모델 이름, Chat/Agent 역할 map
```
