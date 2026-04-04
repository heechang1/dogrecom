/**
 * 원료 추출 테스트 — 실행: npx tsx scripts/test-extract-ingredients.ts
 */
import {
  cleanText,
  extractIngredients,
  tokenize,
} from "../lib/extract-ingredients-ocr";

const SAMPLE = `*사용한 원료의 명칭 :닭고기,완두콩,곡류(콘그릿츠|,콘글루텐,아마인, 비트식이섬유,제이인산칼습, 닭간,소기름,
타피오카전분, 카놀라유,치킨윙팁,맥주효모,코코넷,염회칼륨,강황, 탄산칼숨,생선기름, 글루코사민, Ｌ-티로신, 레시틴,
블루베리, 아사이베리, 마키베리,Ｌ카르니틴, [-메티오닌, Ｌ라이신, 타우린, 염화콜린, DUSTRY, 비타민제합제,
정제소금,로즈마리추출물,녹차추출물,토코페롤,효모추출물
※ 위 사용원료는 공장사정에 따라 배합비율이 WATS 있음`;

const EXPECTED = [
  "닭고기",
  "완두콩",
  "곡류",
  "비트식이섬유",
  "닭간",
  "소기름",
  "타피오카전분",
  "카놀라유",
  "맥주효모",
  "강황",
];

console.log("=== cleanText ===");
const c = cleanText(SAMPLE);
console.log(c.slice(0, 200) + "...\n");

console.log("=== tokenize (처음 25개) ===");
console.log(tokenize(c).slice(0, 25));

console.log("\n=== extractIngredients ===");
const result = extractIngredients(SAMPLE);
console.log(JSON.stringify(result, null, 2));

console.log("\n=== 기대값 ===");
console.log(JSON.stringify(EXPECTED, null, 2));

const ok =
  result.length === EXPECTED.length &&
  EXPECTED.every((v, i) => result[i] === v);
console.log("\n=== 일치 여부 ===", ok ? "PASS" : "FAIL (순서·항목 확인)");
