import 'server-only';
import { z } from 'zod/v4';
import { TEMPLATES, templatesForPrompt } from '@/lib/templates';
import { GUIDE_STRATEGY } from './guide';
import { parseWithClaude } from './claude';
import type { Suggestion } from './suggest-types';

const IDS = TEMPLATES.map((t) => t.id) as [string, ...string[]];

export const SuggestionSchema = z.object({
  plantilla: z.enum(IDS),
  alternativa: z.enum(IDS).nullable(),
  semanas: z.number().int(),
  motivo: z.string(),
  ajustes: z.array(z.string()),
  cuando_cambiar: z.string(),
  alerta: z.string().nullable(),
});

const SYSTEM = `Sos el asistente de Fede, entrenador personal. Fede arma las rutinas de sus alumnos con su propia guía de hipertrofia y te pide que le sugieras qué bloque (qué plantilla de su guía) le conviene a un alumno ahora, siguiendo su estrategia para combinar métodos. Vos sugerís; la decisión es de Fede.

Escribí en español rioplatense, con voseo, claro y directo. Fede es profe: usá términos técnicos sin explicarlos. No uses el nombre del alumno.

${GUIDE_STRATEGY}

PLANTILLAS DISPONIBLES (elegí solo entre estos id)
${templatesForPrompt()}

CÓMO DECIDIR
- Primero el nivel real según cómo viene progresando (los datos de progreso pesan más que el nivel cargado; si no coinciden, decilo en "alerta").
- Después los días disponibles: no sugieras una plantilla con más días de los que el alumno puede ir. Si no hay dato de días, usá los de la rutina actual.
- Después la situación (objetivo, poco tiempo, aburrimiento, estancamiento, molestias, vuelta de un parón) y la rotación: cuánto lleva con el método actual, si toca descarga, si toca alternar volumen e intensidad, y si hace mucho que no hace el método base.
- Si la adherencia viene baja (menos del 75% de las sesiones), priorizá una plantilla que pueda sostener.
- Si todavía no hay datos de entrenamiento, elegí por nivel, días y objetivo, y decilo.
- Si lo que corresponde ahora es una semana de descarga antes de cambiar, decilo en "alerta" y sugerí igual el bloque siguiente.

FORMATO
- plantilla: el id de la plantilla recomendada.
- alternativa: otro id razonable (por ejemplo, si puede ir otra cantidad de días), o null.
- semanas: duración recomendada del bloque.
- motivo: 2 a 4 oraciones que justifiquen la elección con los datos del alumno y la regla de la estrategia que aplica.
- ajustes: 2 a 5 cambios concretos para adaptar la plantilla a este alumno (ejercicios ancla a mantener, series a sumar o quitar, reemplazos por molestias, RIR de arranque, transición de volumen).
- cuando_cambiar: la señal concreta para pasar al próximo bloque o de nivel.
- alerta: algo que Fede tenga que mirar (descarga pendiente, nivel mal cargado, adherencia baja, datos insuficientes), o null.`;

export function suggestTemplate(prompt: string): Promise<Suggestion> {
  return parseWithClaude({ system: SYSTEM, prompt, schema: SuggestionSchema, what: 'sugerir un bloque', maxTokens: 8000 });
}

type _Check = z.infer<typeof SuggestionSchema> extends Suggestion ? (Suggestion extends z.infer<typeof SuggestionSchema> ? true : never) : never;
const _ok: _Check = true;
void _ok;
