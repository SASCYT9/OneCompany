import { ReactNode } from "react";

export default function CSFSizingLayout({ children }: { children: ReactNode }) {
  return <div className="dark relative min-h-screen bg-[#050505] text-white">{children}</div>;
}
