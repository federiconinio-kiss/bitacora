import { requireUser } from '@/lib/auth';
import { numFood } from '@/lib/data';
import type { Food } from '@/lib/types';
import FoodCatalog from './FoodCatalog';

export default async function FoodsPage() {
  const { sb } = await requireUser('trainer');
  const { data } = await sb.from('foods').select('*').order('name');
  return <FoodCatalog initial={((data ?? []) as Food[]).map(numFood)} />;
}
