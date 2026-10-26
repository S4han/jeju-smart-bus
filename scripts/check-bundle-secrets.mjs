// 빌드 산출물 비밀정보 점검 (TASK-004, NFR-003)
// dist/에 서버 전용 환경변수 이름이나, 설정되어 있다면 그 값이 들어 있으면 빌드를 실패시킨다.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// D-25로 버스 API 키는 쓰지 않지만, 다시 도입될 경우를 대비해 점검 대상으로 유지한다.
const SERVER_ENV_NAMES = ["JEJU_BUS_API_KEY"];

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const needles = SERVER_ENV_NAMES.flatMap((name) => {
  const value = process.env[name]?.trim();
  return value ? [name, value] : [name];
});

const leaks = listFiles("dist").filter((file) => {
  const content = readFileSync(file, "utf8");
  return needles.some((needle) => content.includes(needle));
});

if (leaks.length > 0) {
  console.error(`서버 전용 비밀정보가 빌드 산출물에 포함됨: ${leaks.join(", ")}`);
  process.exit(1);
}
console.log("check-bundle-secrets: dist에 서버 전용 비밀정보 없음");
