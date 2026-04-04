import type { ReactNode } from "react";
import { FlowShell } from "@/components/flow/flow-shell";

export default function FlowLayout({ children }: { children: ReactNode }) {
  return <FlowShell>{children}</FlowShell>;
}
