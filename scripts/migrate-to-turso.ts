/**
 * migrate-to-turso.ts
 * Exporta todos os dados do crm.db local para o Turso.
 *
 * Uso:
 *   1. Adicione TURSO_DATABASE_URL e TURSO_AUTH_TOKEN no .env
 *   2. Execute: npx tsx scripts/migrate-to-turso.ts
 */
import Database from "better-sqlite3";
import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("❌  Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN no .env antes de migrar.");
  process.exit(1);
}

const local = new Database("crm.db");
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const TABLES = ["accounts", "deals", "invoices", "costs", "activities", "settings", "users"] as const;

async function migrate() {
  console.log("🚀  Iniciando migração local → Turso...\n");

  for (const table of TABLES) {
    const rows = local.prepare(`SELECT * FROM ${table}`).all() as Record<string, any>[];
    if (rows.length === 0) {
      console.log(`  ⬜  ${table}: nenhum registro`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => "?").join(", ");
    const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;

    for (const row of rows) {
      const args = columns.map((col) => {
        const val = row[col];
        return val === undefined ? null : val;
      });
      await turso.execute({ sql, args });
    }

    console.log(`  ✅  ${table}: ${rows.length} registro(s) migrado(s)`);
  }

  console.log("\n✅  Migração concluída!");
  local.close();
  process.exit(0);
}

migrate().catch((e) => {
  console.error("❌  Erro durante a migração:", e);
  process.exit(1);
});
