// Sostituisci il contenuto di client/src/lib/auth.ts

import { UserLogin } from "./models/types";
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, hasFirebaseConfig } from '@/lib/firebase';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthState {
  user: UserLogin | null;
  isAuthenticated: boolean;
  loginTime?: number;
}

export interface LoginAttempt {
  username: string;
  timestamp: number;
  count: number;
}

/**
 * Configurazione di sicurezza
 */
const AUTH_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 3,
  LOCKOUT_DURATION: 5 * 60 * 1000, // 5 minuti
  SESSION_DURATION: 8 * 60 * 60 * 1000, // 8 ore
  API_DELAY: 1000,
  STORAGE_KEY: 'familyTaskManager_auth',
  FAILED_ATTEMPTS_KEY: 'familyTaskManager_failedAttempts'
};

/**
 * Manager per cifratura sicura delle password
 */
export class PasswordCrypto {
  private static readonly ENCRYPTION_KEY = import.meta.env.VITE_PASSWORD_ENCRYPTION_KEY;
  
  /**
   * Genera una password sicura
   */
  static generateSecurePassword(length: number = 12): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    const allChars = lowercase + uppercase + numbers + symbols;
    
    let password = '';
    
    // Assicura almeno un carattere di ogni tipo
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Riempie il resto
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Mischia i caratteri
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
  
  /**
   * Cifra una password usando AES-GCM
   */
  static async encryptPassword(password: string): Promise<{ encrypted: string; iv: string }> {
    if (!this.ENCRYPTION_KEY) {
      throw new Error('VITE_PASSWORD_ENCRYPTION_KEY non configurata nel file .env');
    }
    
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    
    // Genera IV random
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Import della chiave
    const keyData = encoder.encode(this.ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
    
    // Cifra
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      passwordData
    );
    
    // Converti in hex string
    const encrypted = Array.from(new Uint8Array(encryptedBuffer))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    
    const ivHex = Array.from(iv)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    
    return { encrypted, iv: ivHex };
  }
  
  /**
   * Decifra una password
   */
  static async decryptPassword(encrypted: string, iv: string): Promise<string> {
    if (!this.ENCRYPTION_KEY) {
      throw new Error('VITE_PASSWORD_ENCRYPTION_KEY non configurata nel file .env');
    }
    
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    // Converti hex string in Uint8Array
    const encryptedArray = new Uint8Array(
      encrypted.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );
    const ivArray = new Uint8Array(
      iv.match(/.{2}/g)!.map(byte => parseInt(byte, 16))
    );
    
    // Import della chiave
    const keyData = encoder.encode(this.ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
    
    // Decifra
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivArray },
      key,
      encryptedArray
    );
    
    return decoder.decode(decryptedBuffer);
  }
}

/**
 * Interfaccia per utente cifrato in Firestore
 */
interface FirestoreUser {
  username: string;
  role: "admin" | "user";
  email: string;
  displayName?: string;
  passwordEncrypted: string;
  passwordIV: string;
  createdAt: Date;
  lastLoginAt?: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * Generatore di credenziali utenti con password sicure
 */
export class UserCredentialGenerator {
  /**
   * Genera credenziali complete per un utente
   */
  static async generateUserCredentials(
    username: string,
    role: "admin" | "user",
    email?: string,
    displayName?: string
  ): Promise<{
    username: string;
    role: "admin" | "user";
    email: string;
    displayName: string;
    password: string; // Password in chiaro (da mostrare una volta sola)
    encryptedData: { passwordEncrypted: string; passwordIV: string };
  }> {
    // Genera password sicura
    const password = PasswordCrypto.generateSecurePassword(16);
    
    // Cifra la password
    const { encrypted, iv } = await PasswordCrypto.encryptPassword(password);
    
    return {
      username,
      role,
      email: email || `${username.toLowerCase()}@familytasktracker.local`,
      displayName: displayName || this.generateDisplayName(username, role),
      password, // Password in chiaro - da mostrare UNA VOLTA SOLA
      encryptedData: {
        passwordEncrypted: encrypted,
        passwordIV: iv
      }
    };
  }
  
