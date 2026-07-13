export function formatPlace(place: number | null | undefined, fleetSize?: number) {
  if (place == null || Number.isNaN(place)) return '—';
  const ord = ordinal(place);
  if (fleetSize && fleetSize > 0) return `${ord} of ${fleetSize}`;
  return ord;
}

export function ordinal(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function squadClass(squad: string | null | undefined) {
  if (squad === 'Nat A') return 'badge-a';
  if (squad === 'Nat B') return 'badge-b';
  if (squad === 'DS') return 'badge-ds';
  return 'badge-muted';
}
