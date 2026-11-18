import { requireUser } from '@/lib/auth';
import { getActiveRoutine } from '@/lib/data';
import type { Measurement, SetLog } from '@/lib/types';
import HistoryTabs from '@/components/HistoryTabs';

export default async function StudentHistory() {
  const { sb, me } = await requireUser('student');
  const routine = await getActiveRoutine(sb, me.id);
  const [{ data: logs }, { data: meas }] = await Promise.all([
    sb.from('set_logs').select('*').eq('student_id', me.id).order('performed_on').limit(5000),
    sb.from('measurements').select('*').eq('student_id', me.id).order('measured_on'),
  ]);
  return (
    <div className="stack-lg">
      <h1 className="h-hand">Mi historial</h1>
      <HistoryTabs routine={routine} logs={(logs ?? []) as SetLog[]} measurements={(meas ?? []) as Measurement[]} />
    </div>
  );
}
