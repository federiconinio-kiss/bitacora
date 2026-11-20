'use client';
import { useEffect, useRef, useState } from 'react';
import type { Food } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase/client';
import { COMMERCIAL_CATEGORY, asFood, findByBarcode, type ProductData } from '@/lib/foodSources';
import { num } from '@/lib/utils';
import Modal from './Modal';

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Escanea un código de barras con la cámara (o se escribe a mano) y devuelve el alimento:
 * el que ya existe en la base, o uno nuevo creado con los datos de Open Food Facts / la etiqueta.
 */
export default function BarcodeScanner({ onClose, onFood }: { onClose: () => void; onFood: (f: Food, created: boolean) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [step, setStep] = useState<'scan' | 'searching' | 'form'>('scan');
  const [camErr, setCamErr] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [product, setProduct] = useState<ProductData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const handled = useRef(false);

  async function handleCode(code: string) {
    const clean = code.replace(/\D/g, '');
    if (handled.current || clean.length < 6) return;
    handled.current = true;
    navigator.vibrate?.(80);
    setStep('searching');
    const r = await findByBarcode(supabaseBrowser(), clean);
    if ('food' in r) { onFood(r.food, false); return; }
    setNotFound(!r.product);
    setProduct(r.product ?? { barcode: clean, name: '', brand: null, kcal: null, protein: null, carbs: null, fat: null, servingGrams: null });
    setStep('form');
  }

  // Cámara: lector nativo si existe (Android/Chrome); si no, ZXing (iPhone/Safari).
  useEffect(() => {
    if (step !== 'scan') return;
    let stop = () => {};
    let cancelled = false;
    (async () => {
      try {
        const Native = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        if (Native) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
          const v = video.current!;
          v.srcObject = stream;
          await v.play();
          const det = new Native({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
          let alive = true;
          const loop = async () => {
            if (!alive || handled.current) return;
            try { const codes = await det.detect(v); if (codes[0]) return handleCode(codes[0].rawValue); } catch { /* sigue */ }
            setTimeout(loop, 250);
          };
          loop();
          stop = () => { alive = false; stream.getTracks().forEach((t) => t.stop()); };
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current!, (res) => {
            if (res) handleCode(res.getText());
          });
          if (cancelled) controls.stop();
          stop = () => controls.stop();
        }
      } catch (e) {
        const name = (e as Error).name;
        setCamErr(name === 'NotAllowedError' ? 'No hay permiso para usar la cámara. Habilitalo en el navegador o escribí el número del código.' : 'No se pudo abrir la cámara. Escribí el número que está debajo de las barras.');
      }
    })();
    return () => { cancelled = true; stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <Modal title={step === 'form' ? 'Producto comercial' : 'Escanear código de barras'} onClose={onClose}>
      {step === 'scan' && (
        <div className="stack">
          {!camErr ? (
            <div className="scanner">
              <video ref={video} muted playsInline aria-label="Cámara" />
              <span className="scanner-line" aria-hidden="true" />
            </div>
          ) : <p className="notice amber" style={{ margin: 0 }}>{camErr}</p>}
          <p className="small muted" style={{ margin: 0 }}>Apuntá la cámara al código de barras del envase.</p>
          <form className="row" style={{ alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); handleCode(manual); }}>
            <div className="field grow"><label htmlFor="bc">O escribí el número</label>
              <input id="bc" className="input" inputMode="numeric" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="7790000000000" /></div>
            <button className="btn primary sm" disabled={manual.replace(/\D/g, '').length < 6}>Buscar</button>
          </form>
        </div>
      )}
      {step === 'searching' && <p className="row"><span className="spinner" /> Buscando el producto…</p>}
      {step === 'form' && product && (
        <ProductForm product={product} notFound={notFound} onSaved={(f) => onFood(f, true)}
          onRetry={() => { handled.current = false; setManual(''); setStep('scan'); }} />
      )}
    </Modal>
  );
}

function ProductForm({ product, notFound, onSaved, onRetry }: { product: ProductData; notFound: boolean; onSaved: (f: Food) => void; onRetry: () => void }) {
  const [f, setF] = useState({
    name: product.name, brand: product.brand ?? '',
    kcal: product.kcal?.toString() ?? '', protein: product.protein?.toString() ?? '', carbs: product.carbs?.toString() ?? '', fat: product.fat?.toString() ?? '',
    serving: product.servingGrams?.toString() ?? '',
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const p = num(f.protein) ?? 0, c = num(f.carbs) ?? 0, g = num(f.fat) ?? 0;
  const calc = Math.round(p * 4 + c * 4 + g * 9);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const kcal = num(f.kcal) ?? (calc || null);
    if (!f.name.trim()) return setErr('Poné el nombre del producto.');
    if (kcal == null) return setErr('Completá las calorías cada 100 g (están en la tabla nutricional del envase).');
    setBusy(true);
    const serving = num(f.serving);
    const name = f.brand.trim() && !f.name.toLowerCase().includes(f.brand.trim().toLowerCase()) ? `${f.name.trim()} (${f.brand.trim()})` : f.name.trim();
    const { data, error } = await supabaseBrowser().from('foods').insert({
      name, category: COMMERCIAL_CATEGORY, kind: 'comercial', barcode: product.barcode, brand: f.brand.trim() || null,
      kcal, protein: p, carbs: c, fat: g, unit_name: serving ? 'porción' : null, unit_grams: serving,
    }).select('*').single();
    setBusy(false);
    if (error) return setErr(error.message.includes('duplicate') ? 'Ya existe un alimento con ese nombre o ese código.' : error.message);
    onSaved(asFood(data as Food));
  }

  return (
    <form className="stack" onSubmit={save}>
      <p className={`notice ${notFound ? 'amber' : 'green'} small`} style={{ margin: 0 }}>
        {notFound ? <>No encontramos el código <b>{product.barcode}</b>. Cargá los datos de la tabla nutricional del envase y queda guardado para todos.</>
          : <>Encontrado en Open Food Facts. Revisá que los valores coincidan con el envase y guardalo.</>}
      </p>
      <div className="field"><label htmlFor="pn">Producto</label><input id="pn" className="input" value={f.name} onChange={set('name')} placeholder="Ej: Yogur bebible frutilla" /></div>
      <div className="field"><label htmlFor="pb">Marca</label><input id="pb" className="input" value={f.brand} onChange={set('brand')} /></div>
      <span className="type">Cada 100 g (o 100 ml)</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <div className="field"><label htmlFor="pk">kcal</label><input id="pk" className="input" inputMode="decimal" value={f.kcal} placeholder={calc ? String(calc) : ''} onChange={set('kcal')} /></div>
        <div className="field"><label htmlFor="pp">Prot.</label><input id="pp" className="input" inputMode="decimal" value={f.protein} onChange={set('protein')} /></div>
        <div className="field"><label htmlFor="pc">Carb.</label><input id="pc" className="input" inputMode="decimal" value={f.carbs} onChange={set('carbs')} /></div>
        <div className="field"><label htmlFor="pg">Grasa</label><input id="pg" className="input" inputMode="decimal" value={f.fat} onChange={set('fat')} /></div>
      </div>
      <div className="field" style={{ maxWidth: 200 }}><label htmlFor="ps">Porción del envase (g)</label><input id="ps" className="input" inputMode="decimal" value={f.serving} onChange={set('serving')} placeholder="opcional" /></div>
      {err && <p className="notice red" style={{ margin: 0 }}>{err}</p>}
      <div className="row wrap">
        <button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : 'Guardar producto'}</button>
        <button type="button" className="btn ghost" onClick={onRetry}>Escanear otro</button>
      </div>
    </form>
  );
}
