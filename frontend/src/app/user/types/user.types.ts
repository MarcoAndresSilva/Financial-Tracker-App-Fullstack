// frontend/src/app/user/types/user.types.ts
export interface Wallet {
  id: string;
  name: string;
  type: 'PERSONAL' | 'SHARED';
  // Ahorro previo con el que arranca la wallet (Paso 53). Puede no venir en
  // respuestas viejas; se trata como 0 si falta.
  saldoInicial?: number;
}

export interface WalletMembership {
  id: string;
  role: 'OWNER' | 'MEMBER';
  wallet: Wallet;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  memberships: WalletMembership[];
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
