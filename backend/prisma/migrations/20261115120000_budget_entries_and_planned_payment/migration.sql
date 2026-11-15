-- Paso 81: presupuesto por categoría (montos con fecha y alcance) y "pago
-- mensual habitual" en las deudas de monto libre. Solo agrega: no toca datos.

-- CreateEnum
CREATE TYPE "public"."BudgetScope" AS ENUM ('FROM_MONTH', 'ONLY_MONTH');

-- AlterTable
ALTER TABLE "public"."Debt" ADD COLUMN     "plannedMonthlyPayment" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "public"."BudgetEntry" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "scope" "public"."BudgetScope" NOT NULL,
    "amount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "BudgetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetEntry_categoryId_year_month_scope_key" ON "public"."BudgetEntry"("categoryId", "year", "month", "scope");

-- AddForeignKey
ALTER TABLE "public"."BudgetEntry" ADD CONSTRAINT "BudgetEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

