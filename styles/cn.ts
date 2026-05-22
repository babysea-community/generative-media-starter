type ClassDictionary = Record<string, boolean | null | undefined>;
type ClassArray = ClassValue[];

export type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ClassDictionary
  | ClassArray;

export function cn(...inputs: ClassValue[]) {
  return inputs.map(toClassName).filter(Boolean).join(' ');
}

function toClassName(input: ClassValue): string {
  if (!input || typeof input === 'boolean') {
    return '';
  }

  if (typeof input === 'string' || typeof input === 'number') {
    return String(input);
  }

  if (Array.isArray(input)) {
    return input.map(toClassName).filter(Boolean).join(' ');
  }

  return Object.entries(input)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([className]) => className)
    .join(' ');
}
