const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const currencyFormatterCents = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCurrency(amount: number, { cents = false } = {}) {
  return cents ? currencyFormatterCents.format(amount) : currencyFormatter.format(amount);
}

export function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function daysUntil(iso: string) {
  const target = Date.parse(`${iso.slice(0, 10)}T00:00:00.000Z`);
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  return Math.round((target - today) / 86_400_000);
}

export function formatRelativeDay(iso: string) {
  const diffDays = daysUntil(iso);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1 && diffDays <= 6) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -6) return `${Math.abs(diffDays)} days ago`;
  return formatShortDate(iso);
}
