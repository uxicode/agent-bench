import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  isForbiddenAppPath,
  resolveRepoPath,
  resolveSandboxPath,
} from "@/lib/agent/guards";

describe("guards", () => {
  it("src/app 경로를 거부한다", () => {
    expect(isForbiddenAppPath("src/app/api/chat/route.ts")).toBe(true);
    expect(() =>
      resolveSandboxPath("parse-query", "src/app/api/chat/route.ts"),
    ).toThrow(/앱 소스/);
  });

  it("절대 경로를 거부한다", () => {
    expect(() =>
      resolveSandboxPath(
        "parse-query",
        path.join(process.cwd(), "src/app/api/chat/route.ts"),
      ),
    ).toThrow(/절대 경로/);
  });

  it("경로 탈출을 거부한다", () => {
    expect(() =>
      resolveSandboxPath("parse-query", "../../src/lib/ollama/client.ts"),
    ).toThrow();
  });

  it(".env 경로를 거부한다", () => {
    expect(() => resolveSandboxPath("parse-query", ".env.local")).toThrow(
      /\.env/,
    );
  });

  it("샌드박스 상대 구현 파일은 허용한다", () => {
    const resolved = resolveSandboxPath("parse-query", "src/parse-query.ts");
    expect(resolved.endsWith(path.join("sandbox", "tasks", "parse-query", "src", "parse-query.ts"))).toBe(true);
  });

  it("저장소 경로에서 node_modules와 .env를 거부한다", () => {
    expect(() => resolveRepoPath("node_modules/vitest/index.js")).toThrow();
    expect(() => resolveRepoPath(".env.local")).toThrow();
  });

  it("저장소 상대 소스 경로는 허용한다", () => {
    const resolved = resolveRepoPath("src/lib/agent/error-hash.ts");
    expect(resolved.endsWith(path.join("src", "lib", "agent", "error-hash.ts"))).toBe(true);
  });

  it("다른 프로젝트의 절대 경로는 허용한다", () => {
    const absPath = "/Users/me/other-project/src/utils.ts";
    expect(resolveRepoPath(absPath)).toBe(path.resolve(absPath));
  });

  it("시스템·차단 세그먼트 절대 경로는 거부한다", () => {
    expect(() => resolveRepoPath("/etc/passwd")).toThrow(/시스템/);
    expect(() =>
      resolveRepoPath("/Users/me/proj/node_modules/vitest/index.js"),
    ).toThrow(/허용되지 않습니다/);
  });
});
