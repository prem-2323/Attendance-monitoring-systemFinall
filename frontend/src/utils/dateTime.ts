const INDIA_TIME_ZONE = 'Asia/Kolkata';

export function getIndiaDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: INDIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getIndiaDateOffsetString(offsetDays: number): string {
  const [year, month, day] = getIndiaDateString().split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return [
    shifted.getUTCFullYear(),
    String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    String(shifted.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function formatIndiaDate(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('en-IN', {
    ...options,
    timeZone: INDIA_TIME_ZONE,
  }).format(date);
}

export function formatIndiaTime(date: Date, options: Intl.DateTimeFormatOptions): string {
  return formatIndiaDate(date, options);
}

export function formatIndiaClock(value?: string | null): string {
  if (!value || !value.includes('T')) return value || '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatIndiaTime(date, { hour: '2-digit', minute: '2-digit' });
}