  /**
   * Genera un display name appropriato
   */
  private static generateDisplayName(username: string, role: "admin" | "user"): string {
    if (role === 'admin') {
      return `${username} (Amministratore)`;
    }
    
    // Capitalizza il nome
    const capitalized = username.charAt(0).toUpperCase() + username.slice(1);
    return `${capitalized} (Membro della famiglia)`;
  }
}

/**
 * Servizio di autenticazione sicuro
 */
export class AuthService {
  private static readonly STORAGE_KEY = AUTH_CONFIG.STORAGE_KEY;
  private static readonly FAILED_ATTEMPTS_KEY = AUTH_CONFIG.FAILED_ATTEMPTS_KEY;

  /**
   * Carica gli utenti da Firestore e li decifra
   */
  private static async loadUsersFromFirestore(): Promise<UserLogin[]> {
    if (!hasFirebaseConfig || !db) {
      console.warn('Firebase non configurato, impossibile caricare utenti');
      throw new Error('Firebase non configurato');
    }

    try {
      const usersCollection = collection(db, 'users');
      const snapshot = await getDocs(usersCollection);
      
      const users: UserLogin[] = [];
      
      for (const doc of snapshot.docs) {
        const data = doc.data() as FirestoreUser;
        
        try {
          // Decifra la password per la verifica
          const decryptedPassword = await PasswordCrypto.decryptPassword(
            data.passwordEncrypted,
            data.passwordIV
          );
          users.push(new UserLogin(
            data.username,
            data.role,
            data.email,
            decryptedPassword
          ));
        } catch (decryptError) {
          console.error(`Errore nella decifratura password per ${data.username}:`, decryptError);
          // Salta l'utente se non riesce a decifrare
        }
      }

      if (users.length === 0) {
        throw new Error('Nessun utente valido trovato in Firestore');
      }

      return users;
    } catch (error) {
      console.error('❌ Errore nel caricamento utenti da Firestore:', error);
      throw error;
    }
  }

  /**
   * Effettua il login con validazione e controlli di sicurezza
   */
  static async login(credentials: LoginCredentials): Promise<UserLogin> {
    // Simula delay API
    await new Promise(resolve => setTimeout(resolve, AUTH_CONFIG.API_DELAY));

    // Valida input
    const validationErrors = this.validateLoginInput(credentials);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('. '));
    }

    // Controlla blocco temporaneo
    if (this.isUserLocked(credentials.username)) {
      const lockoutTime = Math.ceil(AUTH_CONFIG.LOCKOUT_DURATION / 60000);
      throw new Error(`Account bloccato. Riprova tra ${lockoutTime} minuti.`);
    }

