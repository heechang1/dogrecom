/**
 * parseFoodText 테스트 — 실행: npx tsx scripts/test-parse-food-text.ts
 */
import { parseFoodText } from "../lib/food-text-parse";

const SAMPLE = `
무라벨 소형견 사료(연어)
조 단백질 28.5 %  조지방 14.0%  조회분 6%  수분 9.5 %
원재료: 연어, 닭고기, 쌀, 옥수수전분, 어유
기타 정보...
`;

console.log("=== raw OCR sample ===");
console.log(SAMPLE);

console.log("\n=== parseFoodText output ===");
const parsed = parseFoodText(SAMPLE);
console.log(JSON.stringify(parsed, null, 2));

