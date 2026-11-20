import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod/v4';

/** Error con un mensaje listo para mostrarle al profe. */
export class AiError extends Error {}

/** Pide a Claude una respuesta con el formato exacto del esquema. */
export async function parseWithClaude<S extends z.ZodType>({ system, prompt, schema, what, maxTokens = 16000 }: {
  system: string; prompt: string; schema: S; what: string; maxTokens?: number;
}): Promise<z.infer<S>> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiError('Falta configurar ANTHROPIC_API_KEY en Vercel para usar la IA.');
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY.trim(), timeout: 280_000, maxRetries: 1 });
  try {
    const response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: maxTokens,
      // Si el modelo declina por error, la API reintenta con otro modelo en el mismo pedido.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high', format: betaZodOutputFormat(schema) },
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    if (response.stop_reason === 'refusal') throw new AiError(`La IA no pudo ${what}. Probá de nuevo.`);
    if (response.stop_reason === 'max_tokens') throw new AiError('La respuesta de la IA salió demasiado larga. Probá de nuevo.');
    if (!response.parsed_output) throw new AiError('La IA devolvió una respuesta incompleta. Probá de nuevo.');
    return response.parsed_output as z.infer<S>;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('La clave de la IA (ANTHROPIC_API_KEY) no es válida. Revisala en Vercel.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError('La cuenta de la IA no tiene permiso o crédito. Revisá la facturación en console.anthropic.com.');
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Se alcanzó el límite de uso de la IA. Esperá un minuto y probá de nuevo.');
    if (e instanceof Anthropic.BadRequestError && /credit|balance/i.test(e.message)) throw new AiError('La cuenta de la IA no tiene crédito. Cargá saldo en console.anthropic.com.');
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new AiError('La IA tardó demasiado en responder. Probá de nuevo.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Error de la IA (${e.status ?? 'sin código'}). Probá de nuevo en un rato.`);
    throw e;
  }
}
