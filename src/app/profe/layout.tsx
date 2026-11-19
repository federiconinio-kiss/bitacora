import { TrainerNav } from '@/components/Nav';
import { requireUser } from '@/lib/auth';

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const { sb } = await requireUser('trainer');
  const [{ count }, { count: checkins }] = await Promise.all([
    sb.from('progression_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('diet_checkins').select('id', { count: 'exact', head: true }).is('trainer_seen_at', null),
  ]);
  return (
    <>
      <TrainerNav pending={(count ?? 0) + (checkins ?? 0)} />
      <main className="shell wide">{children}</main>
    </>
  );
}
