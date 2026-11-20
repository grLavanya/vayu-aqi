import type { ReactNode } from 'react';

interface SheetProps {
  children: ReactNode;
  className?: string;
}

export default function Sheet({ children, className = '' }: SheetProps) {
  return (
    <section
      className={`rounded-2xl bg-white/70 shadow-[0_8px_30px_rgba(23,51,47,0.08)] ring-1 ring-black/[0.04] backdrop-blur-sm transition-colors duration-[600ms] ${className}`}
    >
      {children}
    </section>
  );
}
