import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const nextDir = path.join(root, ".next");

if (!fs.existsSync(nextDir)) {
  console.log("[clean-next] .next 폴더가 없습니다. 건너뜁니다.");
  process.exit(0);
}

try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log("[clean-next] .next 삭제 완료.");
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[clean-next] 삭제 실패:", msg);
  console.error(
    "→ Node를 모두 종료한 뒤(Cursor 터미널 Ctrl+C, 필요 시 작업 관리자에서 node.exe 종료) 다시 실행하세요."
  );
  process.exit(1);
}
