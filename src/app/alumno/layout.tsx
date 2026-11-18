import { StudentNav } from '@/components/Nav';
import { requireUser } from '@/lib/auth';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { me } = await requireUser('student');
  return (
    <>
      <StudentNav name={me.full_name || me.email} />
      <main className="shell">{children}</main>
    </>
  );
}
