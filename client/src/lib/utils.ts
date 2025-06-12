import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function removeUndefinedFields<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      // Se il valore è un oggetto, applica ricorsivamente la pulizia
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        const cleanedValue = removeUndefinedFields(value);
        // Solo se l'oggetto non è vuoto dopo la pulizia
        if (Object.keys(cleanedValue).length > 0) {
          (cleaned as any)[key] = cleanedValue;
        }
      } else {
        (cleaned as any)[key] = value;
      }
    }
  }
  console.log(cleaned);
  return cleaned;
}

/**
 * Prepara un documento per Firestore rimuovendo campi undefined
 */
export function prepareForFirestore<T extends Record<string, any>>(data: T): Partial<T> {
  return removeUndefinedFields(data);
}
