import 'server-only';
// Resumen de la "Guía de hipertrofia" de Fede (Notion) para la IA.
// Si la guía cambia en Notion, actualizar este texto y src/lib/templates.ts.

export const GUIDE_PRINCIPLES = `MARCO "Guía de hipertrofia de Fede". Es la guía propia de Fede, basada en The Muscle and Strength Pyramid (Helms, Valdez y Morgan) con sus propias reglas. Cuando uses este marco, evaluá la rutina como la evaluaría Fede con su guía y citá la regla concreta de la guía en el motivo de cada sugerencia (por ejemplo "Guía: el rumano nunca al fallo").

Nivel según cómo progresa, no según los años: principiante = sube carga o reps casi cada sesión (cuerpo completo 3 días); intermedio = progresa semana a semana (torso / pierna 4 días, día A pesado y día B de volumen); avanzado = progresa de un bloque al siguiente (5 días: torso y pierna de fuerza + empuje, tracción y pierna de volumen).

Principios en orden de importancia:
1. Adherencia: realista para los días y el tiempo, disfrutable y flexible. Una rutina que se cumple le gana a una "óptima" que se abandona.
2. Volumen, intensidad y frecuencia:
   - 10 a 20 series efectivas por músculo por semana. Principiantes cerca del extremo bajo (8–12), intermedios 12–16, avanzados 14–20 y más en prioritarios.
   - La mayor parte del trabajo entre 6 y 12 reps; 12–20/30 también sirve cerca del fallo, 3–6 suma fuerza.
   - La mayoría de las series a RIR 1–3. El fallo (RIR 0) se reserva para aislamientos y la última serie; en press plano, sentadilla hack y peso muerto rumano quedarse en RIR 1–2. El peso muerto rumano nunca al fallo. Fallo real solo en máquinas, Smith, poleas o con compañero.
   - Cada músculo al menos 2 veces por semana.
   - Más allá de ~10 series duras para un músculo en la misma sesión, cada serie extra suma poco.
3. Progresión por nivel:
   - Principiante: progresión doble (todas las series al tope del rango con el RIR indicado → subir lo mínimo: 2,5–5 kg piernas, 1–2,5 kg el resto, y volver al piso del rango). Primeras 2–3 semanas RIR 3 en compuestos. Sin descarga planificada mientras progrese.
   - Intermedio: bloques de 5–6 semanas; días pesados subiendo carga semana a semana, días de volumen con progresión doble; +1 serie por semana a rezagados sin pasar de ~20; descarga en la última semana.
   - Avanzado: acumulación 4–5 semanas (8–15 reps, +1 serie por semana, RIR de 3 a 1) → intensificación 3–4 semanas (compuestos 5–8, RIR 1–2) → descarga. Autorregulación por RIR. Especialización: 18–22 series en el rezagado y 6–8 de mantenimiento en otros.
   - Descarga: mitad de las series, mismas cargas, RIR 3–4, cada 4–8 semanas o cuando el rendimiento cae 2–3 sesiones seguidas.
4. Selección de ejercicios: compuestos + aislamientos, rango completo con buen estiramiento, cubrir todas las funciones de cada músculo y mantener los ejercicios durante el bloque para medir.
5. Descansos: 2–3 min o más en compuestos pesados, 1–2 min en aislamientos.
6. Tempo: controlar la bajada y subir con intención, sin contar segundos.

Anatomía (para revisar la selección de ejercicios):
- Espalda: trabaja el músculo que sigue la línea del codo. Codo pegado tirando hacia la cadera = dorsal ancho (ancho, forma en V); codo abierto tirando hacia el pecho = romboides, trapecio medio y deltoides posterior (grosor). Jalones y dominadas = dorsal (dorsal alto y redondo mayor con agarre medio o neutro, pullover y jalón unilateral, estiramiento completo arriba). Remos = espalda media y alta; el remo unilateral con codo pegado es el que más dorsal suma.
- Bíceps: cabeza larga con el brazo detrás del cuerpo (curl inclinado, bayesiano); cabeza corta con el brazo adelante (predicador, araña, concentrado); braquial con agarre neutro o prono (martillo). Lo ideal es un curl de cada tipo.
- Tríceps: la cabeza larga necesita el brazo por encima de la cabeza: incluir al menos una extensión sobre la cabeza. Lateral y medial con poleas, fondos y press cerrado.
- Piernas: cuádriceps con hack (mejor principal), prensa y sillón; pies bajos y juntos = más cuádriceps, pies altos y anchos = más glúteo y aductores; torso recto en búlgara = cuádriceps, inclinado = glúteo. Femorales necesitan una bisagra (rumano) además de un curl; el curl sentado los trabaja estirados. Glúteos: rumano, hip thrust, búlgara. Aductores: máquina y sentadillas profundas.
- Pecho: superior con inclinado a 30–45° y cruces de abajo hacia arriba; medio con press plano y peck deck; inferior con fondos y cruces de arriba hacia abajo. Press con agarre neutro mejor como segundo press.
- Hombros: el anterior ya trabaja en los press de pecho; el lateral da el ancho y se prioriza con 10–20 series semanales de elevaciones laterales (polea o inclinada mantienen tensión abajo); el posterior con pájaro, peck deck invertido, face pull y remos con codo abierto.

Notas de Fede para el entrenador: registrar carga y reps de cada serie; con poco tiempo se recortan primero los aislamientos del final, no los compuestos; ante molestias o falta de equipamiento cambiar por equivalentes según la anatomía; para priorizar un músculo, sumar series en el día de volumen antes que agregar un día.

Otros métodos de la guía (válidos como bloques): Push Pull Legs 6 días (15–20 series, frecuencia 2, para intermedios y avanzados con tiempo y buena recuperación); Weider 5 días (frecuencia 1, 13–15 series por sesión, variedad y motivación, no para principiantes); Heavy Duty (1 serie efectiva al fallo por ejercicio, pre-agotamiento, 3–10 series por músculo por semana: intensificación de 4–6 semanas o temporadas con poco tiempo, no como método permanente); foco glúteos y piernas (glúteo 16–20 series directas, femorales y cuádriceps 10–12, espalda 12, hombro lateral y posterior 10–12, pecho 4 y brazos 0–2 en mantenimiento).`;

