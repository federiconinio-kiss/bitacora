import { requireUser } from '@/lib/auth';
import { getActiveDiet, numFood } from '@/lib/data';
import { DISCLAIMER } from '@/lib/diet';
import type { DietCheckin, Food, FoodLog } from '@/lib/types';
import { isoWeekday, todayISO } from '@/lib/utils';
import DietView from './DietView';
import FoodDiary from './FoodDiary';
import DietTabs from './DietTabs';

export default async function StudentDietPage({ searchParams }: { searchParams: Promise<{ fecha?: string; ver?: string }> }) {
  const { fecha, ver } = await searchParams;
  const { sb, me } = await requireUser('student');
  const date = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha <= todayISO() ? fecha : todayISO();
  const [plan, { data: logs }, { data: checkin }, { data: foods }] = await Promise.all([
    getActiveDiet(sb, me.id),
    sb.from('food_logs').select('*').eq('student_id', me.id).eq('logged_on', date).order('logged_at', { nullsFirst: false }).order('created_at'),
    sb.from('diet_checkins').select('*').eq('student_id', me.id).eq('day', date).maybeSingle(),
    sb.from('foods').select('*').order('name'),
  ]);
  const hasPlan = !!plan && plan.days.length > 0;
  const tab = ver === 'plan' && hasPlan ? 'plan' : 'diario';

  return (
    <div className="stack-lg">
      <h1 className="h-hand">Mi dieta</h1>
      <DietTabs tab={tab} hasPlan={hasPlan} />
      {tab === 'plan' && plan ? (
        <DietView plan={plan} todayWeekday={isoWeekday(todayISO())} disclaimer={DISCLAIMER} />
      ) : (
        <FoodDiary
          key={date}
          studentId={me.id}
          date={date}
          plan={hasPlan ? plan : null}
          initialLogs={(logs ?? []) as FoodLog[]}
          initialCheckin={(checkin as DietCheckin | null) ?? null}
          foods={((foods ?? []) as Food[]).map(numFood)}
        />
      )}
      {hasPlan && tab === 'diario' && <p className="disclaimer">⚕ {DISCLAIMER}</p>}
    </div>
  );
}
