import { TrainerNav } from '@/components/Nav';
import { requireUser } from '@/lib/auth';

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const { sb } = await requireUser('trainer');
  const { count } = await sb.from('progression_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending');
  return (
    <>
      <TrainerNav pending={count ?? 0} />
      <main className="shell wide">{children}</main>
    </>
  );
}
