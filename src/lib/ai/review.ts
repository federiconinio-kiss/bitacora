import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod/v4';
import type { FullRoutine, Measurement } from '@/lib/types';
import { DAYS } from '@/lib/utils';

export type Methodology = 'evidencia' | 'piramide' | 'heavy_duty' | 'ambas';
export type Level = 'principiante' | 'intermedio' | 'avanzado';

export const METHODOLOGIES: Record<Methodology, string> = {
  evidencia: 'Evidencia científica actual y práctica aceptada',
  piramide: 'The Muscle & Strength Pyramid (Training)',
  heavy_duty: 'Heavy Duty (alta intensidad)',
  ambas: 'Comparar Pirámide y Heavy Duty',
};

// ---------------------------------------------------------------------------
// Formato de la respuesta (structured outputs: la IA devuelve exactamente esto)
// ---------------------------------------------------------------------------
const Veredicto = z.object({
  veredicto: z.enum(['adecuada', 'mejorable', 'no adecuada']),
  explicacion: z.string(),
});

export const ReviewSchema = z.object({
  resumen: z.string(),
  puntaje: z.number().int(),
  nivel: Veredicto,
  objetivo: Veredicto,
  volumen_por_grupo: z.array(
    z.object({
      grupo: z.string(),
      series_semanales: z.number(),
      frecuencia_semanal: z.number(),
      evaluacion: z.enum(['bajo', 'adecuado', 'alto']),
      comentario: z.string(),
    }),
  ),
  sugerencias: z.array(
    z.object({
      prioridad: z.enum(['alta', 'media', 'baja']),
      categoria: z.enum(['volumen', 'frecuencia', 'intensidad', 'seleccion de ejercicios', 'orden', 'progresion', 'descanso', 'otro']),
      dia: z.string().nullable(),
      ejercicio: z.string().nullable(),
      cambio: z.string(),
      motivo: z.string(),
    }),
  ),
  puntos_fuertes: z.array(z.string()),
});
export type Review = z.infer<typeof ReviewSchema>;

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
const SYSTEM = `Sos un entrenador y preparador físico con mucha experiencia en hipertrofia y fuerza. Revisás rutinas que arma otro profe (Fede) para sus alumnos de gimnasio, antes de que las publique. Tu trabajo es darle una segunda mirada útil y concreta, como un colega que sabe: qué está bien, qué cambiarías y por qué.

Escribí en español rioplatense, con voseo, claro y directo, sin vueltas. Fede es profe: podés usar términos técnicos (RIR, volumen, frecuencia, fallo), pero cada sugerencia tiene que ser accionable en la rutina tal como está armada: nombrá el día y el ejercicio cuando corresponda, y decí el cambio concreto (por ejemplo "bajar de 4 a 3 series", "pasar las laterales al principio del día", "sumar un ejercicio de bisagra de cadera"). No inventes ejercicios que no existen y preferí reemplazos comunes en un gimnasio.

Evaluá según el marco que te pida Fede:

MARCO "The Muscle & Strength Pyramid (Training)" (Eric Helms y colaboradores). Ideas centrales, en orden de importancia:
1. Adherencia: la rutina tiene que ser realista para el alumno (tiempo, días, gusto) y sostenible.
2. Volumen, intensidad y frecuencia: es lo que más pesa. Para hipertrofia, series efectivas semanales por grupo muscular: como referencia general, unas 10–20 en intermedios, menos para principiantes (con 6–12 suele alcanzar) y algo más para avanzados en grupos prioritarios. Cada grupo idealmente al menos 2 veces por semana. Rangos de repeticiones variados (aprox. 6–15 en la mayoría, algo más en aislamientos), con la mayoría de las series a 1–3 repeticiones de reserva (RIR), compuestos más lejos del fallo y aislamientos más cerca.
3. Progresión: sobrecarga progresiva planificada (por ejemplo, doble progresión), más simple en principiantes y más estructurada (periodización, descargas) en avanzados.
4. Selección de ejercicios: cubrir todos los patrones y grupos, con rangos de movimiento completos, y priorizar lo que el objetivo pide.
5. Descansos: suficientes para rendir (2–3 min en compuestos, 1–2 min en aislamientos).
6. Tempo: lo que menos importa; controlar la fase excéntrica.

MARCO "Heavy Duty" (Mike Mentzer, entrenamiento de alta intensidad). Ideas centrales:
- Intensidad máxima: cada serie efectiva llevada al fallo muscular real (y a veces más allá con repeticiones forzadas, negativas o rest-pause), con muy buena técnica.
- Volumen muy bajo: 1–2 series efectivas por ejercicio después de la entrada en calor, pocos ejercicios por grupo.
- Frecuencia baja y mucha recuperación: sesiones cortas y días de descanso entre entrenamientos; se entrena de nuevo cuando hay recuperación completa.
- Pre-agotamiento: un aislamiento seguido inmediatamente de un compuesto para el mismo músculo.
- Progresión: subir carga o repeticiones en cada sesión; si no se progresa, la respuesta es más descanso, no más volumen.
- Reps controladas y tempo lento.

MARCO "Evidencia científica actual y práctica aceptada". No sigas a un autor: usá el consenso de la investigación en hipertrofia y fuerza (metaanálisis y revisiones de los últimos años) y lo que la práctica de entrenadores con experiencia da por bueno. Ideas centrales:
- Volumen: la relación dosis-respuesta es la variable más fuerte. Como referencia, unas 10–20 series efectivas semanales por grupo muscular; menos de ~10 suele quedarse corto para un intermedio y más de ~20 rinde poco o compromete la recuperación, salvo en grupos prioritarios de avanzados. Contá los músculos sinérgicos con criterio (por ejemplo, el press trabaja tríceps y deltoides anterior), sin igualarlos a un ejercicio directo.
- Frecuencia: con el mismo volumen semanal, la frecuencia importa poco, pero repartir cada grupo en 2 o más sesiones ayuda a sostener la calidad de las series y a manejar volúmenes altos.
- Cercanía al fallo: la mayoría de las series entre 0 y 3 repeticiones en reserva. Ir al fallo en aislamientos y máquinas es razonable; en compuestos pesados conviene dejar 1–3 en reserva por fatiga y riesgo.
- Cargas y repeticiones: la hipertrofia es similar en un rango amplio (aprox. 5–30 repeticiones) si las series se llevan cerca del fallo. Para fuerza máxima hacen falta cargas pesadas (aprox. 1–6 repeticiones) en los ejercicios donde se quiere ser fuerte.
- Selección y técnica: rangos de movimiento completos; hay evidencia creciente de que enfatizar la posición de estiramiento del músculo (por ejemplo, curl inclinado, extensión de tríceps sobre la cabeza, sentadilla profunda, curl femoral sentado) favorece la hipertrofia. Cubrir todos los patrones (empuje y tracción horizontal y vertical, sentadilla, bisagra de cadera, unilaterales) y equilibrar empuje y tracción.
- Descansos: unos 2–3 minutos en compuestos y 1–2 minutos en aislamientos; descansar muy poco reduce el volumen efectivo.
- Progresión y gestión de la fatiga: sobrecarga progresiva medible (por ejemplo, doble progresión), descargas cuando caen el rendimiento o la recuperación, y priorizar al principio de la sesión lo más importante para el objetivo.
- Práctica aceptada: entrada en calor específica, compuestos antes que aislamientos, sesiones de duración realista (aprox. 45–90 minutos), adherencia y preferencias del alumno, y adaptar los ejercicios ante lesiones o molestias.
- Si una recomendación tiene evidencia débil o discutida, decilo ("la evidencia es limitada", "es una práctica habitual") en vez de presentarla como un hecho.

Si Fede pide comparar Pirámide y Heavy Duty, evaluá la rutina con los dos, mostrá dónde coinciden y dónde no, y en las sugerencias aclará a qué marco responde cada una (por ejemplo, empezando el motivo con "Pirámide:" o "Heavy Duty:").

NIVEL DEL ALUMNO. Ajustá todo al nivel:
- Principiante (menos de ~1 año entrenando de forma consistente): aprende técnica, progresa sesión a sesión con poco volumen, ejercicios simples y estables (máquinas y básicos), lejos del fallo en compuestos. El fallo y las técnicas de intensidad no son prioridad; si el marco es Heavy Duty, adaptalo con prudencia.
- Intermedio (~1–3 años): necesita más volumen y una progresión más planificada, puede llevar aislamientos cerca del fallo.
- Avanzado (3+ años, cerca de su potencial): volumen más alto en grupos prioritarios, especialización, periodización y descargas planificadas, técnicas de intensidad con criterio.

Usá el resumen de series semanales y frecuencia por grupo muscular que te paso: ya está calculado, no lo recuentes. Si falta el nivel o el objetivo, decilo y evaluá con lo que hay.

Respondé con el formato pedido:
- resumen: 2 a 4 oraciones con tu opinión general.
- puntaje: de 1 a 10, qué tan bien está la rutina para este alumno, este objetivo y este marco.
- nivel: si la rutina se adecua al nivel del alumno.
- objetivo: si la rutina apunta al objetivo.
- volumen_por_grupo: una fila por cada grupo muscular del resumen, con tu evaluación (bajo, adecuado o alto según el marco y el nivel) y un comentario corto.
- sugerencias: entre 3 y 8, ordenadas de más a menos importante. Si la rutina está muy bien, pueden ser menos. "dia" y "ejercicio" van en null cuando la sugerencia es general.
- puntos_fuertes: lo que está bien y conviene mantener (2 a 4 ítems).`;

