// 비밀값 마스킹 (TASK-004, NFR-003, AGENTS.md 규칙 7)
// 외부 API URL·오류 메시지를 기록하거나 보고서에 남기기 전에 반드시 거친다.

const MASK = "***";
const KEY_PARAM = /([?&](?:servicekey|apikey|api_key|key|client_secret|clientsecret)=)[^&#\s]*/gi;

export function maskSecrets(text: string, secrets: ReadonlyArray<string | undefined>): string {
  let masked = text;
  for (const secret of secrets) {
    if (!secret) continue;
    for (const form of new Set([secret, encodeURIComponent(secret)])) {
      masked = masked.split(form).join(MASK);
    }
  }
  return masked.replace(KEY_PARAM, `$1${MASK}`);
}
