'use client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Food } from './types';

export const RECIPES_CATEGORY = 'Recetas';
export const COMMERCIAL_CATEGORY = 'Alimentos comerciales';

export const asFood = (f: Food): Food => ({
  ...f, kcal: Number(f.kcal), protein: Number(f.protein), carbs: Number(f.carbs), fat: Number(f.fat),
  unit_grams: f.unit_grams == null ? null : Number(f.unit_grams),
  recipe_total_grams: f.recipe_total_grams == null ? null : Number(f.recipe_total_grams),
});

/** Texto de origen: "Receta · Juan Pérez (alumno)", "Comercial · La Serenísima · Fede (profe)". */
export function foodOrigin(f: Food) {
  const who = f.creator_name ? `${f.creator_name} (${f.creator_role === 'student' ? 'alumno' : 'profe'})` : null;
  if (f.kind === 'receta') return ['Receta', who].filter(Boolean).join(' · ');
  if (f.kind === 'comercial') return ['Comercial', f.brand, who].filter(Boolean).join(' · ');
  return who ? `Creado por ${who}` : null;
}

export type ProductData = {
  barcode: string; name: string; brand: string | null;
  kcal: number | null; protein: number | null; carbs: number | null; fat: number | null;
  servingGrams: number | null;
};

const n = (v: unknown) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Math.round(Number(v) * 10) / 10);

/**
 * Busca un producto por código de barras en Open Food Facts (base pública y gratuita).
 * La consulta la hace el navegador del usuario. Valores cada 100 g / 100 ml.
 */
export async function lookupOpenFoodFacts(code: string): Promise<ProductData | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_es,brands,nutriments,serving_quantity`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const d = await res.json();
  if (d.status !== 1 || !d.product) return null;
  const p = d.product, nu = p.nutriments ?? {};
  const kcal = n(nu['energy-kcal_100g']) ?? (nu['energy_100g'] != null ? n(Number(nu['energy_100g']) / 4.184) : null);
  return {
    barcode: code,
    name: (p.product_name_es || p.product_name || '').trim(),
    brand: (p.brands || '').split(',')[0]?.trim() || null,
    kcal, protein: n(nu.proteins_100g), carbs: n(nu.carbohydrates_100g), fat: n(nu.fat_100g),
    servingGrams: n(p.serving_quantity),
  };
}

/** Busca primero en la base de la app (alguien ya lo cargó) y después en Open Food Facts. */
export async function findByBarcode(sb: SupabaseClient, code: string): Promise<{ food: Food } | { product: ProductData | null }> {
  const { data } = await sb.from('foods').select('*').eq('barcode', code).maybeSingle();
  if (data) return { food: asFood(data as Food) };
  try {
    return { product: await lookupOpenFoodFacts(code) };
  } catch {
    return { product: null };
  }
}
