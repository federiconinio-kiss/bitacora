import { requireUser } from '@/lib/auth';
import { getActiveDiet } from '@/lib/data';
import { DISCLAIMER } from '@/lib/diet';
import { isoWeekday, todayISO } from '@/lib/utils';
import DietView from './DietView';

export default async function StudentDietPage() {
  const { sb, me } = await requireUser('student');
  const plan = await getActiveDiet(sb, me.id);
  if (!plan || !plan.days.length)
    return (
      <div className="stack-lg">
        <h1 className="h-hand">Mi dieta</h1>
        <div className="sheet empty">
          <span className="tape" />
          <p className="ink">Tu profe todavía no cargó un plan de alimentación.</p>
          <p className="muted">Cuando lo publique lo vas a ver acá, con tus calorías y macros del día.</p>
        </div>
      </div>
    );
  return <DietView plan={plan} todayWeekday={isoWeekday(todayISO())} disclaimer={DISCLAIMER} />;
}
