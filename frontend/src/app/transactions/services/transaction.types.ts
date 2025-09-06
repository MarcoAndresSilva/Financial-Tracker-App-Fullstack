export interface GetTransactionsFilterDto {
  walletId: string;
  startDate?: string;
  endDate?: string;
  type?: 'INCOME' | 'EXPENSE';
}
