// Tipi TypeScript
export type SupermarketKey = 'conad' | 'pewex' | 'altro';

// Dati supermercati con colori predefiniti
export const supermarketData: Record<SupermarketKey, { name: string; type: string; logo: string; color: string }> = {
  conad: { name: "CONAD", type: "FEDELTÀ", logo: "/cardlogo/conad.png", color: "#FFFFFF" },
  pewex: { name: "PEWEX", type: "FEDELTÀ", logo: "/cardlogo/pewex.png", color: "#2563EB" },
  altro: { name: "ALTRO", type: "FEDELTÀ", logo: "❓", color: "green" }
};

// Colori suggeriti per il color picker
export const suggestedColors = [
  '#DC2626', '#EA580C', '#D97706', '#EAB308', '#16A34A', 
  '#059669', '#0891B2', '#2563EB', '#4F46E5', '#7C3AED',
  '#9333EA', '#C2410C', '#DB2777', '#E11D48'
];