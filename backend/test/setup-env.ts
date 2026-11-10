/**
 * Corre antes de cada archivo de test e2e (jest `setupFiles`), antes de que se
 * importe AppModule. Apunta Prisma a la base de PRUEBAS: los tests la vacían
 * en cada corrida, así que jamás deben tocar la de desarrollo.
 *
 * ConfigModule carga `.env` después, pero dotenv no pisa variables que ya
 * existen: lo que se fija acá gana.
 */
const DEFAULT_TEST_DATABASE_URL =
  'postgresql://user:password@localhost:5432/fintrack_test?schema=public';

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
process.env.JWT_SECRET ??= 'jwt-secret-solo-para-tests';

// Seguro contra accidentes: si la URL no apunta a una base con "test" en el
// nombre, se aborta antes de borrar nada.
const dbName = new URL(process.env.DATABASE_URL).pathname;
if (!dbName.includes('test')) {
  throw new Error(
    `Los tests e2e vacían la base de datos y "${dbName}" no parece de pruebas. Abortando.`,
  );
}
