const KST_TIME_ZONE = "Asia/Seoul";
const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function dateParts(baseDate: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(baseDate);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

export function kstDate(offsetDays = 0, baseDate = new Date()): string {
  const shifted = new Date(baseDate.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const { year, month, day } = dateParts(shifted);
  return `${year}-${month}-${day}`;
}

export function kstWeekday(baseDate = new Date()): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: KST_TIME_ZONE,
    weekday: "short",
  }).format(baseDate);
  return WEEKDAY_MAP[weekday] ?? 0;
}
