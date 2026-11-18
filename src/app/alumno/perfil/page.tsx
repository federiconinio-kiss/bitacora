import { requireUser } from '@/lib/auth';
import type { Measurement } from '@/lib/types';
import ProfileForm from './ProfileForm';
import MeasurementForm from './MeasurementForm';

export default async function ProfilePage() {
  const { sb, me } = await requireUser('student');
  const { data } = await sb.from('measurements').select('*').eq('student_id', me.id).order('measured_on', { ascending: false }).limit(10);
  return (
    <div className="stack-lg">
      <h1 className="h-hand">Mi perfil</h1>
      <ProfileForm me={me} />
      <MeasurementForm studentId={me.id} recent={(data ?? []) as Measurement[]} />
    </div>
  );
}