    try {
      // Carica utenti da Firestore
      const users = await this.loadUsersFromFirestore();
      
      // Valida credenziali
      const user = users.find(
        u => u.username === credentials.username && u.password === credentials.password
      );
      
      if (!user) {
        this.recordFailedAttempt(credentials.username);
        const attempts = this.getFailedAttempts(credentials.username);
        const remainingAttempts = AUTH_CONFIG.MAX_LOGIN_ATTEMPTS - attempts.count;
        
        if (remainingAttempts <= 0) {
          throw new Error(`Account bloccato dopo troppi tentativi fallite.`);
        } else {
          throw new Error(`Credenziali non valide. Tentativi rimanenti: ${remainingAttempts}`);
        }
      }

      // Successo: pulisci tentativi falliti
      this.clearFailedAttempts(credentials.username);
      
      // Crea sessione (senza password)
      const authenticatedUser = new UserLogin(
        user.username,
        user.role,
        user.email,
        '' // NEVER store password in session
      );

      const authState: AuthState = {
        user: authenticatedUser,
        isAuthenticated: true,
        loginTime: Date.now()
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(authState));
      
      return authenticatedUser;
      
    } catch (error) {
      // Se è un errore di Firebase/rete, non contare come tentativo fallito
      if (error instanceof Error && error.message.includes('Firebase')) {
        throw new Error('Servizio temporaneamente non disponibile. Riprova più tardi.');
      }
      throw error;
    }
  }

  /**
   * Ottieni la lista degli utenti per la UI (senza password)
   */
  static async getAvailableUsers(): Promise<{username: string, displayName: string, role: string}[]> {
    try {
      const users = await this.loadUsersFromFirestore();
      return users.map(user => ({
        username: user.username,
        displayName: this.getDisplayName(user.username, user.role),
        role: user.role
      }));
    } catch (error) {
      console.error('Errore nel caricamento utenti per UI:', error);
      // Fallback: lista vuota, forzerà un messaggio di errore nell'UI
      return [];
    }
  }

  private static getDisplayName(username: string, role: string): string {
    if (role === 'admin') {
      return `${username} (Amministratore)`;
    }
    return `${username} (Membro della famiglia)`;
  }

  // === METODI STANDARD (invariati) ===

  static logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  static getCurrentUser(): UserLogin | null {
    try {
      const authData = localStorage.getItem(this.STORAGE_KEY);
      if (!authData) return null;

      const authState: AuthState = JSON.parse(authData);
      
      if (this.isSessionExpired(authState)) {
        this.logout();
        return null;
      }
      
      return authState.isAuthenticated ? authState.user : null;
    } catch (error) {
      console.error('Errore nel recupero utente corrente:', error);
      this.logout();
      return null;
    }
  }

  static isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  }

  // === METODI PRIVATI DI SICUREZZA (invariati) ===

  private static validateLoginInput(credentials: LoginCredentials): string[] {
    const errors: string[] = [];
    
    if (!credentials.username?.trim()) {
      errors.push('Username è obbligatorio');
    }
    
    if (!credentials.password?.trim()) {
      errors.push('Password è obbligatoria');
    }
    
    if (credentials.password && credentials.password.length < 6) {
      errors.push('Password troppo corta');
    }
    
    if (credentials.username && !/^[a-zA-Z0-9_-]+$/.test(credentials.username)) {
      errors.push('Username contiene caratteri non validi');
    }
    
    return errors;
  }

  private static isSessionExpired(authState: AuthState): boolean {
    if (!authState.loginTime) return false;
    const sessionAge = Date.now() - authState.loginTime;
    return sessionAge > AUTH_CONFIG.SESSION_DURATION;
  }

  private static isUserLocked(username: string): boolean {
    const attempts = this.getFailedAttempts(username);
    if (attempts.count >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS) {
      const timeSinceLastAttempt = Date.now() - attempts.timestamp;
      return timeSinceLastAttempt < AUTH_CONFIG.LOCKOUT_DURATION;
    }
    return false;
  }

  private static recordFailedAttempt(username: string): void {
    const attempts = this.getFailedAttempts(username);
    const updatedAttempts: LoginAttempt = {
      username,
      timestamp: Date.now(),
      count: attempts.count + 1
    };
    localStorage.setItem(
      `${this.FAILED_ATTEMPTS_KEY}_${username}`, 
      JSON.stringify(updatedAttempts)
    );
  }

  private static getFailedAttempts(username: string): LoginAttempt {
    try {
      const data = localStorage.getItem(`${this.FAILED_ATTEMPTS_KEY}_${username}`);
      if (data) {
        const attempts: LoginAttempt = JSON.parse(data);
        const timeSinceLastAttempt = Date.now() - attempts.timestamp;
        if (timeSinceLastAttempt > AUTH_CONFIG.LOCKOUT_DURATION) {
          this.clearFailedAttempts(username);
          return { username, timestamp: 0, count: 0 };
        }
        return attempts;
      }
    } catch (error) {
      console.error('Errore nel recupero tentativi falliti:', error);
    }
    return { username, timestamp: 0, count: 0 };
  }

  private static clearFailedAttempts(username: string): void {
    localStorage.removeItem(`${this.FAILED_ATTEMPTS_KEY}_${username}`);
  }
}