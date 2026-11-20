// Plantillas de rutina tomadas de la "Guía de hipertrofia" de Fede (Notion).
// Los nombres de ejercicio coinciden con el catálogo de la app; los que no existían
// están en NEW_EXERCISES y se crean solos la primera vez que se usa la plantilla.
// Si cambiás la guía en Notion, actualizá este archivo.
import type { Level } from './types';

export type TemplateMethod = 'guia' | 'objetivo' | 'ppl' | 'weider' | 'heavy_duty' | 'fuerza' | 'hipertrofia';

export const METHOD_LABELS: Record<TemplateMethod, string> = {
  guia: 'Método de la guía',
  objetivo: 'Por objetivo',
  ppl: 'Push Pull Legs',
  weider: 'Weider',
  heavy_duty: 'Heavy Duty',
  fuerza: 'Fuerza (powerlifting)',
  hipertrofia: 'Hipertrofia por niveles',
};

export interface TplExercise {
  name: string;
  sets: number;
  rep_min: number;
  rep_max: number;
  rest: number; // segundos
  note: string;
  alts: string[];
}
export interface TplDay { title: string; dow: number | null; optional?: boolean; exercises: TplExercise[] }
export interface RoutineTemplate {
  id: string;
  name: string;
  method: TemplateMethod;
  levels: Level[];
  daysPerWeek: number;
  forWho: string;
  /** Rol en la estrategia para combinar métodos. */
  role: string;
  /** Va a "Indicaciones generales" de la rutina. */
  progression: string;
  pros?: string[];
  cons?: string[];
  days: TplDay[];
}

/** Ejercicios de la guía que no estaban en el catálogo base. */
export const NEW_EXERCISES = [
  { name: 'Remo unilateral en polea', muscle_group: 'Espalda', equipment: 'Polea', cues: 'Codo pegado al cuerpo, tirá hacia la cadera; estirá completo adelante.' },
  { name: 'Remo sentado en polea agarre abierto', muscle_group: 'Espalda', equipment: 'Polea', cues: 'Codos abiertos, llevá la barra al pecho y juntá las escápulas.' },
];

/** x('Ejercicio', series, 'min-max', descanso en seg, nota, reemplazos) */
function x(name: string, sets: number, reps: string, rest: number, note = '', alts: string[] = []): TplExercise {
  const [a, b] = reps.split('-').map(Number);
  return { name, sets, rep_min: a, rep_max: b ?? a, rest, note, alts };
}

// Atajos de nombres del catálogo
const HACK = 'Sentadilla hack', BANCA = 'Press de banca con barra', JALON_N = 'Jalón al pecho agarre neutro', JALON = 'Jalón al pecho';
const RUMANO = 'Peso muerto rumano', LAT = 'Elevaciones laterales con mancuernas', LAT_P = 'Elevaciones laterales en polea';
const CURL = 'Curl con barra', PRENSA = 'Prensa', INCL_M = 'Press inclinado con mancuernas', REMO_P = 'Remo sentado en polea';
const FEM_S = 'Curl femoral sentado', FEM_A = 'Curl femoral acostado', SOGA = 'Pushdown con cuerda', CRUNCH = 'Crunch en polea';
const MILITAR_M = 'Press militar con mancuernas sentado', HIP = 'Hip thrust', PEC = 'Pec deck', MARTILLO = 'Curl martillo';
const REMO_T = 'Remo en T', DOMI = 'Dominadas', FRANCES = 'Press francés con barra Z', GEM_P = 'Gemelos de pie', GEM_S = 'Gemelos sentado';
const REMO_U = 'Remo unilateral en polea', CRUCE_BA = 'Cruce de poleas bajas a altas', CURL_I = 'Curl inclinado con mancuernas';
const SOBRE_CAB = 'Extensión de tríceps sobre la cabeza en polea', FACE = 'Face pull', BULGARA = 'Sentadilla búlgara';
const CUAD = 'Extensión de cuádriceps', ADUC = 'Aducción de cadera en máquina', CERRADO = 'Press cerrado', SMITH_I = 'Press en Smith inclinado';
const FONDOS_P = 'Fondos en paralelas (pecho)', HAMMER = 'Press de pecho en máquina', PULLOVER = 'Pullover en polea';
const PAJARO = 'Pájaro en máquina', PAJARO_M = 'Pájaro con mancuernas', REMO_AB = 'Remo sentado en polea agarre abierto';
const ABDUC = 'Abducción de cadera en máquina', SENTADILLA = 'Sentadilla libre', PM = 'Peso muerto convencional', MILITAR_B = 'Press militar con barra';
const REMO_B = 'Remo con barra';

const DESCARGA = 'Descarga: mitad de las series, mismas cargas, RIR 3–4.';

