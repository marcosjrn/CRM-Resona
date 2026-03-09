import express from "express";
import { createClient, type ResultSet } from "@libsql/client";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// --- DB CLIENT ---
// Local dev: usa arquivo local via LibSQL embedded (sem Turso)
// Produção: usa TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
const db = createClient(
  process.env.TURSO_DATABASE_URL
    ? { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN }
    : { url: "file:crm.db" }
);

// Helpers para converter Row do LibSQL para objetos JS simples
const toRows = (r: ResultSet) => r.rows.map((row) => ({ ...row }));
const toRow = (r: ResultSet) => (r.rows[0] ? { ...r.rows[0] } : undefined);

// --- AUTH ---
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "resona2024";
const JWT_SECRET = process.env.JWT_SECRET || "resona-dev-secret-change-in-production";

function requireAuth(req: any, res: any, next: any) {
  if (req.path === "/auth/login") return next();
  const auth = req.headers["authorization"] as string | undefined;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Não autorizado" });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada" });
  }
}

function requireAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Acesso restrito a administradores" });
  next();
}

// --- SCHEMA + SEED ---
async function initDB() {
  // Schema principal
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      company_name TEXT NOT NULL,
      segment TEXT NOT NULL,
      acquisition_channel TEXT NOT NULL,
      status TEXT,
      owner TEXT NOT NULL,
      contact_name TEXT,
      contact_email TEXT,
      contact_whatsapp TEXT,
      notes TEXT,
      tags TEXT,
      health TEXT,
      mrr REAL,
      potential_value REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      next_action TEXT NOT NULL,
      next_action_date TEXT NOT NULL,
      loss_reason TEXT,
      loss_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      revenue_type TEXT NOT NULL DEFAULT 'Mensalidade',
      competence_month TEXT NOT NULL,
      due_date TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      paid_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS costs (
      id TEXT PRIMARY KEY,
      account_id TEXT,
      name TEXT,
      competence_month TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deal_stage_history (
      id TEXT PRIMARY KEY,
      deal_id TEXT NOT NULL,
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE
    );
  `);

  // Migrations para colunas adicionadas depois do schema inicial
  const migrations = [
    `ALTER TABLE costs ADD COLUMN name TEXT`,
    `ALTER TABLE deals ADD COLUMN loss_reason TEXT`,
    `ALTER TABLE deals ADD COLUMN loss_notes TEXT`,
    `ALTER TABLE invoices ADD COLUMN revenue_type TEXT NOT NULL DEFAULT 'Mensalidade'`,
  ];
  for (const sql of migrations) {
    try { await db.execute(sql); } catch { /* coluna já existe */ }
  }

  // Seed: cria admin padrão se não houver nenhum usuário
  const countResult = await db.execute("SELECT COUNT(*) as count FROM users");
  const count = Number(countResult.rows[0]?.count ?? 0);
  if (count === 0) {
    const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
    await db.execute({
      sql: "INSERT INTO users (id, name, username, password_hash, role) VALUES (?, ?, ?, ?, ?)",
      args: [uuidv4(), "Admin", ADMIN_USERNAME, hash, "admin"],
    });
    console.log(`Usuário admin criado: ${ADMIN_USERNAME}`);
  }
}

// --- LOG DE ATIVIDADE ---
async function logActivity(accountId: string, type: string, description: string) {
  await db.execute({
    sql: "INSERT INTO activities (id, account_id, type, description) VALUES (?, ?, ?, ?)",
    args: [uuidv4(), accountId, type, description],
  });
}

// --- SERVER ---
const app = express();
const PORT = Number(process.env.PORT) || 3000;
app.use(express.json());

// Lazy DB init — garante que o banco está pronto antes de cada request
let _dbReady = false;
let _dbInitPromise: Promise<void> | null = null;
const ensureDB = (): Promise<void> => {
  if (_dbReady) return Promise.resolve();
  if (!_dbInitPromise) _dbInitPromise = initDB().then(() => { _dbReady = true; });
  return _dbInitPromise!;
};
app.use(async (_req, _res, next) => {
  try { await ensureDB(); next(); }
  catch { _res.status(500).json({ error: "Inicialização do banco falhou" }); }
});

async function startServer() {

  // AUTH ROUTES
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      const result = await db.execute({ sql: "SELECT * FROM users WHERE username = ?", args: [username] });
      const user = toRow(result) as any;
      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: "Usuário ou senha inválidos" });
      }
      const token = jwt.sign(
        { userId: user.id, username: user.username, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: "30d" }
      );
      res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro interno" });
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.json({ success: true });
  });

  app.use("/api", requireAuth);

  // USERS (admin only)
  app.get("/api/users", requireAdmin, async (_req, res) => {
    const result = await db.execute("SELECT id, name, username, role, created_at FROM users ORDER BY created_at ASC");
    res.json(toRows(result));
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const { name, username, password, role } = req.body;
      if (!name || !username || !password) return res.status(400).json({ error: "Nome, usuário e senha são obrigatórios" });
      const existing = toRow(await db.execute({ sql: "SELECT id FROM users WHERE username = ?", args: [username] }));
      if (existing) return res.status(409).json({ error: "Nome de usuário já existe" });
      const hash = bcrypt.hashSync(password, 10);
      const id = uuidv4();
      await db.execute({
        sql: "INSERT INTO users (id, name, username, password_hash, role) VALUES (?, ?, ?, ?, ?)",
        args: [id, name, username, hash, role === "admin" ? "admin" : "member"],
      });
      res.status(201).json({ id, name, username, role: role === "admin" ? "admin" : "member" });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.put("/api/users/:id/password", requireAdmin, async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: "Senha deve ter no mínimo 6 caracteres" });
    const hash = bcrypt.hashSync(password, 10);
    await db.execute({ sql: "UPDATE users SET password_hash = ? WHERE id = ?", args: [hash, req.params.id] });
    res.json({ success: true });
  });

  app.delete("/api/users/:id", requireAdmin, async (req: any, res) => {
    if (req.params.id === req.user.userId) return res.status(400).json({ error: "Você não pode excluir sua própria conta" });
    await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [req.params.id] });
    res.json({ success: true });
  });

  // ACCOUNTS
  app.get("/api/accounts", async (_req, res) => {
    try {
      const result = await db.execute(`
        SELECT a.*,
          d.stage as latest_deal_stage,
          d.next_action as latest_deal_next_action,
          d.next_action_date as latest_deal_next_action_date
        FROM accounts a
        LEFT JOIN deals d ON d.id = (
          SELECT id FROM deals WHERE account_id = a.id ORDER BY updated_at DESC LIMIT 1
        )
        ORDER BY a.created_at DESC
      `);
      res.json(toRows(result));
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.get("/api/accounts/:id", async (req, res) => {
    try {
      const result = await db.execute({ sql: "SELECT * FROM accounts WHERE id = ?", args: [req.params.id] });
      const account = toRow(result);
      if (!account) return res.status(404).json({ error: "Not found" });
      res.json(account);
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.post("/api/accounts", async (req, res) => {
    try {
      const data = req.body;
      const id = uuidv4();
      await db.execute({
        sql: `INSERT INTO accounts (
          id, type, company_name, segment, acquisition_channel, status, owner,
          contact_name, contact_email, contact_whatsapp, notes, tags, health, mrr, potential_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id, data.type, data.company_name, data.segment, data.acquisition_channel, data.status || null, data.owner || "eu",
          data.contact_name || null, data.contact_email || null, data.contact_whatsapp || null, data.notes || null,
          data.tags || null, data.health || null, data.mrr || null, data.potential_value || null,
        ],
      });
      await logActivity(id, "account_created", `Account ${data.company_name} created as ${data.type}`);
      res.json({ id });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.put("/api/accounts/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const data = req.body;
      await db.execute({
        sql: `UPDATE accounts SET
          type = ?, company_name = ?, segment = ?, acquisition_channel = ?, status = ?, owner = ?,
          contact_name = ?, contact_email = ?, contact_whatsapp = ?, notes = ?, tags = ?, health = ?, mrr = ?, potential_value = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        args: [
          data.type, data.company_name, data.segment, data.acquisition_channel, data.status || null, data.owner || "eu",
          data.contact_name || null, data.contact_email || null, data.contact_whatsapp || null, data.notes || null,
          data.tags || null, data.health || null, data.mrr || null, data.potential_value || null, id,
        ],
      });
      await logActivity(id, "account_updated", `Account ${data.company_name} updated`);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.delete("/api/accounts/:id", async (req, res) => {
    try {
      const id = req.params.id;
      await db.batch([
        { sql: "DELETE FROM activities WHERE account_id = ?", args: [id] },
        { sql: "DELETE FROM invoices WHERE account_id = ?", args: [id] },
        { sql: "DELETE FROM costs WHERE account_id = ?", args: [id] },
        { sql: "DELETE FROM deals WHERE account_id = ?", args: [id] },
        { sql: "DELETE FROM accounts WHERE id = ?", args: [id] },
      ], "write");
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  // DEALS
  app.get("/api/deals", async (_req, res) => {
    try {
      const result = await db.execute(`
        SELECT d.*, a.company_name
        FROM deals d
        JOIN accounts a ON d.account_id = a.id
      `);
      res.json(toRows(result));
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.post("/api/deals", async (req, res) => {
    try {
      const data = req.body;
      const id = uuidv4();
      await db.execute({
        sql: "INSERT INTO deals (id, account_id, stage, next_action, next_action_date) VALUES (?, ?, ?, ?, ?)",
        args: [id, data.account_id, data.stage, data.next_action, data.next_action_date],
      });
      await logActivity(data.account_id, "deal_created", `Deal created in stage ${data.stage}`);
      res.json({ id });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.put("/api/deals/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const data = req.body;
      const oldResult = await db.execute({ sql: "SELECT stage, account_id FROM deals WHERE id = ?", args: [id] });
      const oldDeal = toRow(oldResult) as any;
      await db.execute({
        sql: `UPDATE deals SET
          stage = ?, next_action = ?, next_action_date = ?,
          loss_reason = ?, loss_notes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
        args: [data.stage, data.next_action, data.next_action_date, data.loss_reason || null, data.loss_notes || null, id],
      });
      if (oldDeal && oldDeal.stage !== data.stage) {
        await logActivity(String(oldDeal.account_id), "deal_stage_changed", `Deal moved from ${oldDeal.stage} to ${data.stage}`);
        await db.execute({
          sql: "INSERT INTO deal_stage_history (id, deal_id, from_stage, to_stage) VALUES (?, ?, ?, ?)",
          args: [uuidv4(), id, String(oldDeal.stage), data.stage],
        });
      }
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.get("/api/deals/:id/history", async (req, res) => {
    try {
      const result = await db.execute({
        sql: "SELECT * FROM deal_stage_history WHERE deal_id = ? ORDER BY changed_at ASC",
        args: [req.params.id],
      });
      res.json(toRows(result));
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.delete("/api/deals/:id", async (req, res) => {
    try {
      await db.execute({ sql: "DELETE FROM deals WHERE id = ?", args: [req.params.id] });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  // INVOICES
  app.get("/api/invoices", async (_req, res) => {
    try {
      const result = await db.execute(`
        SELECT i.*, a.company_name
        FROM invoices i
        JOIN accounts a ON i.account_id = a.id
        ORDER BY i.due_date ASC
      `);
      res.json(toRows(result));
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const data = req.body;
      const id = uuidv4();
      await db.execute({
        sql: "INSERT INTO invoices (id, account_id, revenue_type, competence_month, due_date, amount, status, paid_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [id, data.account_id, data.revenue_type || "Mensalidade", data.competence_month, data.due_date, data.amount, data.status, data.paid_date || null],
      });
      await logActivity(data.account_id, "invoice_created", `Invoice created for ${data.amount} (${data.competence_month})`);
      res.json({ id });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.put("/api/invoices/:id", async (req, res) => {
    try {
      const data = req.body;
      await db.execute({
        sql: "UPDATE invoices SET revenue_type = ?, competence_month = ?, due_date = ?, amount = ?, status = ?, paid_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [data.revenue_type || "Mensalidade", data.competence_month, data.due_date, data.amount, data.status, data.paid_date || null, req.params.id],
      });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    try {
      await db.execute({ sql: "DELETE FROM invoices WHERE id = ?", args: [req.params.id] });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  // COSTS
  app.get("/api/costs", async (_req, res) => {
    try {
      const result = await db.execute(`
        SELECT c.*, a.company_name
        FROM costs c
        LEFT JOIN accounts a ON c.account_id = a.id
        ORDER BY c.created_at DESC
      `);
      res.json(toRows(result));
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.post("/api/costs", async (req, res) => {
    try {
      const data = req.body;
      const id = uuidv4();
      await db.execute({
        sql: "INSERT INTO costs (id, account_id, name, competence_month, category, amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [id, data.account_id || null, data.name || null, data.competence_month, data.category, data.amount, data.notes || null],
      });
      if (data.account_id) await logActivity(data.account_id, "cost_created", `Cost created for ${data.amount} (${data.category})`);
      res.json({ id });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.put("/api/costs/:id", async (req, res) => {
    try {
      const data = req.body;
      await db.execute({
        sql: "UPDATE costs SET account_id = ?, name = ?, competence_month = ?, category = ?, amount = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [data.account_id || null, data.name || null, data.competence_month, data.category, data.amount, data.notes || null, req.params.id],
      });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.delete("/api/costs/:id", async (req, res) => {
    try {
      await db.execute({ sql: "DELETE FROM costs WHERE id = ?", args: [req.params.id] });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  // ACTIVITIES
  app.get("/api/activities/:accountId", async (req, res) => {
    try {
      const result = await db.execute({
        sql: "SELECT * FROM activities WHERE account_id = ? ORDER BY created_at DESC",
        args: [req.params.accountId],
      });
      res.json(toRows(result));
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.post("/api/activities", async (req, res) => {
    try {
      const { account_id, type, description } = req.body;
      if (!account_id || !type || !description) return res.status(400).json({ error: "Campos obrigatórios ausentes" });
      const id = uuidv4();
      await db.execute({ sql: "INSERT INTO activities (id, account_id, type, description) VALUES (?, ?, ?, ?)", args: [id, account_id, type, description] });
      res.json({ id });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  app.delete("/api/activities/:id", async (req, res) => {
    try {
      await db.execute({ sql: "DELETE FROM activities WHERE id = ?", args: [req.params.id] });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  // PIPELINE STAGES
  const DEFAULT_STAGES = ["Novo", "Qualificação", "Diagnóstico agendado", "Proposta enviada", "Negociação", "Ganhou", "Perdido"];

  app.get("/api/pipeline/stages", async (_req, res) => {
    try {
      const result = await db.execute("SELECT value FROM settings WHERE key = 'pipeline_stages'");
      const row = toRow(result) as any;
      if (row?.value) {
        try { return res.json(JSON.parse(String(row.value))); } catch { /* fall through */ }
      }
      res.json(DEFAULT_STAGES);
    } catch (e) { res.json(DEFAULT_STAGES); }
  });

  app.put("/api/pipeline/stages", async (req, res) => {
    try {
      const { stages } = req.body;
      if (!Array.isArray(stages)) return res.status(400).json({ error: "stages deve ser um array" });
      await db.execute({
        sql: "INSERT OR REPLACE INTO settings (key, value) VALUES ('pipeline_stages', ?)",
        args: [JSON.stringify(stages)],
      });
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  // DASHBOARD CHART
  app.get("/api/dashboard/chart", async (_req, res) => {
    try {
      const months: string[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }

      const revenueResult = await db.execute(`
        SELECT competence_month, revenue_type, SUM(amount) as total
        FROM invoices
        WHERE status = 'Pago'
        GROUP BY competence_month, revenue_type
      `);
      const costsResult = await db.execute("SELECT competence_month, SUM(amount) as total FROM costs GROUP BY competence_month");

      const revenueMap: Record<string, number> = {};
      const revenueMensalidadeMap: Record<string, number> = {};
      const revenueImplementacaoMap: Record<string, number> = {};

      toRows(revenueResult).forEach((r: any) => {
        const m = String(r.competence_month);
        const t = Number(r.total);
        revenueMap[m] = (revenueMap[m] || 0) + t;
        if (r.revenue_type === "Implementacao") {
          revenueImplementacaoMap[m] = (revenueImplementacaoMap[m] || 0) + t;
        } else {
          revenueMensalidadeMap[m] = (revenueMensalidadeMap[m] || 0) + t;
        }
      });

      const costsMap: Record<string, number> = {};
      toRows(costsResult).forEach((r: any) => { costsMap[String(r.competence_month)] = Number(r.total); });

      res.json(months.map(month => ({
        month,
        revenue: revenueMap[month] || 0,
        revenue_mensalidade: revenueMensalidadeMap[month] || 0,
        revenue_implementacao: revenueImplementacaoMap[month] || 0,
        costs: costsMap[month] || 0,
      })));
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  // DASHBOARD STATS
  app.get("/api/dashboard", async (req, res) => {
    try {
      const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);

      const [activeClientsRes, openLeadsRes, pipelineRes, mrrRes, costsRes, overdueRes, paidByTypeRes] = await Promise.all([
        db.execute("SELECT COUNT(*) as count FROM accounts WHERE type = 'Cliente' AND status = 'Ativo'"),
        db.execute("SELECT COUNT(*) as count FROM accounts WHERE type = 'Lead'"),
        db.execute("SELECT stage, COUNT(*) as count FROM deals GROUP BY stage"),
        db.execute("SELECT SUM(mrr) as total FROM accounts WHERE type = 'Cliente' AND status = 'Ativo'"),
        db.execute({ sql: "SELECT SUM(amount) as total FROM costs WHERE competence_month = ?", args: [month] }),
        db.execute("SELECT SUM(amount) as total FROM invoices WHERE status = 'Atrasado'"),
        db.execute({ sql: "SELECT revenue_type, SUM(amount) as total FROM invoices WHERE status = 'Pago' AND competence_month = ? GROUP BY revenue_type", args: [month] }),
      ]);

      const paidByType = toRows(paidByTypeRes) as any[];
      const paidMensalidade = Number(paidByType.find(r => r.revenue_type !== "Implementacao")?.total || 0);
      const paidImplementacao = Number(paidByType.find(r => r.revenue_type === "Implementacao")?.total || 0);

      res.json({
        activeClients: Number(toRow(activeClientsRes)?.count ?? 0),
        openLeads: Number(toRow(openLeadsRes)?.count ?? 0),
        pipeline: toRows(pipelineRes).map((r: any) => ({ stage: r.stage, count: Number(r.count) })),
        financials: {
          mrr: Number(toRow(mrrRes)?.total ?? 0),
          costs: Number(toRow(costsRes)?.total ?? 0),
          margin: Number(toRow(mrrRes)?.total ?? 0) - Number(toRow(costsRes)?.total ?? 0),
          overdue: Number(toRow(overdueRes)?.total ?? 0),
          revenue_mensalidade: paidMensalidade,
          revenue_implementacao: paidImplementacao,
          revenue_total: paidMensalidade + paidImplementacao,
        },
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Erro interno" });
    }
  });

  // DASHBOARD ANALYTICS (página Dashboard)
  app.get("/api/dashboard/analytics", async (_req, res) => {
    try {
      const [topClientsRes, clientsByStatusRes, clientsBySegmentRes, overdueByClientRes, revenueByMonthRes, costsMonthRes] = await Promise.all([
        db.execute("SELECT company_name, mrr, health, segment FROM accounts WHERE type = 'Cliente' AND status = 'Ativo' ORDER BY mrr DESC LIMIT 10"),
        db.execute("SELECT status, COUNT(*) as count FROM accounts WHERE type = 'Cliente' GROUP BY status"),
        db.execute("SELECT segment, COUNT(*) as count FROM accounts GROUP BY segment ORDER BY count DESC"),
        db.execute(`
          SELECT a.company_name, SUM(i.amount) as total
          FROM invoices i JOIN accounts a ON i.account_id = a.id
          WHERE i.paid_date IS NULL AND i.due_date < date('now')
          GROUP BY a.id ORDER BY total DESC LIMIT 8
        `),
        db.execute(`
          SELECT competence_month, revenue_type, SUM(amount) as total
          FROM invoices WHERE status = 'Pago'
          GROUP BY competence_month, revenue_type ORDER BY competence_month
        `),
        db.execute("SELECT competence_month, SUM(amount) as total FROM costs GROUP BY competence_month ORDER BY competence_month"),
      ]);

      // Build revenue by month (last 12 months)
      const now = new Date();
      const months12: string[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months12.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      const revMap: Record<string, { mensalidade: number; implementacao: number }> = {};
      toRows(revenueByMonthRes).forEach((r: any) => {
        const m = String(r.competence_month);
        if (!revMap[m]) revMap[m] = { mensalidade: 0, implementacao: 0 };
        if (r.revenue_type === "Implementacao") revMap[m].implementacao += Number(r.total);
        else revMap[m].mensalidade += Number(r.total);
      });
      const costMap: Record<string, number> = {};
      toRows(costsMonthRes).forEach((r: any) => { costMap[String(r.competence_month)] = Number(r.total); });

      res.json({
        topClients: toRows(topClientsRes).map((r: any) => ({ company_name: String(r.company_name), mrr: Number(r.mrr || 0), health: r.health, segment: r.segment })),
        clientsByStatus: toRows(clientsByStatusRes).map((r: any) => ({ status: String(r.status || "Sem status"), count: Number(r.count) })),
        clientsBySegment: toRows(clientsBySegmentRes).map((r: any) => ({ segment: String(r.segment || "Outros"), count: Number(r.count) })),
        overdueByClient: toRows(overdueByClientRes).map((r: any) => ({ company_name: String(r.company_name), total: Number(r.total) })),
        revenueByMonth: months12.map(m => ({
          month: m,
          mensalidade: revMap[m]?.mensalidade || 0,
          implementacao: revMap[m]?.implementacao || 0,
          costs: costMap[m] || 0,
        })),
      });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

  // NOTIFICATIONS (alertas de vencimento para o sino)
  app.get("/api/notifications", async (_req, res) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      const [overdueInvoicesRes, dueSoonRes, overdueActionsRes] = await Promise.all([
        db.execute(`SELECT i.id, a.company_name, i.amount, i.due_date FROM invoices i JOIN accounts a ON i.account_id = a.id WHERE i.paid_date IS NULL AND i.due_date < ? ORDER BY i.due_date ASC`, [today]),
        db.execute(`SELECT i.id, a.company_name, i.amount, i.due_date FROM invoices i JOIN accounts a ON i.account_id = a.id WHERE i.paid_date IS NULL AND i.due_date >= ? AND i.due_date <= ? ORDER BY i.due_date ASC`, [today, in7Days]),
        db.execute(`SELECT d.id, a.company_name, d.next_action, d.next_action_date FROM deals d JOIN accounts a ON d.account_id = a.id WHERE d.next_action_date < ? ORDER BY d.next_action_date ASC`, [today]),
      ]);
      res.json({
        overdueInvoices: toRows(overdueInvoicesRes).map((r: any) => ({ ...r, amount: Number(r.amount) })),
        dueSoonInvoices: toRows(dueSoonRes).map((r: any) => ({ ...r, amount: Number(r.amount) })),
        overdueActions: toRows(overdueActionsRes),
      });
    } catch (e) { res.status(500).json({ error: "Erro interno" }); }
  });

}

// Registra todas as rotas
startServer();

// Export para Vercel (serverless handler)
export default app;

// Inicia servidor localmente (não no Vercel)
if (!process.env.VERCEL) {
  if (process.env.NODE_ENV !== "production") {
    // Dev: Vite middleware para HMR (import dinâmico — Vite é devDependency)
    import("vite").then(({ createServer: createViteServer }) => {
      return createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    }).then((vite) => {
      app.use(vite.middlewares);
      app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
    });
  } else {
    // Produção local: serve o build estático
    app.use(express.static("dist"));
    app.get("*", (_req, res) => res.sendFile("dist/index.html", { root: "." }));
    app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
  }
}
