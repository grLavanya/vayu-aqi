import Sheet from './Sheet';
import { Home, Leaf } from 'lucide-react';
import type { Plan } from '@/lib/planService';

interface InfoSectionsProps {
  plan: Plan | null;
}

export default function InfoSections({ plan }: InfoSectionsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Sheet className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Home aria-hidden="true" className="h-5 w-5" style={{ color: 'var(--mood-accent)' }} />
          <h2 className="text-xl font-bold tracking-tight">Indoor air</h2>
        </div>
        <ul className="flex flex-col gap-3">
          {(plan?.indoor ?? []).map((tip) => (
            <li key={tip.title} className="rounded-xl border border-black/[0.06] bg-white/80 p-4">
              <h3 className="text-[15px] font-semibold leading-snug">{tip.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed opacity-70">{tip.why}</p>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Leaf aria-hidden="true" className="h-5 w-5" style={{ color: 'var(--mood-accent)' }} />
          <h2 className="text-xl font-bold tracking-tight">Greener swaps</h2>
        </div>
        <ul className="flex flex-col gap-3">
          {(plan?.swaps ?? []).map((swap) => (
            <li key={swap.title} className="rounded-xl border border-black/[0.06] bg-white/80 p-4">
              <h3 className="text-[15px] font-semibold leading-snug">{swap.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed opacity-70">{swap.impact}</p>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
