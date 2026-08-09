const TEMPLE_TIME_ZONE = "Asia/Kolkata";

type DateValue = Date | string;

function parseDisplayDate(value: DateValue) {
  if (value instanceof Date) return value;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12));
  }
  return new Date(value);
}

/** User-facing temple date format. Data transport and native date inputs remain ISO. */
export function formatDisplayDate(value: DateValue) {
  const date = parseDisplayDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TEMPLE_TIME_ZONE,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")}-${part("month").toUpperCase()}-${part("year")}`;
}

export function formatDisplayTimestamp(value: DateValue) {
  const date = parseDisplayDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: TEMPLE_TIME_ZONE,
  }).format(date);
  return `${formatDisplayDate(date)} ${time.toUpperCase()}`;
}

export function formatAnnualDisplayDate(month: number, day: number, year = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: TEMPLE_TIME_ZONE }).format(new Date()))) {
  const monthLabel = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][month - 1];
  return monthLabel ? `${String(day).padStart(2, "0")}-${monthLabel}-${year}` : "—";
}
