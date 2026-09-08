import { differenceInMilliseconds } from 'date-fns';
import { getBranchTimezone } from '@/config/branch';

const CASH_REGISTER_OVERDUE_HOURS = 12;

export function isCashRegisterOverdue(
  openedAt: Date | string,
  thresholdHours = CASH_REGISTER_OVERDUE_HOURS
): boolean {
  const opened = new Date(openedAt);
  const now = new Date();
  return differenceInMilliseconds(now, opened) >= thresholdHours * 60 * 60 * 1000;
}

function formatDateInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isCashRegisterFromPreviousDay(
  openedAt: Date | string,
  timeZone = getBranchTimezone()
): boolean {
  const opened = new Date(openedAt);
  const now = new Date();
  const openedDate = formatDateInTimezone(opened, timeZone);
  const today = formatDateInTimezone(now, timeZone);
  return openedDate !== today;
}