export const GUIDE_STRATEGY = `ESTRATEGIA DE FEDE PARA COMBINAR MÉTODOS

Qué aporta cada método:
- Método de la guía (principiante 3 días, intermedia 4 días, avanzada 5 días): la base, desarrollo y progresión planificada; el método al que siempre se vuelve.
- Push Pull Legs 6 días: volumen alto para quien tiene tiempo y buena recuperación.
- Weider 5 días: variedad y motivación, foco y bombeo por músculo.
- Heavy Duty: intensificación y temporadas con poco tiempo; cortar la fatiga después de bloques de mucho volumen.
- Foco glúteos y piernas: especialización cuando hay una zona prioritaria.
- Planes de fuerza (powerlifting) por nivel: cuando el objetivo es fuerza máxima en sentadilla, banca y peso muerto. Planes de hipertrofia por nivel (torso / pierna 4 días principiante, 5 días intermedio): alternativas al método de la guía con otra cantidad de días.

Reglas para combinar sin perder progreso:
1. Bloques de al menos 4–6 semanas (Heavy Duty 4–6; el resto 6–8). Cambiar de método cada semana impide medir.
2. Ejercicios ancla que se mantienen en todos los bloques (por ejemplo sentadilla hack, press inclinado, jalón o dominada, peso muerto rumano y elevaciones laterales) para comparar el progreso.
3. Descarga entre bloques: mitad de las series y RIR 3–4, o semana libre después de Heavy Duty.
4. Transiciones graduales: de Heavy Duty a volumen, la primera semana con ~2/3 de las series y RIR 2–3; de volumen a Heavy Duty, las primeras sesiones sirven para encontrar las cargas de fallo.
5. Alternar el estímulo: después de volumen, intensidad, y viceversa; después de frecuencia alta, frecuencia baja.
6. Cambia el método, no la base: registro, progresión, sueño y alimentación siguen igual.

Ruta por nivel (el nivel se define por qué tan rápido progresa):
- Básico: base Rutina principiante 3 días; complemento Heavy Duty básico (bloque de 4–8 semanas para aprender el fallo, o semanas con solo 2 días). Pasa a intermedio cuando la progresión sesión a sesión se frena 3–4 semanas pese a dormir y comer bien, tiene técnica sólida en los anclas y estima bien el RIR.
- Intermedio: base Rutina intermedia 4 días; complementos Weider, Heavy Duty intermedio, foco glúteos, Push Pull Legs si puede ir 6 días. Pasa a avanzado cuando solo progresa de un bloque al siguiente y necesita 15 o más series en los prioritarios.
- Avanzado: base Rutina avanzada 5 días o Push Pull Legs 6 días; complementos Heavy Duty avanzado como intensificación, Weider como variedad, especializaciones.
- Camino típico: meses 0–3 principiante; meses 3–4 Heavy Duty básico 4–6 semanas; meses 4–9 principiante; meses 9–12 intermedia; años 1–3 rotación intermedia; año 3 en adelante rotación avanzada. Tiempos orientativos; tras un parón largo se puede retroceder un nivel unas semanas.

Rotación de bloques:
- Básico: cambiar poco; mantener la Rutina principiante, rotar variantes cada 8–12 semanas (hack ↔ prensa, Hammer ↔ Smith, jalón ↔ dominada asistida) y Heavy Duty básico en semanas de 2 días.
- Intermedio (26 semanas): 1–6 intermedia 4 días · 7 descarga · 8–13 Weider (variante con más frecuencia) · 14 descarga · 15–19 Heavy Duty intermedio · 20 semana libre o liviana · 21–26 intermedia 4 días comparando anclas con la semana 6.
- Avanzado (26 semanas): 1–6 avanzada 5 días · 7 descarga · 8–13 Push Pull Legs · 14 descarga · 15–18 Heavy Duty avanzado · 19 liviana · 20–25 avanzada o especialización (por ejemplo foco glúteos) · 26 descarga.
- El método base se repite al menos una vez cada 6 meses.

Según la situación del alumno:
- Poco tiempo (trabajo, viajes, exámenes) → Heavy Duty (2–3 sesiones de 40 min).
- Aburrimiento o falta de motivación → Weider (la adherencia manda).
- Mucho tiempo y buena recuperación → Push Pull Legs.
- Estancado después de varios bloques de volumen → Heavy Duty 4–6 semanas.
- Estancado después de Heavy Duty → método de la guía o Push Pull Legs (le falta volumen).
- Articulaciones cargadas o estrés alto → Heavy Duty en máquinas.
- Prioridad glúteos y piernas → foco glúteos y piernas.
- Vuelta después de más de un mes sin entrenar → principiante o Heavy Duty básico, 2–4 semanas.

Cómo medir si funciona:
- Anclas: mejor serie (carga × reps) de cada ancla al final de cada bloque.
- Adherencia: % de sesiones cumplidas por bloque; si con un método cae por debajo del 75%, no es el método para ese alumno en ese momento.
- Señales de exceso: rendimiento que cae 2 o más sesiones seguidas, mal sueño o dolores articulares → descarga o un bloque de Heavy Duty.
- Checklist de fin de mesociclo (motivación, sueño, rendimiento, estrés, dolores): con 2 o más "sí", descarga inmediata; tras 3 mesociclos seguidos sin descargar, descarga obligatoria.`;
