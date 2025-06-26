// ==============================================================================
// TIPI PER SHOPPING FOOD - FamilyTaskTracker
// ==============================================================================

import { removeUndefinedFields } from '../utils';
import { FirestoreSerializable } from './types';

// ===== CATEGORY FOOD =====
export class CategoryFood implements FirestoreSerializable {
  constructor(
    public id: string,
    public name: string,
    public createdBy: string,
    public createdAt: Date = new Date(),
    public description?: string,
    public color: string = "#81B29A",
    public icon?: string,
    public order: number = 0,
    public updatedAt?: Date
  ) {}

  static fromFirestore(data: any): CategoryFood {
    try {
      const parseDate = (dateField: any): Date => {
        if (!dateField) return new Date();
        if (dateField instanceof Date) return dateField;
        if (typeof dateField === 'object' && dateField.toDate) {
          return dateField.toDate();
        }
        const parsed = new Date(dateField);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
      };

      return new CategoryFood(
        data.id,
        data.name || 'Categoria Senza Nome',
        data.createdBy || 'Unknown',
        parseDate(data.createdAt),
        data.description,
        data.color || "#81B29A",
        data.icon,
        data.order || 0,
        data.updatedAt ? parseDate(data.updatedAt) : undefined
      );
    } catch (error) {
      console.error('Error in CategoryFood.fromFirestore:', error, data);
      return new CategoryFood(
        data.id || 'unknown',
        data.name || 'Categoria Senza Nome',
        data.createdBy || 'Unknown'
      );
    }
  }

