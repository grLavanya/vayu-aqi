import { RotateCw } from 'lucide-react';
import Sheet from './Sheet';
import type { Plan } from '@/lib/planService';
import { useIsDevMode } from '@/lib/searchParams';

interface ActionCardProps {
  title: string;
  why: string;
}

function ActionCard({ title, why }: ActionCardProps) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white/80 p-4 transition hover:shadow-md">
      <h4 className="text-[15px] font-semibold leading-snug">{title}</h4>
      <p className="mt-1.5 text-sm leading-relaxed opacity-70">{why}</p>
    </div>
  );
}

interface PlanBlockProps {
  heading: string;
  actions: Plan['morning'];
  isCurrent?: boolean;
}

function PlanBlock({ heading, actions, isCurrent = false }: PlanBlockProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl transition ${
        isCurrent
          ? 'border-2 border-[var(--mood-accent)]/40 bg-[var(--mood-accent)]/[0.03] p-3.5 shadow-sm sm:p-4'
          : 'p-1'
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide opacity-60">
          {heading}
        </h3>
        {isCurrent && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white"
            style={{ backgroundColor: 'var(--mood-accent)' }}
          >
            Right now
          </span>
        )}
      </div>
      {actions.map((action) => (
        <ActionCard key={action.title} title={action.title} why={action.why} />
      ))}
    </div>
  );
}

interface PlanSheetProps {
  plan: Plan | null;
  loading?: boolean;
  city?: string;
}

export default function PlanSheet({ plan, loading = false, city }: PlanSheetProps) {
  const isDev = useIsDevMode();

  const currentHour = new Date().getHours();
  let currentBlock: 'morning' | 'afternoon' | 'evening' = 'evening';
  if (currentHour >= 5 && currentHour < 12) currentBlock = 'morning';
  else if (currentHour >= 12 && currentHour < 17) currentBlock = 'afternoon';

  return (
    <Sheet className="p-6">
      <div className="mb-4">
        <h2 className="mb-1 text-xl font-bold tracking-tight">Today's plan</h2>
        {plan?.summary ? (
          <p className="text-sm font-medium leading-relaxed opacity-80">
            {plan.summary}
          </p>
        ) : (
          <p className="text-sm opacity-60">
            Gentle options for the day — take what fits, leave what doesn't.
          </p>
        )}
      </div>

      {/* Safety note for vulnerable groups */}
      {plan?.safetyNote && (
        <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.08] p-3.5 text-xs leading-relaxed text-amber-900">
          <span className="font-semibold">Gentle health note: </span>
          {plan.safetyNote}
        </div>
      )}

      {/* Standard guidance fallback notice */}
      {plan?.planSource === 'rules' && (
        <div className="mb-4 rounded-xl border border-black/[0.06] bg-black/[0.02] px-3.5 py-2 text-xs opacity-75">
          Standard guidance. The personalised plan is unavailable right now.
        </div>
      )}

      {/* Plan blocks or loading state */}
      <div aria-live="polite">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <RotateCw
              className="h-6 w-6 animate-spin opacity-50"
              style={{ color: 'var(--mood-accent)' }}
            />
            <p className="mt-3 text-sm font-medium opacity-75">
              Preparing your plan…
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-3">
            <PlanBlock
              heading="Morning"
              actions={plan?.morning ?? []}
              isCurrent={currentBlock === 'morning'}
            />
            <PlanBlock
              heading="Afternoon"
              actions={plan?.afternoon ?? []}
              isCurrent={currentBlock === 'afternoon'}
            />
            <PlanBlock
              heading="Evening"
              actions={plan?.evening ?? []}
              isCurrent={currentBlock === 'evening'}
            />
          </div>
        )}
      </div>

      {/* Caption & Dev info */}
      <div className="mt-6 flex flex-col gap-2 border-t border-black/[0.06] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs opacity-60">
          Plan for {city || 'your area'}, based on the latest reading.
        </p>

        {isDev && plan && (
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] opacity-75">
            <span className="rounded-md bg-black/[0.04] px-2 py-0.5">
              source: <strong className="font-semibold">{plan.planSource || 'rules'}</strong>
            </span>
            <span className="rounded-md bg-black/[0.04] px-2 py-0.5">
              model: {plan.model || 'none'}
            </span>
            <span className="rounded-md bg-black/[0.04] px-2 py-0.5">
              cache: <strong className="font-semibold">{plan.cacheHit ? 'hit' : 'miss'}</strong>
            </span>
          </div>
        )}
      </div>
    </Sheet>
  );
}
