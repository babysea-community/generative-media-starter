export function formatCredits(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(value ?? 0);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong';
}
