# AI Agent

Next.js App Router 보일러플레이트에 `@langchain/core`, `@langchain/ollama`를 붙인 로컬 개발 환경입니다.

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

- **Chat**: 로컬 모델과 스트리밍 대화
- **Agent**: 코드 또는 파일 경로를 넣고 코드리뷰 (`POST /api/agent/run`). `qwen2.5-coder:7b`가 기술 분석을 끝낸 뒤 `keep_alive: 0`으로 언로드되고, `gemma2:9b`가 LangChain `RunnableSequence`로 최종 리포트를 작성합니다. 파일은 경로 입력, 파일 열기, 드래그 앤 드롭으로 추가할 수 있고 다른 프로젝트의 절대 경로도 허용합니다.

Chat·Agent 모두 응답이 2분을 넘기면 경고와 함께 모델 호출과 API 연결을 끊습니다.

결과는 `runs/`에 저장되며 gitignore 됩니다. 브라우저 파일 선택만으로는 실제 경로를 알 수 없어 내용으로 실행됩니다.

```bash
npm run test:unit    # 가드/lock/allowlist 단위 테스트
npm test             # sandbox 과제 테스트만
```

## 환경 변수

| 키 | 기본값 | 설명 |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama 서버 주소 |
| `OLLAMA_MODEL` | `gemma2:9b` | 사용할 로컬 모델 |
| `OLLAMA_TEMPERATURE` | `0.7` | 0이면 거의 항상 같은 답을 내고, 1 이상이면 표현이 들쭉날쭉해질 수 있음. 채팅 플레이그라운드의 “말투 다양성”을 조절하는 스위치. OLLAMA_MODEL처럼 어떤 모델을 쓸지가 아니라, 같은 모델이어도 답변 스타일만 바꾸는 옵션. |

## 구조

```text
src/
  app/api/chat/route.ts     LangChain ChatOllama 스트리밍
  app/api/agent/run/route.ts  코드리뷰 Sequential Pipeline
  app/api/health/route.ts   Ollama 연결/모델 확인
  lib/ollama/               ChatOllama 팩토리, keep_alive 언로드
  lib/agent/                코드리뷰 파이프라인, 가드
  constants/ollama.ts       기본값, role map
  types/chat.ts             요청/헬스 타입
```

모델 호출은 서버 Route Handler에서만 수행합니다. 클라이언트에는 API 키나 Ollama 클라이언트를 두지 않습니다.
