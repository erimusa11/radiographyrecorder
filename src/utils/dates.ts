import { strings } from '@/constants/strings';

const MONTHS = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'];

/** "Janar", "Shkurt", ... for titles. */
export const MONTH_NAMES = MONTHS.map((name) => name.charAt(0).toUpperCase() + name.slice(1));

const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "18 nëntor 2026" (written by hand because the phone's Albanian locale data is not always installed). */
export function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(ms: number): string {
  return `${formatDate(ms)} · ${formatTime(ms)}`;
}

const dayKey = (d: Date) => d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();

/** "Sot · 14:32", "Dje · 09:10", or the full date for older records. */
export function formatWhen(ms: number, now: number = Date.now()): string {
  const day = new Date(ms);
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(today.getDate() - 1);
  const label =
    dayKey(day) === dayKey(today) ? strings.list.today : dayKey(day) === dayKey(yesterday) ? strings.list.yesterday : formatDate(ms);
  return `${label} · ${formatTime(ms)}`;
}
