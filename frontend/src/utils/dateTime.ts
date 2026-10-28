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
  options: Intl.DateTimeFormatOptions = {},
): string {
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: INDIA_TIME_ZONE,
  }).format(date);
}

export function formatIndiaTime(date: Date = new Date(), options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...options,
    timeZone: INDIA_TIME_ZONE,
  }).format(date);
}

export function formatIndiaClock(value?: string | null): string {
  if (!value) return '';
  const s = String(value).trim();
  if (!s || s === '--' || s === '-') return '';

  // 1. ISO string with timestamp (e.g. "2026-10-28T03:56:00.000Z")
  if (s.includes('T') || s.endsWith('Z')) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return formatIndiaTime(d, { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }

  // 2. 12-hour AM/PM format (e.g. "03:56 AM", "09:26 AM", "05:30 PM")
  const match12 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = match12[2];
    const isPM = match12[3].toUpperCase() === 'PM';

    // If recorded by a UTC server (hour < 5 AM, e.g. 03:56 AM UTC -> 09:26 AM IST)
    if (!isPM && h < 5) {
      const totalMinutes = h * 60 + parseInt(m, 10) + 330; // +5h 30m offset
      const h24 = Math.floor(totalMinutes / 60) % 24;
      const istM = totalMinutes % 60;
      const ampm = h24 < 12 ? 'AM' : 'PM';
      let h12 = h24 % 12;
      if (h12 === 0) h12 = 12;
      return `${String(h12).padStart(2, '0')}:${String(istM).padStart(2, '0')} ${ampm}`;
    }

    return `${String(h).padStart(2, '0')}:${m} ${match12[3].toUpperCase()}`;
  }

  // 3. 24-hour HH:MM or HH:MM:SS (e.g. "03:56", "09:26", "17:30")
  const match24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    let h = parseInt(match24[1], 10);
    const m = match24[2];

    // If hour < 5, recorded by a UTC server -> convert to IST (+5h 30m)
    if (h < 5) {
      const totalMinutes = h * 60 + parseInt(m, 10) + 330;
      const h24 = Math.floor(totalMinutes / 60) % 24;
      const istM = totalMinutes % 60;
      const ampm = h24 < 12 ? 'AM' : 'PM';
      let h12 = h24 % 12;
      if (h12 === 0) h12 = 12;
      return `${String(h12).padStart(2, '0')}:${String(istM).padStart(2, '0')} ${ampm}`;
    }

    const ampm = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${String(h12).padStart(2, '0')}:${m} ${ampm}`;
  }

  return s;
}