function fmtRest(s: number | null) {
  if (s == null) return 'sin indicar';
  return s >= 60 ? `${+(s / 60).toFixed(1)} min` : `${s} s`;
}

/** Series semanales y frecuencia por grupo muscular (sólo ejercicios principales). */
export function weeklyVolume(r: FullRoutine) {
  const map = new Map<string, { sets: number; days: Set<string> }>();
  for (const d of r.days) {
    for (const e of d.exercises) {
      const g = e.exercise.muscle_group;
      const cur = map.get(g) ?? { sets: 0, days: new Set<string>() };
      cur.sets += e.sets;
      cur.days.add(d.id);
      map.set(g, cur);
    }
  }
  return [...map.entries()]
    .map(([grupo, v]) => ({ grupo, series: v.sets, frecuencia: v.days.size }))
    .sort((a, b) => b.series - a.series);
}

export function describeRoutine(r: FullRoutine) {
  const lines: string[] = [];
  lines.push(`Rutina: "${r.name}" — ${r.days.length} días por semana.`);
  if (r.notes) lines.push(`Indicaciones generales del profe: ${r.notes}`);
  r.days.forEach((d, i) => {
    lines.push('');
    lines.push(`Día ${i + 1}: ${d.title}${d.day_of_week ? ` (${DAYS[d.day_of_week - 1]})` : ''}`);
    if (!d.exercises.length) lines.push('  (sin ejercicios)');
    d.exercises.forEach((e, j) => {
      const load = e.target_weight != null ? `${e.target_weight} kg${e.target_source === 'student' ? ' (elegida por el alumno)' : ''}` : 'sin carga pautada (la elige el alumno)';
      const alts = e.alternatives.length ? ` | reemplazos posibles: ${e.alternatives.map((a) => a.name).join(', ')}` : '';
      const notes = e.notes ? ` | nota: ${e.notes}` : '';
      lines.push(`  ${j + 1}. ${e.exercise.name} [${e.exercise.muscle_group}, ${e.exercise.equipment || 'sin dato'}] — ${e.sets} series × ${e.rep_min}–${e.rep_max} reps, carga: ${load}, pausa: ${fmtRest(e.rest_seconds)}${alts}${notes}`);
    });
  });
  return lines.join('\n');
}