export const TEMPLATES: RoutineTemplate[] = [
  // ------------------------------------------------------------ Método de la guía
  {
    id: 'principiante-3', name: 'Rutina principiante — 3 días', method: 'guia', levels: ['principiante'], daysPerWeek: 3,
    forWho: 'Quien puede subir carga o reps casi cada sesión. Cuerpo completo 3 días no consecutivos, cada músculo 3 veces por semana con 8–12 series semanales.',
    role: 'Base del nivel básico.',
    progression: [
      'Progresión doble: trabajá dentro del rango. Cuando todas las series llegan al tope con el RIR indicado, subí lo mínimo (2,5–5 kg piernas, 1–2,5 kg el resto) y volvé al piso del rango.',
      'Primeras 2–3 semanas: prioridad técnica, RIR 3 en compuestos está bien.',
      'Sin descarga planificada mientras progreses. Si el rendimiento cae 2–3 sesiones seguidas, una semana con la mitad de las series.',
      'Con poco tiempo, se recortan los aislamientos del final, no los compuestos.',
    ].join('\n'),
    days: [
      { title: 'Día A', dow: 1, exercises: [
        x(HACK, 3, '6-8', 150, 'RIR 2–3'), x(BANCA, 3, '6-8', 150, 'RIR 2–3'), x(JALON_N, 3, '8-10', 120, 'RIR 2'),
        x(RUMANO, 2, '8-10', 120, 'RIR 2–3'), x(LAT, 2, '12-15', 60, 'RIR 1–2'), x(CURL, 2, '10-12', 60, 'RIR 1–2'),
      ] },
      { title: 'Día B', dow: 3, exercises: [
        x(PRENSA, 3, '10-12', 120, 'RIR 2'), x(INCL_M, 3, '8-10', 120, 'RIR 2'), x(REMO_P, 3, '8-10', 120, 'RIR 2'),
        x(FEM_S, 2, '10-12', 90, 'RIR 1–2'), x(SOGA, 2, '10-12', 60, 'RIR 1–2'), x(CRUNCH, 2, '12-15', 60, 'RIR 1–2'),
      ] },
      { title: 'Día C', dow: 5, exercises: [
        x('Sentadilla en Smith', 3, '8-10', 150, 'RIR 2', [HACK]), x(MILITAR_M, 3, '8-10', 120, 'RIR 2'),
        x('Dominadas asistidas', 3, '6-10', 120, 'RIR 2', [JALON]), x(HIP, 2, '8-12', 120, 'RIR 2'),
        x(PEC, 2, '12-15', 60, 'RIR 1–2'), x(MARTILLO, 2, '10-12', 60, 'RIR 1–2'),
      ] },
    ],
  },
  {
    id: 'intermedia-4', name: 'Rutina intermedia — 4 días', method: 'guia', levels: ['intermedio'], daysPerWeek: 4,
    forWho: 'Quien ya no progresa sesión a sesión pero sí semana a semana. Torso / pierna, cada músculo 2 veces: un día pesado (A) y uno de volumen (B). 12–16 series semanales.',
    role: 'Base del nivel intermedio.',
    progression: [
      'Bloques de 5–6 semanas. Días A: subir carga cada semana manteniendo el RIR. Días B: progresión doble.',
      'Se puede sumar 1 serie por semana a los músculos rezagados, sin pasar de ~20 semanales.',
      `${DESCARGA} En la última semana del bloque o antes si cae el rendimiento. Después, arrancá el bloque nuevo un poco por encima del anterior.`,
      'El fallo (RIR 0) se reserva para aislamientos y la última serie; en press plano, hack y rumano quedarse en RIR 1–2.',
    ].join('\n'),
    days: [
      { title: 'Torso A — pesado', dow: 1, exercises: [
        x(BANCA, 4, '5-7', 180, 'RIR 1–2'), x(REMO_T, 4, '6-8', 150, 'RIR 1–2'), x(MILITAR_M, 3, '6-8', 150, 'RIR 1–2'),
        x(DOMI, 3, '6-8', 150, 'RIR 1–2 · con lastre si hace falta'), x(CURL, 2, '8-10', 90, 'RIR 1'), x(FRANCES, 2, '8-10', 90, 'RIR 1'),
      ] },
      { title: 'Pierna A — pesado', dow: 2, exercises: [
        x(HACK, 4, '5-7', 180, 'RIR 1–2'), x(RUMANO, 3, '6-8', 150, 'RIR 2'), x(PRENSA, 2, '10-12', 120, 'RIR 1–2'),
        x(FEM_S, 3, '8-10', 90, 'RIR 1'), x(GEM_P, 3, '8-12', 90, 'RIR 1'), x(CRUNCH, 3, '10-12', 60, 'RIR 1'),
      ] },
      { title: 'Torso B — volumen', dow: 4, exercises: [
        x(INCL_M, 3, '8-12', 120, 'RIR 1–2'), x(JALON_N, 3, '10-12', 120, 'RIR 1–2'), x(REMO_U, 3, '10-12', 90, 'RIR 1 · por brazo'),
        x(CRUCE_BA, 2, '12-15', 60, 'RIR 0–1'), x(LAT, 4, '12-20', 60, 'RIR 0–1'), x(CURL_I, 2, '10-15', 60, 'RIR 0–1'),
        x(SOBRE_CAB, 2, '10-15', 60, 'RIR 0–1'), x(FACE, 2, '15-20', 60, 'RIR 0–1'),
      ] },
      { title: 'Pierna B — volumen', dow: 5, exercises: [
        x(BULGARA, 3, '8-12', 120, 'RIR 1–2 · por pierna'), x(HIP, 3, '8-12', 120, 'RIR 1–2'), x(CUAD, 3, '12-15', 90, 'RIR 0–1'),
        x(FEM_A, 3, '10-15', 90, 'RIR 0–1', [FEM_S]), x(ADUC, 2, '12-15', 60, 'RIR 1'), x(GEM_S, 3, '12-20', 60, 'RIR 0–1'),
      ] },
    ],
  },
  {
    id: 'avanzada-5', name: 'Rutina avanzada — 5 días', method: 'guia', levels: ['avanzado'], daysPerWeek: 5,
    forWho: 'Quien solo progresa de un bloque al siguiente. Torso y pierna de fuerza, después empuje, tracción y pierna de volumen. 14–20 series semanales, más en los prioritarios.',
    role: 'Base del nivel avanzado.',
    progression: [
      'Bloques: Acumulación 4–5 semanas (rangos 8–15, +1 serie por semana a los prioritarios, RIR de 3 a 1) → Intensificación 3–4 semanas (volver al volumen inicial, compuestos en 5–8, RIR 1–2, buscar cargas récord) → Descarga 1 semana (mitad de las series, RIR 3–4).',
      'Autorregulación: elegir la carga del día según el RIR.',
      'Especialización: para un músculo rezagado, 18–22 series y bajar otros a mantenimiento (6–8) durante un bloque.',
      'Si no recupera piernas entre el día 2 y el 5, pasar el día 5 al domingo o bajar 1 serie por ejercicio.',
    ].join('\n'),
    days: [
      { title: 'Torso fuerza', dow: 1, exercises: [
        x(BANCA, 4, '4-6', 180, 'RIR 1–2'), x(DOMI, 4, '5-7', 180, 'RIR 1–2 · con lastre'), x(INCL_M, 3, '6-8', 150, 'RIR 1–2'),
        x(REMO_T, 3, '6-8', 150, 'RIR 1–2'), x(LAT, 3, '12-15', 60, 'RIR 0–1'), x(CURL, 2, '6-8', 120, 'RIR 1'), x(CERRADO, 2, '6-8', 120, 'RIR 1'),
      ] },
      { title: 'Pierna fuerza', dow: 2, exercises: [
        x(HACK, 4, '4-6', 180, 'RIR 1–2'), x(RUMANO, 4, '5-7', 180, 'RIR 2'), x(PRENSA, 3, '8-10', 120, 'RIR 1–2'),
        x(FEM_S, 3, '8-10', 90, 'RIR 1'), x(GEM_P, 4, '8-10', 90, 'RIR 1'),
      ] },
      { title: 'Empuje', dow: 4, exercises: [
        x(SMITH_I, 4, '8-10', 150, 'RIR 1'), x(FONDOS_P, 3, '8-10', 120, 'RIR 1 · con lastre', [HAMMER]), x(CRUCE_BA, 3, '12-15', 60, 'RIR 0–1'),
        x(LAT_P, 4, '12-20', 60, 'RIR 0–1'), x(SOBRE_CAB, 3, '10-15', 60, 'RIR 0–1'), x(SOGA, 2, '12-15', 60, 'RIR 0'),
      ] },
      { title: 'Tracción', dow: 5, exercises: [
        x(JALON_N, 4, '8-12', 120, 'RIR 1'), x(REMO_U, 3, '10-12', 90, 'RIR 1 · por brazo, codo pegado'), x(REMO_AB, 3, '10-12', 120, 'RIR 1'),
        x(PULLOVER, 2, '12-15', 60, 'RIR 0–1'), x(PAJARO, 3, '15-20', 60, 'RIR 0–1', [PAJARO_M]), x(CURL_I, 3, '10-12', 60, 'RIR 0–1'), x(MARTILLO, 2, '10-12', 60, 'RIR 0–1'),
      ] },
      { title: 'Pierna volumen', dow: 6, exercises: [
        x(BULGARA, 3, '8-12', 120, 'RIR 1 · por pierna'), x(HIP, 3, '8-12', 120, 'RIR 1'), x(CUAD, 3, '12-15', 90, 'RIR 0'),
        x(FEM_A, 3, '10-15', 90, 'RIR 0–1'), x(ADUC, 3, '12-15', 60, 'RIR 1'), x(GEM_S, 4, '12-20', 60, 'RIR 0–1'),
      ] },
    ],
  },
  // ------------------------------------------------------------ Por objetivo
  {
    id: 'gluteos-4', name: 'Rutina foco glúteos y piernas — 4 días', method: 'objetivo', levels: ['principiante', 'intermedio', 'avanzado'], daysPerWeek: 4,
    forWho: 'Prioridad glúteos y piernas, espalda y hombros para el torso en V; pecho y brazos en mantenimiento. Torso / pierna con frecuencia 2 y un día 5 opcional de glúteo.',
    role: 'Especialización cuando la zona prioritaria es el tren inferior.',
    progression: [
      'Principiante: progresión doble, sin el día 5 y con RIR 2–3.',
      `Intermedia o avanzada: bloques de 5–6 semanas subiendo carga en hip thrust, rumano y hack semana a semana; ${DESCARGA}`,
      'Si con 4 días los glúteos no crecen, sumar el día 5 antes que agregar series. Con el día 5, sacar la abducción del día A y la patada del día B (máx. ~24 series directas).',
      'Hip thrust: mentón al pecho, pausa de 1 s arriba sin arquear la lumbar. Búlgara: torso inclinado y paso largo para glúteo. Prensa: pies altos y anchos.',
    ].join('\n'),
    pros: ['Glúteos y femorales con frecuencia 2–3 y volumen alto.', 'Torso en V que afina la cintura.', 'Días de torso cortos.'],
    cons: ['Días de pierna exigentes.', 'Mucho volumen de cadera puede cargar la lumbar.', 'Pecho y brazos en mantenimiento.'],
    days: [
      { title: 'Pierna A — glúteo y femorales', dow: 1, exercises: [
        x(HIP, 4, '6-10', 150, 'RIR 1–2 · con barra'), x(RUMANO, 3, '8-10', 150, 'RIR 2'), x(BULGARA, 3, '8-12', 120, 'RIR 1–2 · por pierna, torso inclinado'),
        x(FEM_S, 3, '10-12', 90, 'RIR 0–1'), x(ABDUC, 3, '15-20', 60, 'RIR 0–1'),
      ] },
      { title: 'Torso A', dow: 2, exercises: [
        x(JALON_N, 3, '10-12', 120, 'RIR 1–2'), x(REMO_AB, 3, '10-12', 120, 'RIR 1–2'), x(MILITAR_M, 3, '8-12', 120, 'RIR 1–2'),
        x(LAT, 3, '12-20', 60, 'RIR 0–1'), x(INCL_M, 2, '8-12', 120, 'RIR 1–2'), x(FACE, 2, '15-20', 60, 'RIR 0–1'),
      ] },
      { title: 'Pierna B — cuádriceps y glúteo', dow: 4, exercises: [
        x(HACK, 3, '8-10', 150, 'RIR 1–2 · profunda'), x('Hip thrust en máquina', 3, '10-15', 120, 'RIR 1 · o unilateral'),
        x(PRENSA, 3, '10-12', 120, 'RIR 1 · pies altos y anchos'), x(FEM_A, 3, '10-15', 90, 'RIR 0–1'), x(CUAD, 2, '12-15', 60, 'RIR 0–1'),
        x('Patada de glúteo en polea', 2, '12-15', 60, 'RIR 0–1 · por pierna'),
      ] },
      { title: 'Torso B', dow: 5, exercises: [
        x(REMO_U, 3, '10-12', 90, 'RIR 1 · por brazo, codo pegado'), x(JALON, 3, '10-12', 120, 'RIR 1 · agarre ancho'), x(LAT_P, 3, '12-20', 60, 'RIR 0–1'),
        x(PAJARO, 3, '15-20', 60, 'RIR 0–1', [PAJARO_M]), x(HAMMER, 2, '10-12', 90, 'RIR 1–2', ['Flexiones de brazos']),
        x('Curl de bíceps en polea', 2, '12-15', 60, 'Opcional · superserie con el pushdown · RIR 1'), x('Pushdown de tríceps', 2, '12-15', 60, 'Opcional · superserie con el curl · RIR 1'),
      ] },
      { title: 'Día 5 opcional — glúteo', dow: 6, optional: true, exercises: [
        x(HIP, 3, '12-15', 120, 'RIR 1 · más liviano'), x('Estocadas caminando', 3, '10-12', 120, 'RIR 1–2 · por pierna', ['Subidas al cajón']),
        x('Hiperextensiones', 3, '12-15', 90, 'RIR 1 · foco glúteo'), x(ABDUC, 3, '15-20', 60, 'RIR 0'),
      ] },
    ],
  },
  // ------------------------------------------------------------ Otros métodos
  {
    id: 'ppl-6', name: 'Rutina Push Pull Legs — 6 días', method: 'ppl', levels: ['intermedio', 'avanzado'], daysPerWeek: 6,
    forWho: 'Intermedios y avanzados que pueden ir 6 días. Empuje, tracción y pierna dos veces: sesión A pesada y B de volumen. 15–20 series por músculo.',
    role: 'Volumen alto para quien tiene tiempo y buena recuperación.',
    progression: [
      'Días A: subir carga semana a semana manteniendo el RIR. Días B: progresión doble.',
      `Bloques de 5–6 semanas. ${DESCARGA}`,
    ].join('\n'),
    pros: ['Los días no se pisan.', 'Frecuencia 2 con sesiones enfocadas.', 'Mucho volumen sin sesiones eternas.'],
    cons: ['Exige 6 días y un solo descanso.', 'Fatiga en hombros y codos.', 'El día de pierna es el que más se saltea.'],
    days: [
      { title: 'Empuje A — pesado', dow: 1, exercises: [
        x(BANCA, 4, '5-7', 180, 'RIR 1–2'), x(INCL_M, 3, '8-10', 120, 'RIR 1–2'), x(MILITAR_M, 3, '8-10', 120, 'RIR 1–2'),
        x(LAT, 3, '12-15', 60, 'RIR 0–1'), x(SOGA, 3, '10-12', 60, 'RIR 0–1'),
      ] },
      { title: 'Tracción A — pesado', dow: 2, exercises: [
        x(DOMI, 4, '6-8', 150, 'RIR 1–2 · con lastre si hace falta'), x(REMO_T, 3, '6-8', 150, 'RIR 1–2'), x(REMO_U, 3, '10-12', 90, 'RIR 1 · por brazo, codo pegado'),
        x(FACE, 2, '15-20', 60, 'RIR 0–1'), x(CURL, 3, '8-10', 90, 'RIR 1'),
      ] },
      { title: 'Pierna A — pesado', dow: 3, exercises: [
        x(HACK, 4, '5-7', 180, 'RIR 1–2'), x(RUMANO, 3, '6-8', 150, 'RIR 2'), x(PRENSA, 3, '10-12', 120, 'RIR 1–2'),
        x(FEM_S, 3, '8-10', 90, 'RIR 1'), x(GEM_P, 3, '8-12', 90, 'RIR 1'),
      ] },
      { title: 'Empuje B — volumen', dow: 4, exercises: [
        x(SMITH_I, 3, '8-12', 120, 'RIR 1'), x(HAMMER, 3, '10-12', 120, 'RIR 1'), x(CRUCE_BA, 3, '12-15', 60, 'RIR 0–1'),
        x(LAT_P, 4, '12-20', 60, 'RIR 0–1'), x(SOBRE_CAB, 3, '10-15', 60, 'RIR 0–1'),
      ] },
      { title: 'Tracción B — volumen', dow: 5, exercises: [
        x(JALON_N, 3, '10-12', 120, 'RIR 1'), x(REMO_AB, 3, '10-12', 120, 'RIR 1'), x(PULLOVER, 2, '12-15', 60, 'RIR 0–1'),
        x(PAJARO, 3, '15-20', 60, 'RIR 0–1', [PAJARO_M]), x(CURL_I, 3, '10-12', 60, 'RIR 0–1'), x(MARTILLO, 2, '10-12', 60, 'RIR 0–1'),
      ] },
      { title: 'Pierna B — volumen', dow: 6, exercises: [
        x(BULGARA, 3, '8-12', 120, 'RIR 1–2 · por pierna'), x(HIP, 3, '8-12', 120, 'RIR 1–2'), x(CUAD, 3, '12-15', 90, 'RIR 0–1'),
        x(FEM_A, 3, '10-15', 90, 'RIR 0–1'), x(ADUC, 2, '12-15', 60, 'RIR 1'), x(GEM_S, 3, '12-20', 60, 'RIR 0–1'),
      ] },
    ],
  },
  {
    id: 'weider-5', name: 'Rutina Weider — 5 días', method: 'weider', levels: ['intermedio', 'avanzado'], daysPerWeek: 5,
    forWho: 'Un grupo muscular por día, una vez por semana con mucho volumen en la sesión. Para quien disfruta entrenar un músculo a fondo y puede ir 5 días fijos.',
    role: 'Variedad y motivación entre bloques.',
    progression: [
      'Progresión doble en todos los ejercicios.',
      'Más allá de ~10 series duras por músculo en la misma sesión cada serie extra suma poco: por eso 13–15 series por día.',
      `Bloques de 5–6 semanas. ${DESCARGA}`,
      'Variante con más frecuencia: sumar 3–4 series de pecho y espalda el día de brazos y 3–4 de laterales el día de espalda.',
    ].join('\n'),
    pros: ['Enfoque y bombeo por músculo.', 'Fácil de planificar y motivante.', 'Mucha recuperación por músculo.'],
    cons: ['Frecuencia 1: si se falta, el músculo pierde la semana.', 'Las últimas series rinden menos.', 'No recomendable para principiantes.'],
    days: [
      { title: 'Pecho', dow: 1, exercises: [
        x(BANCA, 4, '6-8', 180, 'RIR 1–2'), x(INCL_M, 3, '8-10', 120, 'RIR 1–2'), x(FONDOS_P, 3, '8-10', 120, 'RIR 1', [HAMMER]),
        x(CRUCE_BA, 3, '12-15', 60, 'RIR 0–1'), x(PEC, 2, '12-15', 60, 'RIR 0'),
      ] },
      { title: 'Espalda', dow: 2, exercises: [
        x(DOMI, 4, '6-8', 150, 'RIR 1–2 · con lastre si hace falta'), x(REMO_T, 3, '8-10', 150, 'RIR 1–2'), x(JALON_N, 3, '10-12', 120, 'RIR 1'),
        x(REMO_U, 3, '10-12', 90, 'RIR 1 · por brazo, codo pegado'), x(PULLOVER, 2, '12-15', 60, 'RIR 0'),
      ] },
      { title: 'Piernas', dow: 3, exercises: [
        x(HACK, 4, '6-8', 180, 'RIR 1–2'), x(RUMANO, 3, '8-10', 150, 'RIR 2'), x(PRENSA, 3, '10-12', 120, 'RIR 1'),
        x(CUAD, 2, '12-15', 90, 'RIR 0'), x(FEM_S, 3, '10-12', 90, 'RIR 0–1'), x(GEM_P, 4, '10-15', 60, 'RIR 0–1'),
      ] },
      { title: 'Hombros', dow: 4, exercises: [
        x(MILITAR_M, 3, '6-8', 150, 'RIR 1–2'), x(LAT, 4, '12-15', 60, 'RIR 0–1'), x(LAT_P, 3, '15-20', 60, 'RIR 0'),
        x(PAJARO, 3, '15-20', 60, 'RIR 0–1', [PAJARO_M]), x(FACE, 2, '15-20', 60, 'RIR 0–1'),
      ] },
      { title: 'Brazos', dow: 5, exercises: [
        x(CERRADO, 3, '6-8', 120, 'RIR 1–2'), x(CURL, 3, '8-10', 90, 'RIR 1'), x(SOBRE_CAB, 3, '10-12', 60, 'RIR 0–1'),
        x(CURL_I, 3, '10-12', 60, 'RIR 0–1'), x(SOGA, 2, '12-15', 60, 'RIR 0'), x(MARTILLO, 2, '10-12', 60, 'RIR 0'),
      ] },
    ],
  },
  {
    id: 'hd-basico', name: 'Heavy Duty básico — cuerpo completo 3 días', method: 'heavy_duty', levels: ['principiante'], daysPerWeek: 3,
    forWho: 'Aprender qué es el fallo real con pocas series. Se alternan los días A y B (semanas impares A-B-A, pares B-A-B).',
    role: 'Complemento del nivel básico: bloque de 4–8 semanas para calibrar el RIR o semanas con solo 2 días.',
    progression: [
      'Alternar: semanas impares A (lun) · B (mié) · A (vie); semanas pares B · A · B.',
      'Semanas 1–3 a RIR 1–2 para aprender técnica y tempo. Desde la semana 4, la última serie de cada ejercicio en máquina va al fallo.',
      'Antes de cada serie efectiva, 1–2 de aproximación (≈50% y ≈75%). Tempo lento, sin rebote.',
      'Progresión doble: cuando la serie al fallo llega al tope del rango, subir 2,5–5%.',
      'Si en 2 sesiones seguidas no mejora la mayoría de los ejercicios, pasar a 2 días por semana, no sumar series.',
      'Seguridad: fallo solo en máquinas, Smith o poleas; el rumano siempre a RIR 2. Duración 8–12 semanas.',
    ].join('\n'),
    days: [
      { title: 'Día A', dow: null, exercises: [
        x(PRENSA, 2, '10-15', 150, '1ª RIR 1 · 2ª al fallo'), x(FEM_S, 1, '10-12', 120, 'Al fallo'), x(HAMMER, 2, '8-10', 150, '1ª RIR 1 · 2ª al fallo'),
        x(JALON_N, 2, '8-10', 150, '1ª RIR 1 · 2ª al fallo'), x(LAT, 1, '10-15', 90, 'Al fallo'), x(SOGA, 1, '10-12', 90, 'Al fallo'),
      ] },
      { title: 'Día B', dow: null, exercises: [
        x(HACK, 2, '8-12', 180, 'RIR 1 (fallo solo con topes de seguridad)'), x(RUMANO, 2, '8-10', 150, 'RIR 2 · nunca al fallo'),
        x(SMITH_I, 2, '8-10', 150, '1ª RIR 1 · 2ª al fallo'), x(REMO_P, 2, '8-10', 150, '1ª RIR 1 · 2ª al fallo'),
        x(CURL, 1, '8-10', 90, 'Al fallo'), x(GEM_P, 1, '12-20', 90, 'Al fallo'),
      ] },
    ],
  },
  {
    id: 'hd-intermedio', name: 'Heavy Duty intermedio — rotación de 3 sesiones', method: 'heavy_duty', levels: ['intermedio'], daysPerWeek: 3,
    forWho: 'Adaptación de la "rutina ideal" de Mentzer: 1 serie efectiva al fallo por ejercicio, rotando A → B → C con 48 h o más entre sesiones.',
    role: 'Intensificación entre bloques de volumen y temporadas con poco tiempo.',
    progression: [
      '→ en la nota = superserie de pre-agotamiento: pasar al ejercicio siguiente sin descanso (menos de 5 s).',
      '1–2 series de aproximación antes de cada serie efectiva. Tempo lento (~4 s subida, 4 s bajada).',
      'Subir carga cuando la serie efectiva supera el tope del rango. Si 2 sesiones seguidas no hay progreso, rotar cada 72–96 h, no sumar series.',
      'Variante 2 series: 2–3 min después de la efectiva, otra al fallo con 10–15% menos carga.',
      'Bloques de 6–8 semanas y después una semana liviana (RIR 3, sin técnicas) o libre.',
    ].join('\n'),
    pros: ['Sesiones de 30–50 min.', 'Enseña el esfuerzo real.', 'Mucha recuperación.'],
    cons: ['Volumen bajo a largo plazo.', 'Fallo en casi todas las series.', 'Depende de compañero para forzadas y negativas.'],
    days: [
      { title: 'Sesión A — Pecho y espalda', dow: 1, exercises: [
        x(PEC, 1, '6-10', 10, 'Al fallo · → sin descanso al press inclinado'), x(SMITH_I, 1, '6-10', 180, 'Fallo + 1–2 forzadas'),
        x(PULLOVER, 1, '6-10', 10, 'Al fallo · → sin descanso al jalón'), x(JALON_N, 1, '6-10', 180, 'Al fallo · agarre neutro cerrado'),
        x(REMO_T, 1, '6-10', 180, 'Fallo + rest-pause'), x(RUMANO, 1, '6-8', 180, 'RIR 1'),
      ] },
      { title: 'Sesión B — Piernas', dow: 3, exercises: [
        x(CUAD, 1, '8-15', 10, 'Al fallo · → sin descanso a la prensa'), x(PRENSA, 1, '8-15', 180, 'Fallo + rest-pause'),
        x(FEM_S, 1, '8-12', 120, 'Fallo + negativas'), x(HIP, 1, '8-12', 150, 'RIR 0–1'), x(GEM_P, 1, '12-20', 120, 'Fallo + rest-pause'),
      ] },
      { title: 'Sesión C — Hombros y brazos', dow: 5, exercises: [
        x(LAT, 1, '6-10', 10, 'Al fallo · → sin descanso al press militar'), x(MILITAR_M, 1, '6-10', 180, 'Al fallo'),
        x(PAJARO, 1, '8-12', 120, 'Al fallo', [PAJARO_M]), x(CURL, 1, '6-10', 120, 'Fallo + negativas'),
        x(SOGA, 1, '6-10', 10, 'Al fallo · → sin descanso a los fondos'), x('Fondos en paralelas (tríceps)', 1, '6-15', 150, 'Al fallo · máximas reps'),
      ] },
    ],
  },
  {
    id: 'hd-avanzado', name: 'Heavy Duty avanzado — 4 días (estilo Yates)', method: 'heavy_duty', levels: ['avanzado'], daysPerWeek: 4,
    forWho: '1–2 series de aproximación crecientes y una serie efectiva al fallo por ejercicio, con técnicas más allá del fallo en el último ejercicio de cada grupo. 4–8 series al fallo por músculo.',
    role: 'Bloque de intensificación entre bloques de volumen, no método permanente.',
    progression: [
      'Elegí 1 o 2 técnicas (forzadas, negativas, rest-pause) por sesión y rotalas entre bloques.',
      'Cada sesión, superar la serie efectiva anterior en reps o carga; si se pasa del rango, subir carga.',
      'Si se frenan varios ejercicios, estirar el ciclo: las 4 sesiones en 8–9 días.',
      'Bloques de 4–6 semanas y una semana de descarga (RIR 3, sin técnicas).',
    ].join('\n'),
    days: [
      { title: 'Hombros y tríceps', dow: 1, exercises: [
        x(MILITAR_M, 1, '6-8', 180, 'Fallo + 1–2 forzadas'), x(LAT, 1, '8-10', 120, 'Fallo + rest-pause'), x(LAT_P, 1, '10-12', 90, 'Al fallo'),
        x(PAJARO, 1, '10-12', 90, 'Al fallo', [PAJARO_M]), x(CERRADO, 1, '6-8', 180, 'RIR 0–1 (con compañero)'),
        x('Extensión de tríceps sobre la cabeza con mancuerna', 1, '8-10', 120, 'Fallo + negativas', [SOBRE_CAB]), x(SOGA, 1, '10-12', 90, 'Al fallo'),
      ] },
      { title: 'Espalda', dow: 2, exercises: [
        x(PULLOVER, 1, '8-10', 10, 'Al fallo · → sin descanso al jalón'), x(JALON_N, 1, '6-8', 180, 'Fallo + 1–2 forzadas'), x(REMO_T, 1, '6-8', 180, 'Al fallo'),
        x(REMO_U, 1, '8-10', 120, 'Fallo + rest-pause · por brazo'), x(REMO_AB, 1, '8-10', 120, 'Al fallo'), x(FACE, 1, '12-15', 90, 'Al fallo'), x(RUMANO, 1, '6-8', 180, 'RIR 1'),
      ] },
      { title: 'Pecho y bíceps', dow: 4, exercises: [
        x(SMITH_I, 1, '6-8', 180, 'Fallo + 1–2 forzadas'), x(HAMMER, 1, '6-8', 180, 'Al fallo'), x(PEC, 1, '8-10', 120, 'Fallo + rest-pause'),
        x(CRUCE_BA, 1, '10-12', 90, 'Al fallo'), x(CURL, 1, '6-8', 120, 'Fallo + negativas'), x(CURL_I, 1, '8-10', 90, 'Al fallo'), x(MARTILLO, 1, '8-10', 90, 'Al fallo'),
      ] },
      { title: 'Piernas', dow: 5, exercises: [
        x(CUAD, 1, '10-12', 10, 'Al fallo · → sin descanso a la hack'), x(HACK, 1, '6-10', 210, 'Fallo (con topes) + rest-pause'), x(PRENSA, 1, '10-12', 180, 'Al fallo'),
        x(FEM_A, 1, '8-10', 120, 'Fallo + negativas'), x(FEM_S, 1, '8-10', 120, 'Al fallo'), x(GEM_P, 1, '10-12', 120, 'Fallo + rest-pause'), x(GEM_S, 1, '12-15', 90, 'Al fallo'),
      ] },
    ],
  },
  // ------------------------------------------------------------ Planes por niveles (Pirámide)
  {
    id: 'fuerza-principiante', name: 'Fuerza principiante — 3 días', method: 'fuerza', levels: ['principiante'], daysPerWeek: 3,
    forWho: 'Primeros 6–12 meses con objetivo de fuerza en sentadilla, banca y peso muerto. Aprendizaje motor y progresión lineal.',
    role: 'Objetivo fuerza máxima, nivel básico.',
    progression: [
      'Progresión lineal: +2,5 kg por semana en banca y accesorios, +5 kg en sentadilla y peso muerto, mientras se completen todas las reps.',
      'Los porcentajes son del 1RM (ver nota de cada ejercicio). Si falla 2 veces seguidas: bajar 10% y retomar.',
    ].join('\n'),
    days: [
      { title: 'Día 1 — Acumulación', dow: 1, exercises: [
        x(SENTADILLA, 3, '8', 180, '70% 1RM'), x(BANCA, 3, '8', 180, '70% 1RM'), x(JALON, 4, '10', 120, 'RPE 8', [DOMI]),
      ] },
      { title: 'Día 2 — Técnica y potencia', dow: 3, exercises: [
        x(BANCA, 3, '3', 180, '80% 1RM · técnica'), x(PM, 3, '3', 240, '85% 1RM'), x(MILITAR_B, 4, '10', 120, 'RPE 8'),
      ] },
      { title: 'Día 3 — Fuerza principal', dow: 5, exercises: [
        x(SENTADILLA, 3, '4', 240, '85% 1RM'), x(BANCA, 3, '4', 240, '85% 1RM'), x(REMO_B, 4, '10', 120, 'RPE 8', [REMO_P]),
        x(BULGARA, 3, '8', 120, 'RPE 8 · por pierna', ['Estocadas caminando']),
      ] },
    ],
  },
  {
    id: 'fuerza-intermedio', name: 'Fuerza intermedio — 4 días', method: 'fuerza', levels: ['intermedio'], daysPerWeek: 4,
    forWho: 'Levantadores que ya no progresan sesión a sesión. Periodización ondulante (hipertrofia, potencia, fuerza) y olas de 3 semanas.',
    role: 'Objetivo fuerza máxima, nivel intermedio.',
    progression: [
      'Olas de 3 semanas: las reps bajan mientras la carga sube (8 → 7 → 6 o 5 → 4 → 3). Semana 4: evaluar descarga.',
      'Descarga: mitad de las series, carga igual o −5%, RPE 2–3 puntos menos.',
    ].join('\n'),
    days: [
      { title: 'Día 1 — Hipertrofia', dow: 1, exercises: [
        x('Sentadilla frontal', 3, '7-9', 180, 'RPE 7 · o barra alta', [SENTADILLA]), x(BANCA, 3, '7-9', 180, '67,5–72,5% 1RM · RPE 7'), x(JALON, 3, '7-9', 120, 'RPE 8', [DOMI]),
      ] },
      { title: 'Día 2 — Potencia y técnica', dow: 2, exercises: [
        x(SENTADILLA, 3, '1-3', 180, '80–85% 1RM · RPE 5'), x(BANCA, 3, '1-3', 180, '80–85% 1RM · RPE 5'), x(PM, 3, '1-3', 180, '80–85% 1RM · RPE 5'),
        x(MILITAR_B, 3, '4-6', 150, 'RPE 8'),
      ] },
      { title: 'Día 3 — Fuerza (sentadilla y banca)', dow: 4, exercises: [
        x(SENTADILLA, 3, '3-5', 240, '82,5–87,5% 1RM · RPE 8'), x(BANCA, 3, '3-5', 240, '82,5–87,5% 1RM · RPE 8'), x(REMO_B, 3, '4-6', 150, 'RPE 8'),
        x(FEM_A, 3, '12', 90, 'RPE 8'),
      ] },
      { title: 'Día 4 — Fuerza (peso muerto)', dow: 5, exercises: [
        x(CERRADO, 3, '6-8', 150, 'RPE 8 · o press inclinado', ['Press inclinado con barra']), x(PM, 3, '3-5', 240, '82,5–87,5% 1RM · RPE 8'),
        x('Remo con mancuerna a una mano', 3, '8-12', 90, 'RPE 8'),
      ] },
    ],
  },
  {
    id: 'fuerza-avanzado', name: 'Fuerza avanzado — 6 días (bloque de acumulación)', method: 'fuerza', levels: ['avanzado'], daysPerWeek: 6,
    forWho: 'Atletas con más de 2–3 años estructurados. Periodización en bloques con ondulación diaria; esta es la semana 1 del bloque de acumulación.',
    role: 'Objetivo fuerza máxima, nivel avanzado.',
    progression: [
      'Acumulación 6 semanas: 18–22 series semanales, RPE 6–8.',
      'Intensificación 4 semanas: 12–15 series, RPE 8,5–10, cargas pesadas.',
      'Realización / taper 1–2 semanas: volumen al 50% antes de testear el 1RM o competir.',
    ].join('\n'),
    days: [
      { title: 'Día 1', dow: 1, exercises: [x('Sentadilla frontal', 3, '8', 180, '70% 1RM · RPE 6–8 · variante de sentadilla'), x(BANCA, 3, '8', 180, '70% 1RM · RPE 6–8'), x(JALON, 3, '10', 120, 'RPE 6–8')] },
      { title: 'Día 2', dow: 2, exercises: [x(RUMANO, 3, '8', 180, 'RPE 6–8 · bisagra de cadera'), x(MILITAR_B, 3, '8', 150, 'RPE 6–8'), x('Pushdown de tríceps', 3, '10', 90, 'RPE 6–8')] },
      { title: 'Día 3', dow: 3, exercises: [x(SENTADILLA, 3, '4', 180, '77,5% 1RM · RPE 5–7 · técnica'), x(BANCA, 3, '4', 180, '77,5% 1RM · RPE 5–7 · técnica'), x(REMO_B, 3, '8', 120, 'RPE 6–8')] },
      { title: 'Día 4', dow: 4, exercises: [x(PM, 3, '4', 240, '77,5% 1RM · RPE 6–8'), x(CERRADO, 3, '8', 150, 'RPE 6–8 · variante de banca'), x(CRUNCH, 3, '10', 60, 'RPE 6–8 · con lastre')] },
      { title: 'Día 5', dow: 5, exercises: [x(SENTADILLA, 3, '5', 240, '82,5% 1RM · RPE 7–9'), x(BANCA, 3, '5', 240, '82,5% 1RM · RPE 7–9'), x(FACE, 3, '12', 60, 'RPE 6–8')] },
      { title: 'Día 6', dow: 6, exercises: [x(PM, 3, '5', 240, '82,5% 1RM · RPE 7–9'), x(MILITAR_B, 3, '5', 180, '82,5% 1RM · RPE 7–9'), x('Paseo del granjero', 3, '1', 90, 'Agarre: sostén de 15 segundos')] },
    ],
  },
  {
    id: 'hipertrofia-principiante', name: 'Hipertrofia principiante — torso / pierna 4 días', method: 'hipertrofia', levels: ['principiante'], daysPerWeek: 4,
    forWho: 'Base de masa muscular con la fatiga bien repartida. Torso / pierna, 10–12 series directas por grupo.',
    role: 'Alternativa al principiante de 3 días para quien puede ir 4.',
    progression: 'Progresión lineal de las cargas semana a semana. Si falla 2 veces seguidas: bajar 10% y retomar.',
    days: [
      { title: 'Pierna A — pesado', dow: 1, exercises: [
        x(SENTADILLA, 3, '5', 180, '82,5% 1RM · variante de sentadilla', [HACK]), x(RUMANO, 3, '5', 180, '82,5% 1RM'),
        x('Estocadas caminando', 3, '8', 120, 'RPE 8 · por pierna'), x(GEM_P, 4, '8', 90, 'RPE 8'),
      ] },
      { title: 'Torso A — pesado', dow: 2, exercises: [
        x(BANCA, 3, '5', 180, '82,5% 1RM'), x(REMO_B, 3, '5', 150, 'RPE 8'), x(MILITAR_B, 2, '8', 150, '72,5% 1RM'),
        x(JALON, 2, '8', 120, 'RPE 8', [DOMI]), x('Aperturas con mancuernas', 2, '15', 60, 'RPE 8', ['Cruce de poleas']),
      ] },
      { title: 'Pierna B — volumen', dow: 4, exercises: [
        x(RUMANO, 3, '8', 150, 'RPE 8', [HIP]), x(PRENSA, 3, '8', 120, 'RPE 8'), x(CUAD, 3, '12', 90, 'RPE 8'),
        x(FEM_A, 3, '12', 90, 'RPE 8'), x(GEM_S, 4, '15', 60, 'RPE 8'),
      ] },
      { title: 'Torso B — volumen', dow: 5, exercises: [
        x('Press de banca con mancuernas', 3, '10', 120, '67,5% 1RM'), x(REMO_P, 3, '10', 120, 'RPE 8'), x(INCL_M, 2, '12', 90, 'RPE 8'),
        x(JALON, 2, '12', 90, 'RPE 8'), x('Pushdown de tríceps', 2, '12', 60, 'RPE 8'), x(CURL, 2, '12', 60, 'RPE 8', ['Curl con mancuernas alternado']),
      ] },
    ],
  },
  {
    id: 'hipertrofia-intermedio', name: 'Hipertrofia intermedio — 5 días', method: 'hipertrofia', levels: ['intermedio'], daysPerWeek: 5,
    forWho: 'Fuerza de pierna y torso al principio de la semana y después pierna, empuje y tirón de hipertrofia. 13–16 series semanales.',
    role: 'Alternativa al intermedio de 4 días para quien puede ir 5.',
    progression: [
      'Compuestos: periodización ondulante en ciclos de 3 semanas (12 → 10 → 8 reps).',
      'Aislamientos: progresión doble (por ejemplo 3 × 12–15).',
      'Al final de cada mesociclo (3–4 semanas), checklist de recuperación: con 2 o más respuestas "sí", descarga.',
    ].join('\n'),
    days: [
      { title: 'Pierna fuerza', dow: 1, exercises: [
        x(SENTADILLA, 4, '3-5', 210, '82,5–87,5% 1RM · RPE 8'), x(PM, 4, '3-5', 210, '82,5–87,5% 1RM · RPE 8'),
        x(BULGARA, 3, '6-8', 120, 'RPE 8 · por pierna'), x(FEM_S, 3, '6-8', 90, 'RPE 8'), x(GEM_P, 5, '6-8', 90, 'RPE 8'),
      ] },
      { title: 'Torso fuerza', dow: 2, exercises: [
        x(BANCA, 4, '3-5', 210, '82,5–87,5% 1RM · RPE 8'), x(REMO_B, 4, '4-6', 150, 'RPE 8'), x(MILITAR_B, 3, '5-7', 150, '77,5–82,5% 1RM · RPE 8'),
        x(DOMI, 3, '6-8', 150, 'RPE 8 · con lastre'), x('Pushdown de tríceps', 3, '8-12', 90, 'RPE 8'), x(CURL, 3, '8-12', 90, 'RPE 8'),
      ] },
      { title: 'Pierna hipertrofia', dow: 4, exercises: [
        x(HIP, 3, '6-8', 150, 'RPE 8', [RUMANO]), x(PRENSA, 3, '6-8', 120, 'RPE 8'), x(CUAD, 3, '8-12', 90, 'RPE 8–9'),
        x(FEM_A, 3, '8-12', 90, 'RPE 8–9'), x(GEM_S, 5, '12-15', 60, 'RPE 8–9'),
      ] },
      { title: 'Empuje hipertrofia', dow: 5, exercises: [
        x(MILITAR_M, 3, '6-8', 150, '75–80% 1RM · RPE 8'), x(INCL_M, 3, '6-8', 150, '75–80% 1RM · RPE 8'), x(FONDOS_P, 3, '8-12', 120, 'RPE 8'),
        x('Cruce de poleas', 3, '12-15', 60, 'RPE 9', [PEC]), x(LAT, 3, '12-15', 60, 'RPE 9'),
      ] },
      { title: 'Tirón hipertrofia', dow: 6, exercises: [
        x(REMO_P, 3, '6-8', 150, 'RPE 8', [REMO_T]), x(JALON_N, 3, '6-8', 120, 'RPE 8'), x('Hiperextensiones', 3, '8-12', 90, 'RPE 8 · banco a 45°'),
        x(FACE, 2, '12-15', 60, 'RPE 9'), x(CURL_I, 3, '8-12', 60, 'RPE 9'),
      ] },
    ],
  },
];

export const templateById = (id: string) => TEMPLATES.find((t) => t.id === id) ?? null;

/** Todos los nombres de ejercicio que usan las plantillas (principales y reemplazos). */
export function templateExerciseNames(t: RoutineTemplate, withOptional = true) {
  const s = new Set<string>();
  for (const d of t.days) {
    if (d.optional && !withOptional) continue;
    for (const e of d.exercises) { s.add(e.name); e.alts.forEach((a) => s.add(a)); }
  }
  return [...s];
}

/** Series semanales por grupo según el catálogo (para mostrar en la ficha de la plantilla). */
export function templateSets(t: RoutineTemplate) {
  return t.days.reduce((n, d) => n + (d.optional ? 0 : d.exercises.reduce((m, e) => m + e.sets, 0)), 0);
}

/** Catálogo compacto para el prompt de la IA. */
export function templatesForPrompt() {
  return TEMPLATES.map((t) => `- id "${t.id}": ${t.name} [${METHOD_LABELS[t.method]}; niveles: ${t.levels.join(', ')}; ${t.daysPerWeek} días] — ${t.forWho} Rol: ${t.role}`).join('\n');
}
