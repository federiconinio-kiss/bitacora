// Genera supabase/seed_exercises.sql a partir de scripts/exercises.mjs
import { writeFileSync } from 'node:fs';
import { EXERCISES } from './exercises.mjs';

const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const rows = EXERCISES.map(([n, g, e, c]) => `  (${q(n)}, ${q(g)}, ${q(e)}, ${q(c)})`).join(',\n');
const sql = `-- Catálogo base de ejercicios (${EXERCISES.length}). Generado por scripts/build-seed.mjs
insert into public.exercises (name, muscle_group, equipment, cues) values
${rows}
on conflict (name) do nothing;
`;
writeFileSync(new URL('../supabase/seed_exercises.sql', import.meta.url), sql);
console.log(`seed_exercises.sql: ${EXERCISES.length} ejercicios`);
