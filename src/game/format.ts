const wholeFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

export function formatHudNumber(value: number, maxFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '0';
  const factor = Math.pow(10, maxFractionDigits);
  const rounded = Math.round(value * factor) / factor;
  if (Math.abs(rounded - Math.trunc(rounded)) < 1e-9) {
    return wholeFormatter.format(Math.trunc(rounded));
  }
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  }).format(rounded);
}

export function formatHudFixed(value: number, fractionDigits = 2): string {
  if (!Number.isFinite(value)) return (0).toFixed(fractionDigits);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
