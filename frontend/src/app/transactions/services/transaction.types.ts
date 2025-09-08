export interface GetTransactionsFilterDto {
  walletId: string;
  startDate?: string;
  endDate?: string;
  type?: 'INCOME' | 'EXPENSE';
  categoryId?: string;
  subcategoryId?: string;
}
