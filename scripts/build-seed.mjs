// Genera los catálogos base: supabase/seed_exercises.sql y supabase/seed_foods.sql
import { writeFileSync } from 'node:fs';
import { EXERCISES } from './exercises.mjs';
import { FOODS } from './foods.mjs';

const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const n = (v) => (v == null ? 'null' : String(v));

const ex = EXERCISES.map(([name, g, e, c]) => `  (${q(name)}, ${q(g)}, ${q(e)}, ${q(c)})`).join(',\n');
writeFileSync(new URL('../supabase/seed_exercises.sql', import.meta.url), `-- Catálogo base de ejercicios (${EXERCISES.length}). Generado por scripts/build-seed.mjs
insert into public.exercises (name, muscle_group, equipment, cues) values
${ex}
on conflict (name) do nothing;
`);

// Control: las kcal declaradas tienen que ser coherentes con los macros (4/4/9), salvo bebidas alcohólicas.
const off = FOODS.filter(([name, cat, kcal, p, c, f]) => {
  const calc = p * 4 + c * 4 + f * 9;
  return !/Cerveza|Vino/.test(name) && Math.abs(calc - kcal) > Math.max(25, kcal * 0.15);
});
if (off.length) {
  console.error('Revisar kcal vs macros:', off.map((f) => `${f[0]} (${f[2]} vs ${f[3] * 4 + f[4] * 4 + f[5] * 9})`).join('; '));
  process.exit(1);
}
const names = new Set();
for (const f of FOODS) { if (names.has(f[0])) { console.error('Duplicado:', f[0]); process.exit(1); } names.add(f[0]); }

const fo = FOODS.map(([name, cat, kcal, p, c, f, un, ug]) => `  (${q(name)}, ${q(cat)}, ${n(kcal)}, ${n(p)}, ${n(c)}, ${n(f)}, ${q(un)}, ${n(ug)})`).join(',\n');
writeFileSync(new URL('../supabase/seed_foods.sql', import.meta.url), `-- Base de alimentos (${FOODS.length}), valores cada 100 g. Generado por scripts/build-seed.mjs
insert into public.foods (name, category, kcal, protein, carbs, fat, unit_name, unit_grams) values
${fo}
on conflict (name) do nothing;
`);
console.log(`seed_exercises.sql: ${EXERCISES.length} · seed_foods.sql: ${FOODS.length}`);
