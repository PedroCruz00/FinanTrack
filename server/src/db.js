import mysql from 'mysql2/promise';

export const dbConfig = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  timezone: 'Z',
  dateStrings: ['DATE'],
  decimalNumbers: true,
};

export const pool = mysql.createPool({
  ...dbConfig,
  database: process.env.DB_NAME ?? 'finantrack',
  connectionLimit: 10,
});

// NOW(3) debe estar en UTC, igual que las fechas que envía Node (timezone: 'Z').
// Sin esto, el pull incremental se desfasa según la zona horaria del servidor MySQL.
pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));

/** Ejecuta fn dentro de una transacción SQL y libera la conexión al terminar. */
export async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
