-- Paso 77: deudas en dos tipos (en cuotas / monto libre) y vinculadas a una
-- subcategoría. Se parte de cero con las deudas: el modelo anterior no tiene
-- cómo llenar los campos nuevos obligatorios (tipo, subcategoría). Los gastos
-- que eran pagos NO se borran; solo pierden el vínculo manual (debtId), que
-- desaparece: ahora un pago es todo gasto en la subcategoría de la deuda.
DELETE FROM "public"."Debt";

-- CreateEnum
CREATE TYPE "public"."DebtKind" AS ENUM ('INSTALLMENTS', 'FREE_AMOUNT');

-- CreateEnum
CREATE TYPE "public"."AmountUnit" AS ENUM ('CLP', 'UF');

-- DropForeignKey
ALTER TABLE "public"."Transaction" DROP CONSTRAINT "Transaction_debtId_fkey";

-- AlterTable
ALTER TABLE "public"."Debt" DROP COLUMN "startDate",
ADD COLUMN     "installmentValue" DOUBLE PRECISION,
ADD COLUMN     "kind" "public"."DebtKind" NOT NULL,
ADD COLUMN     "nextDueDateAtStart" DATE,
ADD COLUMN     "subcategoryId" TEXT NOT NULL,
ADD COLUMN     "unit" "public"."AmountUnit",
ALTER COLUMN "totalAmount" DROP NOT NULL,
ALTER COLUMN "totalInstallments" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Transaction" DROP COLUMN "debtId";

-- CreateIndex
CREATE UNIQUE INDEX "Debt_subcategoryId_key" ON "public"."Debt"("subcategoryId");

-- AddForeignKey
ALTER TABLE "public"."Debt" ADD CONSTRAINT "Debt_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "public"."Subcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

