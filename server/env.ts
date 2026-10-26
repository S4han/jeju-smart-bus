// 서버 환경변수 (TASK-004, NFR-003)
// 버스 API는 키 없이 호출한다(D-25). 서버 전용 비밀이 생기면 VITE_ 접두사 없이 여기에서만 읽는다.

declare const process: { env: Record<string, string | undefined> };

export interface ServerEnv {
  // Vercel 시스템 환경변수: "production" | "preview" | "development"
  vercelEnv: string | undefined;
}

export function readServerEnv(): ServerEnv {
  return { vercelEnv: process.env.VERCEL_ENV };
}
