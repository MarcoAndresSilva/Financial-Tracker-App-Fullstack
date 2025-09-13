export interface GetTransactionsFilterDto {
  walletId: string;
  startDate?: string;
  endDate?: string;
  type?: 'INCOME' | 'EXPENSE';
  categoryId?: string;
  subcategoryId?: string;
}
export interface CreateTransactionDto {
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  date: string; // La enviamos como 'YYYY-MM-DD'
  description: string;
  walletId: string;
  subcategoryId: string;
}
