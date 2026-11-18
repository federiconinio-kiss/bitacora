import { requireUser } from '@/lib/auth';
import type { Exercise } from '@/lib/types';
import Catalog from './Catalog';

export default async function ExercisesPage() {
  const { sb } = await requireUser('trainer');
  const { data } = await sb.from('exercises').select('*').order('name');
  return <Catalog initial={(data ?? []) as Exercise[]} />;
}
