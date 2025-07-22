// Tipi TypeScript
export type SupermarketKey = 'conad' | 'pewex' | 'tigre' | 'maurys' | 'doc' | 'mondadori' | 'naturasi' | 'feltrinelli' | 'coin' | 'rinascente' | 'diesel' | 'calvinklein' |'altro'  ;

// Dati supermercati con colori predefiniti
export const supermarketData: Record<SupermarketKey, { name: string; type: string; logo: string; color: string }> = {
  conad: { name: "CONAD", type: "FEDELTÀ", logo: "/cardlogo/conad.png", color: "#FFFFFF" },
  pewex: { name: "PEWEX", type: "FEDELTÀ", logo: "/cardlogo/pewex.png", color: "#2563EB" },
  tigre: { name: "TIGRE", type: "FEDELTÀ", logo: "/cardlogo/tigre.png", color: "#79b61d" },
  maurys: { name: "MAURYS", type: "FEDELTÀ", logo: "/cardlogo/maurys.png", color: "#f5ed66" },
  doc: { name: "DOC", type: "FEDELTÀ", logo: "/cardlogo/doc.png", color: "#FFFFFF" },
  feltrinelli: { name: "FELTRINELLI", type: "FEDELTÀ", logo: "/cardlogo/feltrinelli.png", color: "#FFFFFF" },
  naturasi: { name: "NATURA SI", type: "FEDELTÀ", logo: "/cardlogo/naturasi.png", color: "#5b7711" },
  mondadori: { name: "MONDADORI", type: "FEDELTÀ", logo: "/cardlogo/mondadori.png", color: "#FFFFFF" },
  rinascente: { name: "RINASCENTE", type: "FEDELTÀ", logo: "/cardlogo/rinascente.png", color: "#131313" },
  coin: { name: "COIN", type: "FEDELTÀ", logo: "/cardlogo/coin.png", color: "#FFFFFF" },
  calvinklein: { name: "CALVIN KLEIN", type: "FEDELTÀ", logo: "/cardlogo/calvinklein.png", color: "#FFFFFF" },
  diesel: { name: "DIESEL", type: "FEDELTÀ", logo: "/cardlogo/diesel.png", color: "#FFFFFF" },


  altro: { name: "ALTRO", type: "FEDELTÀ", logo: "❓", color: "green" }
};

// Colori suggeriti per il color picker
export const suggestedColors = [
  '#DC2626', '#EA580C', '#D97706', '#EAB308', '#16A34A', 
  '#059669', '#0891B2', '#2563EB', '#4F46E5', '#7C3AED',
  '#9333EA', '#C2410C', '#DB2777', '#E11D48'
];