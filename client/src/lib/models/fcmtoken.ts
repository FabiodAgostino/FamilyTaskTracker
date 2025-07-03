// client/src/lib/models/fcm-token.ts
import { removeUndefinedFields } from "../utils";
import { FirestoreSerializable } from "./types";

export class FCMToken implements FirestoreSerializable {
  constructor(
    public id: string,
    public token: string,
    public username: string,
    public userAgent: string,
    public deviceType: 'mobile' | 'desktop' | 'tablet' | 'unknown' = 'unknown',
    public isActive: boolean = true,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
    public lastUsedAt: Date = new Date(),
    public expiresAt?: Date
  ) {}

  static fromFirestore(data: any): FCMToken {
    return new FCMToken(
      data.id,
      data.token,
      data.username,
      data.userAgent,
      data.deviceType || 'unknown',
      data.isActive !== undefined ? data.isActive : true,
      data.createdAt?.toDate() || new Date(),
      data.updatedAt?.toDate() || new Date(),
      data.lastUsedAt?.toDate() || new Date(),
      data.expiresAt?.toDate()
    );
  }

  toFirestore() {
    const data = {
      token: this.token,
      username: this.username,
      userAgent: this.userAgent,
      deviceType: this.deviceType,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastUsedAt: this.lastUsedAt,
      expiresAt: this.expiresAt
    };
    return removeUndefinedFields(data);
  }

  // Verifica se il token è scaduto
  isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  // Verifica se il token è ancora valido
  isValid(): boolean {
    return this.isActive && !this.isExpired();
  }

  // Aggiorna la data di ultimo utilizzo
  updateLastUsed(): void {
    this.lastUsedAt = new Date();
    this.updatedAt = new Date();
  }

  // Marca il token come inattivo
  deactivate(): void {
    this.isActive = false;
    this.updatedAt = new Date();
  }

  // Ottiene informazioni sul dispositivo dal userAgent
  static detectDeviceType(userAgent: string): 'mobile' | 'desktop' | 'tablet' | 'unknown' {
    const ua = userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipod|blackberry|windows phone/.test(ua)) {
      return 'mobile';
    }
    
    if (/tablet|ipad/.test(ua)) {
      return 'tablet';
    }
    
    if (/desktop|windows|macintosh|linux/.test(ua)) {
      return 'desktop';
    }
    
    return 'unknown';
  }

  // Genera una data di scadenza (default: 30 giorni)
  static getDefaultExpirationDate(days: number = 30): Date {
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + days);
    return expiration;
  }
}