import { TrainerNav } from '@/components/Nav';
import { requireUser } from '@/lib/auth';

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const { sb } = await requireUser('trainer');
  const [{ count }, { count: checkins }, { data: wsess }] = await Promise.all([
    sb.from('progression_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('diet_checkins').select('id', { count: 'exact', head: true }).is('trainer_seen_at', null),
    sb.from('workout_sessions').select('total_sets,done_sets,skipped_sets').is('trainer_seen_at', null).not('ended_at', 'is', null).limit(100),
  ]);
  const incompletas = (wsess ?? []).filter((w) => w.skipped_sets > 0 || w.done_sets + w.skipped_sets < w.total_sets).length;
  return (
    <>
      <TrainerNav pending={(count ?? 0) + (checkins ?? 0) + incompletas} />
      <main className="shell wide">{children}</main>
    </>
  );
}
