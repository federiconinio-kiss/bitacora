export type Veredicto = { veredicto: 'adecuada' | 'mejorable' | 'no adecuada'; explicacion: string };
export type Review = {
  resumen: string;
  puntaje: number;
  nivel: Veredicto;
  objetivo: Veredicto;
  volumen_por_grupo: { grupo: string; series_semanales: number; frecuencia_semanal: number; evaluacion: 'bajo' | 'adecuado' | 'alto'; comentario: string }[];
  sugerencias: {
    prioridad: 'alta' | 'media' | 'baja';
    categoria: 'volumen' | 'frecuencia' | 'intensidad' | 'seleccion de ejercicios' | 'orden' | 'progresion' | 'descanso' | 'otro';
    dia: string | null;
    ejercicio: string | null;
    cambio: string;
    motivo: string;
  }[];
  puntos_fuertes: string[];
};
export const METHODOLOGY_LABELS = {
  guia: 'Guía de Fede',
  evidencia: 'Evidencia científica',
  piramide: 'Muscle & Strength Pyramid',
  heavy_duty: 'Heavy Duty',
  ambas: 'Comparar Pirámide y Heavy Duty',
} as const;
