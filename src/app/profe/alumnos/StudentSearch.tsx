'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSearch } from '@/components/Icons';

export default function StudentSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  useEffect(() => {
    if (q === initial) return;
    const t = setTimeout(() => router.replace(q ? `/profe/alumnos?q=${encodeURIComponent(q)}` : '/profe/alumnos'), 250);
    return () => clearTimeout(t);
  }, [q, initial, router]);
  return (
    <label className="row" style={{ maxWidth: 420 }}>
      <IconSearch />
      <input className="input" placeholder="Buscar alumno…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar alumno" />
    </label>
  );
}
