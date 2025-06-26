// src/hooks/useDynamicCategories.ts
import { useMemo } from 'react';
import { useFirestore } from './useFirestore';
import { Category } from '@/lib/models/types';
import { ShoppingItem } from '@/lib/models/shopping-item';

// 🎨 Palette di colori per le categorie dinamiche
const CATEGORY_COLORS = [
  '#E07A5F', // Burnt sienna
  '#3D5A80', // Cambridge blue  
  '#98C1D9', // Light blue
  '#EE9B00', // Orange
  '#BB3E03', // Red
  '#005577', // Dark blue
  '#0A9396', // Teal
  '#94D2BD', // Light teal
  '#F9C74F', // Yellow
  '#F8961E', // Orange yellow
  '#F3722C', // Red orange
  '#277DA1', // Steel blue
];

// 🎯 Icone predefinite per categorie comuni
const CATEGORY_ICONS: Record<string, string> = {
  // Alimentari
  'alimentari': '🛒',
  'cibo': '🍽️',
  'bevande': '🥤',
  'frutta': '🍎',
  'verdura': '🥬',
  'carne': '🥩',
  'pesce': '🐟',
  'dolci': '🍰',
  'snack': '🍿',
  
  // Casa
  'casa': '🏠',
  'cucina': '🍴',
  'bagno': '🛁',
  'pulizia': '🧽',
  'arredamento': '🛋️',
  'giardino': '🌱',
  'fai da te': '🔨',
  
  // Elettronica
  'elettronica': '📱',
  'computer': '💻',
  'telefoni': '📱',
  'audio': '🎧',
  'gaming': '🎮',
  'tv': '📺',
  
  // Abbigliamento
  'abbigliamento': '👕',
  'scarpe': '👟',
  'accessori': '👜',
  'gioielli': '💍',
  
  // Salute e bellezza
  'salute': '💊',
  'bellezza': '💄',
  'cosmetici': '🧴',
  'farmacia': '⚕️',
  
  // Trasporti
  'auto': '🚗',
  'moto': '🏍️',
  'bici': '🚴',
  'trasporti': '🚌',
  
  // Tempo libero
  'sport': '⚽',
  'libri': '📚',
  'musica': '🎵',
  'film': '🎬',
  'hobby': '🎨',
  'viaggi': '✈️',
  
  // Lavoro/Studio
  'ufficio': '📋',
  'scuola': '🎓',
  'cartoleria': '✏️',
  
  // Animali
  'animali': '🐕',
  'pet': '🐱',
  
  // Default
  'altro': '📦',
  'varie': '📦',
  'generale': '📦'
};

