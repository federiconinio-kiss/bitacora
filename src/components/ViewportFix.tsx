'use client';
import { useEffect } from 'react';

const isField = (el: Element | null) =>
  !!el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || (el as HTMLElement).isContentEditable);

/**
 * iPhone (sobre todo con la app instalada): al cerrar el teclado, a veces las barras fijas
 * (secciones, temporizador, sesión) quedan corridas a mitad de pantalla hasta recargar.
 * - Mientras se escribe, marca <html class="kb-open"> para ocultar la barra de secciones.
 * - Al cerrar el teclado, fuerza a Safari a recalcular la pantalla.
 */
export default function ViewportFix() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    let t: ReturnType<typeof setTimeout> | undefined;

    const resettle = () => {
      // Un scroll "en el lugar" hace que iOS vuelva a ubicar los elementos fijos.
      const y = window.scrollY;
      window.scrollTo(window.scrollX, y + 1);
      requestAnimationFrame(() => {
        window.scrollTo(window.scrollX, y);
        root.classList.add('vv-reflow');
        requestAnimationFrame(() => root.classList.remove('vv-reflow'));
      });
    };

    const onFocusIn = (e: FocusEvent) => {
      if (isField(e.target as Element)) { clearTimeout(t); root.classList.add('kb-open'); }
    };
    const onFocusOut = () => {
      clearTimeout(t);
      // Si el foco pasa a otro campo (siguiente serie), el teclado sigue abierto.
      t = setTimeout(() => {
        if (isField(document.activeElement)) return;
        root.classList.remove('kb-open');
        resettle();
        setTimeout(resettle, 350); // después de la animación del teclado
      }, 80);
    };

    // Respaldo: cuando la ventana visible vuelve a su alto completo, reacomodar.
    let wasSmall = false;
    const onVV = () => {
      if (!vv) return;
      const small = vv.height < window.innerHeight * 0.8;
      if (wasSmall && !small) resettle();
      wasSmall = small;
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    vv?.addEventListener('resize', onVV);
    window.addEventListener('pageshow', resettle);
    return () => {
      clearTimeout(t);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      vv?.removeEventListener('resize', onVV);
      window.removeEventListener('pageshow', resettle);
    };
  }, []);
  return null;
}