export function buildPrompt(input: {
  routine: FullRoutine;
  methodology: Methodology;
  level: Level | null;
  trainerNotes: string;
  age: number | null;
  lastMeasurement: Measurement | null;
}) {
  const { routine, methodology, level, trainerNotes, age, lastMeasurement: m } = input;
  const vol = weeklyVolume(routine)
    .map((v) => `- ${v.grupo}: ${v.series} series por semana, en ${v.frecuencia} ${v.frecuencia === 1 ? 'día' : 'días'}`)
    .join('\n');
  const body = [
    m?.weight != null ? `peso ${m.weight} kg` : null,
    m?.waist != null ? `cintura ${m.waist} cm` : null,
    m?.body_fat != null ? `${m.body_fat}% de grasa` : null,
  ].filter(Boolean).join(', ');

  return `Marco a usar: ${METHODOLOGIES[methodology]}

ALUMNO
- Nivel: ${level ?? 'no indicado'}
- Edad: ${age ?? 'no indicada'}
- Última medición: ${body || 'sin mediciones'}
- Notas privadas del profe: ${trainerNotes.trim() || 'ninguna'}

OBJETIVO DE LA RUTINA
${routine.goal.trim() || 'No indicado.'}

RESUMEN CALCULADO (series semanales y frecuencia por grupo muscular, sólo ejercicios pautados)
${vol || '- Sin ejercicios.'}

RUTINA COMPLETA
${describeRoutine(routine)}`;
}

