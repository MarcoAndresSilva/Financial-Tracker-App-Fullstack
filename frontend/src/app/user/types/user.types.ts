// frontend/src/app/user/types/user.types.ts
export interface Wallet {
  id: string;
  name: string;
  type: 'PERSONAL' | 'SHARED';
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
