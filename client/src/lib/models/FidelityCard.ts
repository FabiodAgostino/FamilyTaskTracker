import { removeUndefinedFields } from '../utils';
import { FirestoreSerializable } from './types';

export class FidelityCard implements FirestoreSerializable {
  constructor(
    public id: string,
    public name: string,
    public number: string,
    public brand: string,
    public logo: string,
    public barcode: string,
    public priority: number,
    public lastUsed: Date,
    public isPublic:boolean,
    public createdAt: Date = new Date(),
    public updatedAt?: Date | undefined,
    public createdBy?: string,
    public color?: string
  ) {}

  static fromFirestore(data: any): FidelityCard {
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

      return new FidelityCard(
        data.id,
        data.name || 'Carta Senza Nome',
        data.number || '',
        data.brand || 'Brand Sconosciuto',
        data.logo || '💳',
        data.barcode || '',
        data.priority || 0,
        parseDate(data.lastUsed),
        data.isPublic,
        parseDate(data.createdAt),
        data.updatedAt ? parseDate(data.updatedAt) : undefined,
        data.createdBy,
        data.color
      );
    } catch (error) {
      console.error('Error in FidelityCard.fromFirestore:', error, data);
      return new FidelityCard(
        data.id || 'unknown',
        data.name || 'Carta Senza Nome',
        data.number || '',
        data.brand || 'Brand Sconosciuto',
        data.logo || '💳',
        data.barcode || '',
        data.priority || 0,
        new Date(),
        data.isPublic,
        new Date(),
        undefined,
        data.createdBy,
        data.color
      );
    }
  }

  toFirestore(): Record<string, any> {
    const data = {
      name: this.name,
      number: this.number,
      brand: this.brand,
      logo: this.logo,
      barcode: this.barcode,
      priority: this.priority,
      lastUsed: this.lastUsed,
      isPublic: this.isPublic,
      createdAt: this.createdAt,
      updatedAt: new Date(),
      createdBy: this.createdBy,
      color:this.color
    };
    return removeUndefinedFields(data);
  }

  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Nome carta è obbligatorio');
    }

    if (this.name && this.name.length > 100) {
      errors.push('Nome carta non può superare 100 caratteri');
    }

    if (!this.number || this.number.trim().length === 0) {
      errors.push('Numero carta è obbligatorio');
    }

    if (!this.brand || this.brand.trim().length === 0) {
      errors.push('Brand carta è obbligatorio');
    }

    if (!this.barcode || this.barcode.trim().length === 0) {
      errors.push('Barcode carta è obbligatorio');
    }

    if (this.priority < 0) {
      errors.push('Priorità non può essere negativa');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Incrementa la priorità quando la carta viene usata
  incrementPriority() {
    this.priority += 1;
    this.lastUsed = new Date();
    this.updatedAt = new Date();
    return this;
  }

  // Ottieni data formattata dell'ultimo uso
  getFormattedLastUsed() {
    return this.lastUsed.toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  // Ottieni il numero di carta mascherato
  getMaskedNumber() {
    if (this.number.length <= 4) return this.number;
    const visibleDigits = this.number.slice(-4);
    const maskedPart = '**** **** **** ';
    return maskedPart + visibleDigits;
  }

  // Verifica se la carta è nuova (usata meno di 3 volte)
  isNew() {
    return this.priority < 3;
  }

  // Verifica se la carta è popolare (usata più di 10 volte)
  isPopular() {
    return this.priority >= 10;
  }

  // Metodo statico per ordinare le carte per priorità
  static sortByPriority(cards: Array<FidelityCard>) {
    return cards.sort((a, b) => {
      // Prima ordina per priorità (decrescente)
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    });
  }

  // Metodo statico per creare carte di esempio
  static createSampleCards() {
    return [
      new FidelityCard(
        "dsadsadsa",
        "CONAD INSIEME",
        "2847 3951 6208 1537",
        "CONAD",
        "🛒",
        "2847395162081537",
        5,
        new Date('2024-12-10'),
        true
      )
    ];
  }
}

// ===== FACTORY FUNCTION =====
export class FidelityCardFactory {
  static createFidelityCard(data: Partial<FidelityCard>, createdBy?: string): FidelityCard {
    return new FidelityCard(
      data.id || `card_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data.name || 'Nuova Carta',
      data.number || '',
      data.brand || '',
      data.logo || '💳',
      data.barcode || '',
      data.priority || 0,
      data.lastUsed || new Date(),
      data.isPublic || false,
      new Date(),
      undefined,
      createdBy,
      data.color
    );
  }
}