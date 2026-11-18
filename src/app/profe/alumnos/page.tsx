import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import type { Profile, Routine } from '@/lib/types';
import { fmtDate, initials } from '@/lib/utils';
import NewStudent from './NewStudent';
import StudentSearch from './StudentSearch';

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ nuevo?: string; q?: string }> }) {
  const { nuevo, q } = await searchParams;
  const { sb, me } = await requireUser('trainer');
  const [{ data: studs }, { data: routines }, { data: pend }] = await Promise.all([
    sb.from('profiles').select('*').eq('trainer_id', me.id).order('full_name'),
    sb.from('routines').select('id,student_id,name,published,start_date').order('start_date', { ascending: false }),
    sb.from('progression_requests').select('student_id').eq('status', 'pending'),
  ]);
  let students = (studs ?? []) as Profile[];
  if (q) {
    const n = q.toLowerCase();
    students = students.filter((s) => s.full_name.toLowerCase().includes(n) || s.email.toLowerCase().includes(n));
  }
  const rs = (routines ?? []) as Pick<Routine, 'id' | 'student_id' | 'name' | 'published' | 'start_date'>[];
  const pendCount = new Map<string, number>();
  (pend ?? []).forEach((p: { student_id: string }) => pendCount.set(p.student_id, (pendCount.get(p.student_id) ?? 0) + 1));

  return (
    <div className="stack-lg">
      <div className="row between wrap">
        <h1 className="h-hand">Alumnos <span className="type">({students.length})</span></h1>
        <NewStudent openInitially={nuevo === '1'} />
      </div>
      <StudentSearch initial={q ?? ''} />

      {students.length === 0 ? (
        <div className="sheet empty">
          <span className="tape" />
          <p className="ink">{q ? 'No encontramos alumnos con esa búsqueda.' : 'Todavía no tenés alumnos.'}</p>
          {!q && <p className="muted">Dalos de alta con el botón “Nuevo alumno”.</p>}
        </div>
      ) : (
        <section className="sheet plain scroll-x">
          <table className="ledger">
            <thead><tr><th>Alumno</th><th className="hide-mobile">Email</th><th>Rutina</th><th>Estado</th></tr></thead>
            <tbody>
              {students.map((s) => {
                const r = rs.find((x) => x.student_id === s.id && x.published) ?? rs.find((x) => x.student_id === s.id);
                return (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/profe/alumnos/${s.id}`} className="row" style={{ textDecoration: 'none', color: 'inherit', gap: 10 }}>
                        <span className="avatar">{initials(s.full_name, s.email[0]?.toUpperCase())}</span>
                        <span>
                          <b>{s.full_name || '(sin nombre)'}</b>
                          {s.age && <span className="type"> · {s.age} años</span>}
                          {!!pendCount.get(s.id) && <> <span className="badge" title="Subidas pendientes">{pendCount.get(s.id)}</span></>}
                        </span>
                      </Link>
                    </td>
                    <td className="hide-mobile type">{s.email}</td>
                    <td>{r ? <>{r.name} {!r.published && <span className="tag amber">borrador</span>}<div className="type">{fmtDate(r.start_date)}</div></> : <span className="muted">—</span>}</td>
                    <td>{s.active ? <span className="tag green">activo</span> : <span className="tag red">pausado</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
