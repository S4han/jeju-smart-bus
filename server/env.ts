// 서버 전용 환경변수 (TASK-004, NFR-003)
// VITE_ 접두사를 쓰지 않는다 — 클라이언트 번들에 포함되지 않아야 한다.

declare const process: { env: Record<string, string | undefined> };

export const SERVER_ENV_NAMES = ["JEJU_BUS_API_KEY"] as const;

export interface ServerEnv {
  jejuBusApiKey: string | undefined;
  // Vercel 시스템 환경변수: "production" | "preview" | "development"
  vercelEnv: string | undefined;
}

export function readServerEnv(): ServerEnv {
  const key = process.env.JEJU_BUS_API_KEY?.trim();
  return { jejuBusApiKey: key ? key : undefined, vercelEnv: process.env.VERCEL_ENV };
}
