/** Financial events use calendar dates in UTC, consistently on client and server. */
export function dateKey(value: Date | string = new Date()): string {
  return (typeof value === "string" ? value : value.toISOString()).slice(0, 10);
}

export function nextMonthlyDate(value: string, months = 1): string {
  const date = new Date(`${dateKey(value)}T00:00:00.000Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.toISOString();
}