export function useDynamicCategories() {
  const { data: shoppingItems, loading: itemsLoading } = useFirestore<ShoppingItem>('shopping_items');
  const { data: staticCategories, loading: categoriesLoading } = useFirestore<Category>('categories');

  const categories = useMemo((): Category[] => {
    // 1. Ottieni categorie statiche 
    const staticCategoriesSorted = (staticCategories || []).sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    // Se non ci sono shopping items, ritorna solo le categorie statiche con count a 0
    if (!shoppingItems || shoppingItems.length === 0) {
      return staticCategoriesSorted.map(cat => 
        new Category(
          cat.id,
          cat.name,
          cat.createdBy,
          cat.createdAt,
          cat.description,
          cat.color,
          cat.icon,
          cat.isDefault,
          0, // itemCount = 0
          cat.updatedAt
        )
      );
    }

    // 2. Calcola il count reale per tutte le categorie (statiche + dinamiche)
    const categoryCount = shoppingItems.reduce((acc, item) => {
      const categoryName = item.category?.trim() || 'Altro';
      acc[categoryName.toLowerCase()] = (acc[categoryName.toLowerCase()] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 3. Aggiorna le categorie statiche con il count reale
    const staticWithRealCount = staticCategoriesSorted.map(cat => 
      new Category(
        cat.id,
        cat.name,
        cat.createdBy,
        cat.createdAt,
        cat.description,
        cat.color,
        cat.icon,
        cat.isDefault,
        categoryCount[cat.name.toLowerCase()] || 0, // itemCount reale
        cat.updatedAt
      )
    );

    // 4. Ottieni nomi delle categorie statiche per evitare duplicati
    const staticCategoryNames = new Set(
      (staticCategories || []).map(cat => cat.name.toLowerCase())
    );

    // 5. Crea categorie dinamiche solo per quelle NON presenti nel DB
    const dynamicCategoryGroups = Object.entries(categoryCount).filter(
      ([categoryName]) => !staticCategoryNames.has(categoryName)
    );

    const dynamicCategories = dynamicCategoryGroups.map(([categoryName, count], index) => {
      const categoryKey = categoryName.toLowerCase();
      
      // Trova icona appropriata
      const icon = CATEGORY_ICONS[categoryKey] || 
                   Object.entries(CATEGORY_ICONS).find(([key]) => 
                     categoryKey.includes(key)
                   )?.[1] || '📦';
      
      // Assegna colore ciclicamente
      const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
      
      // Trova il nome originale (con maiuscole corrette) dal primo item
      const originalName = shoppingItems.find(item => 
        item.category?.toLowerCase() === categoryName
      )?.category || categoryName;
      
      // Crea istanza Category dinamica con indicazione
      return new Category(
        `dynamic_${categoryName.replace(/\s+/g, '_')}`, // id
        originalName, // name con case originale
        'system', // createdBy
        new Date(), // createdAt
        `${count} ${count === 1 ? 'articolo' : 'articoli'} (categoria dinamica)`, // description con indicazione
        color, // color
        icon, // icon
        false, // isDefault
        count, // itemCount reale
        new Date() // updatedAt
      );
    });

    // 6. Ordina le categorie dinamiche per popolarità
    dynamicCategories.sort((a, b) => {
      if (a.itemCount !== b.itemCount) {
        return b.itemCount - a.itemCount; // Più popolari prima
      }
      return a.name.localeCompare(b.name); // Poi alfabeticamente
    });

    // 7. Unisci: prima categorie statiche con count aggiornato, poi dinamiche
    return [...staticWithRealCount, ...dynamicCategories];

  }, [shoppingItems, staticCategories]);

  // ✅ Funzione helper per ottenere una categoria specifica
  const getCategoryByName = (name: string): Category | undefined => {
    return categories.find(cat => cat.name.toLowerCase() === name.toLowerCase());
  };

  // ✅ Funzione helper per ottenere solo le categorie statiche
  const getStaticCategories = (): Category[] => {
    return staticCategories || [];
  };

  // ✅ Funzione helper per ottenere solo le categorie dinamiche
  const getDynamicCategories = (): Category[] => {
    return categories.filter(cat => cat.id.startsWith('dynamic_'));
  };

  // ✅ Funzione helper per ottenere le categorie più popolari
  const getPopularCategories = (limit: number = 5): Category[] => {
    return categories.slice(0, limit);
  };

  // ✅ Funzione helper per ottenere tutte le categorie uniche come stringhe
  const getCategoryNames = (): string[] => {
    return categories.map(cat => cat.name);
  };

  // ✅ Funzione helper per controllare se una categoria è dinamica
  const isDynamicCategory = (categoryId: string): boolean => {
    return categoryId.startsWith('dynamic_');
  };

  return {
    data: categories,
    loading: itemsLoading || categoriesLoading,
    getCategoryByName,
    getStaticCategories,
    getDynamicCategories,
    getPopularCategories,
    getCategoryNames,
    isDynamicCategory,
    totalCategories: categories.length,
    staticCount: staticCategories?.length || 0,
    dynamicCount: categories.length - (staticCategories?.length || 0),
    totalItems: shoppingItems?.length || 0
  };
}