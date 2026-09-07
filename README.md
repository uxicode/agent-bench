# AI Agent

Next.js App Router 보일러플레이트에 `@langchain/core`, `@langchain/ollama`를 붙인 로컬 개발 환경입니다.

## 사전 준비

1. [Ollama](https://ollama.com/)가 실행 중이어야 합니다.
2. 사용할 모델을 받아 둡니다.

```bash
ollama pull gemma2:9b
```

## 시작하기

```bash
cp .env.example .env.local
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 로컬 모델과 스트리밍 채팅을 확인할 수 있습니다.

## 환경 변수

| 키 | 기본값 | 설명 |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama 서버 주소 |
| `OLLAMA_MODEL` | `gemma2:9b` | 사용할 로컬 모델 |
| `OLLAMA_TEMPERATURE` | `0.7` | 생성 온도 |

## 구조

```text
src/
  app/api/chat/route.ts     LangChain ChatOllama 스트리밍
  app/api/health/route.ts   Ollama 연결/모델 확인
  lib/ollama/               ChatOllama 팩토리, 메시지 변환
  constants/ollama.ts       기본값, role map
  types/chat.ts             요청/헬스 타입
```

모델 호출은 서버 Route Handler에서만 수행합니다. 클라이언트에는 API 키나 Ollama 클라이언트를 두지 않습니다.
