import { Suspense } from "react";
import { FeedRecordClient } from "@/components/feed-record-client";

export default function FeedPage() {
  return (
    <Suspense fallback={<FeedPageFallback />}>
      <FeedRecordClient />
    </Suspense>
  );
}

function FeedPageFallback() {
  return (
    <div className="feed-page min-h-screen flex items-center justify-center p-4">
      <p className="text-gray-600 text-sm">불러오는 중…</p>
    </div>
  );
}
