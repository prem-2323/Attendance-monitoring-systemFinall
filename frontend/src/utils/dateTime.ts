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
  const shifted = new Date(year, month - 1, day + offsetDays);
  return [
    shifted.getFullYear(),
    String(shifted.getMonth() + 1).padStart(2, '0'),
    String(shifted.getDate()).padStart(2, '0'),
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
