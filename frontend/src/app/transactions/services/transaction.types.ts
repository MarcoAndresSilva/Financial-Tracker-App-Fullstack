export interface Transaction {
  id: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string;
  description: string;
  walletId: string;
  subcategoryId: string;
  authorId: string;
  // Presente cuando esta transacción es un pago vinculado a una Deuda/
  // compromiso en cuotas (Paso 60).
  debtId?: string | null;
  // Propiedades de las relaciones que pedimos con 'include'
  subcategory: {
    id: string;
    name: string;
    categoryId: string;
    category: {
      id: string;
      name: string;
      walletId: string;
    };
  };
}
export interface GetTransactionsFilterDto {
  walletId: string;
  startDate?: string;
  endDate?: string;
  type?: 'INCOME' | 'EXPENSE';
  categoryId?: string;
  subcategoryId?: string;
  limit?: number;
}
export interface CreateTransactionDto {
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string; // La enviamos como 'YYYY-MM-DD'
  description: string;
  walletId: string;
  subcategoryId: string;
  // Opcional: vincula este pago a una Deuda/compromiso en cuotas. `null` en
  // un update desvincula el pago sin borrarlo.
  debtId?: string | null;
}

export type UpdateTransactionDto = Partial<CreateTransactionDto>;

export interface BulkMoveTransactionsDto {
  walletId: string;
  transactionIds: string[];
  date: string; // 'YYYY-MM-DD'
}

// Mismo shape que mover, pero crea copias en esa fecha y deja las originales.
export type BulkCopyTransactionsDto = BulkMoveTransactionsDto;
