import { ReactNode } from 'react';
import './csf-shop.css';

export default function CSFSizingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[#050505] text-white">
      {children}
    </div>
  );
}