// ---------------------------------------------------------------------------
// Llamada a Claude
// ---------------------------------------------------------------------------
export class ReviewError extends Error {}

export async function reviewRoutine(prompt: string): Promise<Review> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ReviewError('Falta configurar ANTHROPIC_API_KEY en Vercel para usar la revisión con IA.');
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY.trim(), timeout: 280_000, maxRetries: 1 });
  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Si el modelo declina por error, la API reintenta con otro modelo en el mismo pedido.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: betaZodOutputFormat(ReviewSchema) },
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'refusal') throw new ReviewError('La IA no pudo revisar esta rutina. Probá de nuevo.');
    if (response.stop_reason === 'max_tokens') throw new ReviewError('La revisión salió demasiado larga. Probá de nuevo.');
    if (!response.parsed_output) throw new ReviewError('La IA devolvió una respuesta incompleta. Probá de nuevo.');
    return response.parsed_output;
  } catch (e) {
    if (e instanceof ReviewError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new ReviewError('La clave de la IA (ANTHROPIC_API_KEY) no es válida. Revisala en Vercel.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new ReviewError('La cuenta de la IA no tiene permiso o crédito. Revisá la facturación en console.anthropic.com.');
    if (e instanceof Anthropic.RateLimitError) throw new ReviewError('Se alcanzó el límite de uso de la IA. Esperá un minuto y probá de nuevo.');
    if (e instanceof Anthropic.BadRequestError && /credit|balance/i.test(e.message)) throw new ReviewError('La cuenta de la IA no tiene crédito. Cargá saldo en console.anthropic.com.');
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new ReviewError('La IA tardó demasiado en responder. Probá de nuevo.');
    if (e instanceof Anthropic.APIError) throw new ReviewError(`Error de la IA (${e.status ?? 'sin código'}). Probá de nuevo en un rato.`);
    throw e;
  }
}

// El tipo inferido del esquema tiene que coincidir con el que usa el cliente.
type _Check = Review extends import('./review-types').Review ? (import('./review-types').Review extends Review ? true : never) : never;
const _ok: _Check = true;
void _ok;
