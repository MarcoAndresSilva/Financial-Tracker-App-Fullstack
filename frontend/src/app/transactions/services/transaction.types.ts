export interface Transaction {
  id: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string;
  description: string;
  walletId: string;
  subcategoryId: string;
  authorId: string;
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
}

export type UpdateTransactionDto = Partial<CreateTransactionDto>;

export interface BulkMoveTransactionsDto {
  walletId: string;
  transactionIds: string[];
  date: string; // 'YYYY-MM-DD'
}

// Mismo shape que mover, pero crea copias en esa fecha y deja las originales.
export type BulkCopyTransactionsDto = BulkMoveTransactionsDto;