  toFirestore() {
    const data = {
      name: this.name,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      description: this.description,
      color: this.color,
      icon: this.icon,
      order: this.order,
      updatedAt: new Date()
    };
    return removeUndefinedFields(data);
  }

  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Nome categoria è obbligatorio');
    }

    if (this.name && this.name.length > 50) {
      errors.push('Nome categoria non può superare 50 caratteri');
    }

    if (!this.createdBy || this.createdBy.trim().length === 0) {
      errors.push('Campo createdBy è obbligatorio');
    }

    if (this.description && this.description.length > 200) {
      errors.push('Descrizione non può superare 200 caratteri');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// ===== SUPERMARKET =====
export class Supermarket implements FirestoreSerializable {
  constructor(
    public id: string,
    public name: string,
    public createdBy: string,
    public createdAt: Date = new Date(),
    public address?: string,
    public city?: string,
    public phone?: string,
    public website?: string,
    public notes?: string,
    public color: string = "#E07A5F",
    public isActive: boolean = true,
    public updatedAt?: Date
  ) {}

  static fromFirestore(data: any): Supermarket {
    try {
      const parseDate = (dateField: any): Date => {
        if (!dateField) return new Date();
        if (dateField instanceof Date) return dateField;
        if (typeof dateField === 'object' && dateField.toDate) {
          return dateField.toDate();
        }
        const parsed = new Date(dateField);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
      };

      return new Supermarket(
        data.id,
        data.name || 'Supermercato Senza Nome',
        data.createdBy || 'Unknown',
        parseDate(data.createdAt),
        data.address,
        data.city,
        data.phone,
        data.website,
        data.notes,
        data.color || "#E07A5F",
        data.isActive !== undefined ? data.isActive : true,
        data.updatedAt ? parseDate(data.updatedAt) : undefined
      );
    } catch (error) {
      console.error('Error in Supermarket.fromFirestore:', error, data);
      return new Supermarket(
        data.id || 'unknown',
        data.name || 'Supermercato Senza Nome',
        data.createdBy || 'Unknown'
      );
    }
  }

  toFirestore() {
    const data = {
      name: this.name,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      address: this.address,
      city: this.city,
      phone: this.phone,
      website: this.website,
      notes: this.notes,
      color: this.color,
      isActive: this.isActive,
      updatedAt: new Date()
    };
    return removeUndefinedFields(data);
  }

  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Nome supermercato è obbligatorio');
    }

    if (this.name && this.name.length > 100) {
      errors.push('Nome supermercato non può superare 100 caratteri');
    }

    if (!this.createdBy || this.createdBy.trim().length === 0) {
      errors.push('Campo createdBy è obbligatorio');
    }

    if (this.website && !this.website.startsWith('http')) {
      errors.push('Website deve iniziare con http:// o https://');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// ===== SHOPPING FOOD ITEM =====
export interface ShoppingFoodItem {
  id: string;
  text: string;
  completed: boolean;
  category?: string;
  assignedAutomatically?: boolean;
  createdAt: Date;
  completedAt?: Date;
  completedBy?: string;
}

// ===== SHOPPING FOOD (Lista completa) =====
export class ShoppingFood implements FirestoreSerializable {
  constructor(
    public id: string,
    public title: string,
    public items: ShoppingFoodItem[] = [],
    public createdBy: string,
    public createdAt: Date = new Date(),
    public supermarketId?: string,
    public isPublic: boolean = false,
    public isCompleted: boolean = false,
    public completedAt?: Date,
    public notes?: string,
    public estimatedTotal?: number,
    public actualTotal?: number,
    public sharedWith: string[] = [],
    public updatedAt?: Date,
    public isDeleted?:boolean
  ) {}

  static fromFirestore(data: any): ShoppingFood {
    try {
      const parseDate = (dateField: any): Date => {
        if (!dateField) return new Date();
        if (dateField instanceof Date) return dateField;
        if (typeof dateField === 'object' && dateField.toDate) {
          return dateField.toDate();
        }
        const parsed = new Date(dateField);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
      };

     const parseItems = (itemsData: any): ShoppingFoodItem[] => {
  // ✅ Gestisce sia array che oggetti con chiavi numeriche
  let itemsArray: any[] = [];
  
  if (Array.isArray(itemsData)) {
    itemsArray = itemsData;
  } else if (itemsData && typeof itemsData === 'object') {
    // Converte oggetto {0: item, 1: item} in array
    itemsArray = Object.values(itemsData);
  } else {
    return [];
  }
  
  
  return itemsArray.map((item, index) => {
    const parsedItem = {
      id: item.id || `item_${index}_${Date.now()}`,
      text: item.text || '',
      completed: Boolean(item.completed),
      category: item.category || 'Altro',
      assignedAutomatically: Boolean(item.assignedAutomatically),
      createdAt: parseDate(item.createdAt),
      completedAt: item.completedAt ? parseDate(item.completedAt) : undefined,
      completedBy: item.completedBy,
      isDeleted: item.isDeleted
    };
    
    return parsedItem;
  });
};

      return new ShoppingFood(
        data.id,
        data.title || `Spesa del ${new Date().toLocaleDateString('it-IT')}`,
        parseItems(data.items),
        data.createdBy || 'Unknown',
        parseDate(data.createdAt),
        data.supermarketId,
        data.isPublic || false,
        data.isCompleted || false,
        data.completedAt ? parseDate(data.completedAt) : undefined,
        data.notes,
        data.estimatedTotal,
        data.actualTotal,
        data.sharedWith || [],
        data.updatedAt ? parseDate(data.updatedAt) : undefined,
        data.isDeleted || false
      );
    } catch (error) {
      console.error('Error in ShoppingFood.fromFirestore:', error, data);
      return new ShoppingFood(
        data.id || 'unknown',
        data.title || `Spesa del ${new Date().toLocaleDateString('it-IT')}`,
        [],
        data.createdBy || 'Unknown'
      );
    }
  }

  toFirestore() {
    const data = {
      title: this.title,
      items: this.items,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      supermarketId: this.supermarketId,
      isPublic: this.isPublic,
      isCompleted: this.isCompleted,
      completedAt: this.completedAt,
      notes: this.notes,
      estimatedTotal: this.estimatedTotal,
      actualTotal: this.actualTotal,
      sharedWith: this.sharedWith,
      updatedAt: new Date(),
      isDeleted: this.isDeleted
    };
    return removeUndefinedFields(data);
  }

  // ===== METODI HELPER PER GESTIONE ITEMS =====

  /**
   * Aggiunge un nuovo item alla lista
   */
  addItem(text: string, category: string = 'Altro', assignedAutomatically: boolean = false): ShoppingFoodItem {
    const capitalizedText = text.trim().charAt(0).toUpperCase() + text.trim().slice(1).toLowerCase();

    const newItem: ShoppingFoodItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text: capitalizedText,
      completed: false,
      category,
      assignedAutomatically,
      createdAt: new Date(),
      completedAt: undefined,
      completedBy: undefined,
    };

    this.items.push(newItem);
    this.updatedAt = new Date();
    return newItem;
  }

  /**
   * Rimuove un item dalla lista
   */
  removeItem(itemId: string): boolean {
    const initialLength = this.items.length;
    this.items = this.items.filter(item => item.id !== itemId);
    
    if (this.items.length < initialLength) {
      this.updatedAt = new Date();
      return true;
    }
    return false;
  }
  

  /**
   * Toggle dello stato completato di un item
   */
  toggleItemCompleted(itemId: string, completedByUser?: string): boolean {
    const item = this.items.find(item => item.id === itemId);
    if (!item) return false;

    item.completed = !item.completed;
    item.completedAt = item.completed ? new Date() : undefined;
    item.completedBy = item.completed ? completedByUser : undefined;
    
    this.updatedAt = new Date();
    return true;
  }

  /**
   * Aggiorna il testo di un item
   */
  updateItemText(itemId: string, newText: string): boolean {
    const item = this.items.find(item => item.id === itemId);
    if (!item) return false;
    const capitalizedText = newText.trim().charAt(0).toUpperCase() + newText.trim().slice(1).toLowerCase();
    item.text = capitalizedText;

    this.updatedAt = new Date();
    return true;
  }

  /**
   * Aggiorna la categoria di un item
   */
  updateItemCategory(itemId: string, newCategory: string): boolean {
    const item = this.items.find(item => item.id === itemId);
    if (!item) return false;

    item.category = newCategory;
    this.updatedAt = new Date();
    return true;
  }

  /**
   * Ottiene items raggruppati per categoria
   */
  getItemsByCategory(): Map<string, ShoppingFoodItem[]> {
    const grouped = new Map<string, ShoppingFoodItem[]>();
    
    this.items.forEach(item => {
      const category = item.category || 'Altro';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(item);
    });
    
    return grouped;
  }

  /**
   * Ottiene statistiche di completamento
   */
  getCompletionStats(): { completed: number; total: number; percentage: number } {
    const total = this.items.length;
    const completed = this.items.filter(item => item.completed).length;
    
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  /**
   * Verifica se tutti gli items della lista sono completati
   */
  areAllItemsCompleted(): boolean {
    return this.items.length > 0 && this.items.every(item => item.completed);
  }

  /**
   * Segna tutta la lista come completata/non completata
   */
  toggleAllItemsCompleted(completed: boolean, completedByUser?: string): void {
    this.items.forEach(item => {
      item.completed = completed;
      item.completedAt = completed ? new Date() : undefined;
      item.completedBy = completed ? completedByUser : undefined;
    });
    
    this.isCompleted = completed;
    this.completedAt = completed ? new Date() : undefined;
    this.updatedAt = new Date();
  }

  /**
   * Ottiene il numero di items per categoria
   */
  getCategoryStats(): Map<string, number> {
    const stats = new Map<string, number>();
    
    this.items.forEach(item => {
      const category = item.category || 'Altro';
      stats.set(category, (stats.get(category) || 0) + 1);
    });
    
    return stats;
  }

  /**
   * Filtra items per stato di completamento
   */
  getItemsByCompletionStatus(completed: boolean): ShoppingFoodItem[] {
    return this.items.filter(item => item.completed === completed);
  }

  /**
   * Cerca items per testo
   */
  searchItems(searchTerm: string): ShoppingFoodItem[] {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return this.items;
    
    return this.items.filter(item => 
      item.text.toLowerCase().includes(term) ||
      (item.category && item.category.toLowerCase().includes(term))
    );
  }

  /**
   * Ordina items per data di creazione
   */
  sortItemsByDate(ascending: boolean = false): ShoppingFoodItem[] {
    return [...this.items].sort((a, b) => {
      const timeA = a.createdAt.getTime();
      const timeB = b.createdAt.getTime();
      return ascending ? timeA - timeB : timeB - timeA;
    });
  }

  /**
   * Duplica un item esistente
   */
  duplicateItem(itemId: string): ShoppingFoodItem | null {
    const originalItem = this.items.find(item => item.id === itemId);
    if (!originalItem) return null;

    return this.addItem(
      `${originalItem.text} (copia)`,
      originalItem.category,
      originalItem.assignedAutomatically
    );
  }

  /**
   * Sposta un item in una categoria diversa
   */
  moveItemToCategory(itemId: string, newCategory: string): boolean {
    return this.updateItemCategory(itemId, newCategory);
  }

  /**
   * Aggiunge múltipli items da una stringa (uno per riga)
   */
  addMultipleItems(itemsText: string, defaultCategory: string = 'Altro'): ShoppingFoodItem[] {
    const lines = itemsText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    const addedItems: ShoppingFoodItem[] = [];
    
    lines.forEach(line => {
      const newItem = this.addItem(line, defaultCategory);
      addedItems.push(newItem);
    });
    
    return addedItems;
  }

  /**
   * Ottiene il riepilogo testuale della lista
   */
  getSummary(): string {
    const stats = this.getCompletionStats();
    const categoriesCount = this.getCategoryStats().size;
    
    return `Lista "${this.title}": ${stats.completed}/${stats.total} completati (${stats.percentage}%) in ${categoriesCount} categorie`;
  }

  /**
   * Pulisce la lista rimuovendo items completati
   */
  clearCompletedItems(): ShoppingFoodItem[] {
    const completedItems = this.items.filter(item => item.completed);
    this.items = this.items.filter(item => !item.completed);
    this.updatedAt = new Date();
    return completedItems;
  }

  /**
   * Conta items per stato
   */
  getItemsCount(): { total: number; completed: number; pending: number } {
    const total = this.items.length;
    const completed = this.items.filter(item => item.completed).length;
    const pending = total - completed;
    
    return { total, completed, pending };
  }

  /**
   * Ottiene items ordinati per categoria e data
   */
  getItemsSortedByCategoryAndDate(): Map<string, ShoppingFoodItem[]> {
    const grouped = this.getItemsByCategory();
    
    // Ordina gli items in ogni categoria per data
    for (const [category, items] of grouped.entries()) {
      grouped.set(category, items.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    }
    
    return grouped;
  }

  /**
   * Verifica se contiene un item con un determinato testo
   */
  hasItemWithText(text: string): boolean {
    return this.items.some(item => 
      item.text.toLowerCase().trim() === text.toLowerCase().trim()
    );
  }

  /**
   * Aggiorna il titolo della lista
   */
  updateTitle(newTitle: string): void {
    this.title = newTitle.trim();
    this.updatedAt = new Date();
  }

  /**
   * Aggiunge note alla lista
   */
  updateNotes(notes: string): void {
    this.notes = notes.trim() || undefined;
    this.updatedAt = new Date();
  }

  /**
   * Imposta il supermercato
   */
  setSupermarket(supermarketId: string): void {
    this.supermarketId = supermarketId;
    this.updatedAt = new Date();
  }

  /**
   * Cambia visibilità della lista
   */
  togglePublic(): void {
    this.isPublic = !this.isPublic;
    this.updatedAt = new Date();
  }

  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.title || this.title.trim().length === 0) {
      errors.push('Titolo lista spesa è obbligatorio');
    }

    if (!this.createdBy || this.createdBy.trim().length === 0) {
      errors.push('Campo createdBy è obbligatorio');
    }

    if (this.estimatedTotal !== undefined && this.estimatedTotal < 0) {
      errors.push('Total stimato non può essere negativo');
    }

    if (this.actualTotal !== undefined && this.actualTotal < 0) {
      errors.push('Total effettivo non può essere negativo');
    }

    // Valida items
    this.items.forEach((item, index) => {
      if (!item.text || item.text.trim().length === 0) {
        errors.push(`Item ${index + 1}: testo è obbligatorio`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// ===== FACTORY FUNCTIONS =====
export class ShoppingFoodFactory {
  static createCategoryFood(data: Partial<CategoryFood>, createdBy: string): CategoryFood {
    return new CategoryFood(
      data.id || `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data.name || 'Nuova Categoria',
      createdBy,
      new Date(),
      data.description,
      data.color || "#81B29A",
      data.icon,
      data.order || 0
    );
  }

  static createSupermarket(data: Partial<Supermarket>, createdBy: string): Supermarket {
    return new Supermarket(
      data.id || `market_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data.name || 'Nuovo Supermercato',
      createdBy,
      new Date(),
      data.address,
      data.city,
      data.phone,
      data.website,
      data.notes,
      data.color || "#E07A5F",
      data.isActive !== undefined ? data.isActive : true
    );
  }

  static createShoppingFood(createdBy: string, title?: string): ShoppingFood {
    const defaultTitle = title || `Spesa del ${new Date().toLocaleDateString('it-IT')}`;
    
    return new ShoppingFood(
      `shopping_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      defaultTitle,
      [],
      createdBy,
      new Date(),
      undefined, // supermarketId
      false, // isPublic
      false, // isCompleted
      undefined, // completedAt
      undefined, // notes
      undefined, // estimatedTotal
      undefined, // actualTotal
      [] // sharedWith
    );
  }
}

// ===== CATEGORIE DEFAULT =====
export const DEFAULT_FOOD_CATEGORIES: Partial<CategoryFood>[] = [
  {
    name: 'Frutta e Verdura',
    description: 'Prodotti freschi di stagione',
    color: '#22C55E', // Verde
    icon: '🥬',
    order: 1
  },
  {
    name: 'Carne e Pesce',
    description: 'Proteine fresche e surgelate',
    color: '#EF4444', // Rosso
    icon: '🥩',
    order: 2
  },
  {
    name: 'Latticini',
    description: 'Latte, formaggi, yogurt',
    color: '#F3F4F6', // Bianco
    icon: '🥛',
    order: 3
  },
  {
    name: 'Pane e Cereali',
    description: 'Pane, pasta, riso, cereali',
    color: '#D97706', // Arancione
    icon: '🍞',
    order: 4
  },
  {
    name: 'Bevande',
    description: 'Acqua, succhi, bevande varie',
    color: '#3B82F6', // Blu
    icon: '🧃',
    order: 5
  },
  {
    name: 'Dolci e Snack',
    description: 'Dolciumi, biscotti, snack',
    color: '#F59E0B', // Giallo
    icon: '🍪',
    order: 6
  },
  {
    name: 'Surgelati',
    description: 'Prodotti congelati',
    color: '#06B6D4', // Azzurro
    icon: '🧊',
    order: 7
  },
  {
    name: 'Casa e Pulizia',
    description: 'Prodotti per la casa e pulizia',
    color: '#8B5CF6', // Viola
    icon: '🧽',
    order: 8
  },
  {
    name: 'Igiene Personale',
    description: 'Saponi, shampoo, cosmetici',
    color: '#EC4899', // Rosa
    icon: '🧴',
    order: 9
  },
  {
    name: 'Altro',
    description: 'Prodotti vari non classificati',
    color: '#6B7280', // Grigio
    icon: '📋',
    order: 10
  }
];

