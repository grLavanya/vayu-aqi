import Sheet from './Sheet';
import type { Plan } from '@/lib/planService';

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
}

function PlanBlock({ heading, actions }: PlanBlockProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide opacity-60">{heading}</h3>
      {actions.map((action) => (
        <ActionCard key={action.title} title={action.title} why={action.why} />
      ))}
    </div>
  );
}

interface PlanSheetProps {
  plan: Plan | null;
}

export default function PlanSheet({ plan }: PlanSheetProps) {
  return (
    <Sheet className="p-6">
      <h2 className="mb-1 text-xl font-bold tracking-tight">Today's plan</h2>
      <p className="mb-5 text-sm opacity-60">
        Gentle options for the day — take what fits, leave what doesn't.
      </p>
      <div aria-live="polite" className="grid gap-6 sm:grid-cols-3">
        <PlanBlock heading="Morning" actions={plan?.morning ?? []} />
        <PlanBlock heading="Afternoon" actions={plan?.afternoon ?? []} />
        <PlanBlock heading="Evening" actions={plan?.evening ?? []} />
      </div>
    </Sheet>
  );
}
