import { squadClass } from '@/lib/format';

export function SquadBadge({ squad }: { squad: string | null | undefined }) {
  if (!squad) return null;
  return <span className={`badge ${squadClass(squad)}`}>{squad}</span>;
}
