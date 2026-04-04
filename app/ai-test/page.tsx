import { AiTestPanel } from "@/components/ai-test-panel";

export default function AiTestPage() {
  return (
    <main className="app p-4">
      <h1 className="text-xl font-bold mb-2">OpenAI 연동 테스트</h1>
      <p className="text-sm text-gray-600 mb-4">
        <code>/api/ai-test</code> POST · DB 추천에는 AI 추천 이유와 👍👎 피드백(
        <code>/api/feedback</code>)이 붙습니다.
      </p>
      <AiTestPanel />
    </main>
  );
}
