import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { v4 as uuidv4 } from "uuid";

const db = new Database("crm.db");

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'Lead' | 'Cliente'
    company_name TEXT NOT NULL,
    segment TEXT NOT NULL,
    acquisition_channel TEXT NOT NULL,
    status TEXT, -- 'Ativo' | 'Pausado' | 'Encerrado' (only for Cliente)
    owner TEXT NOT NULL,
    contact_name TEXT,
    contact_email TEXT,
    contact_whatsapp TEXT,
    notes TEXT,
    tags TEXT,
    health TEXT, -- 'Verde' | 'Amarelo' | 'Vermelho' (only for Cliente)
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    competence_month TEXT NOT NULL, -- YYYY-MM
    due_date TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL, -- 'Pendente' | 'Pago' | 'Atrasado'
    paid_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS costs (
    id TEXT PRIMARY KEY,
    account_id TEXT,
    competence_month TEXT NOT NULL, -- YYYY-MM
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
`);

function logActivity(accountId: string, type: string, description: string) {
  const stmt = db.prepare(`
    INSERT INTO activities (id, account_id, type, description)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(uuidv4(), accountId, type, description);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API ROUTES ---

  // Accounts
  app.get("/api/accounts", (req, res) => {
    const stmt = db.prepare("SELECT * FROM accounts ORDER BY created_at DESC");
    res.json(stmt.all());
  });

  app.get("/api/accounts/:id", (req, res) => {
    const stmt = db.prepare("SELECT * FROM accounts WHERE id = ?");
    const account = stmt.get(req.params.id);
    if (!account) return res.status(404).json({ error: "Not found" });
    res.json(account);
  });

  app.post("/api/accounts", (req, res) => {
    const data = req.body;
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO accounts (
        id, type, company_name, segment, acquisition_channel, status, owner,
        contact_name, contact_email, contact_whatsapp, notes, tags, health, mrr, potential_value
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, data.type, data.company_name, data.segment, data.acquisition_channel, data.status || null, data.owner || 'eu',
      data.contact_name || null, data.contact_email || null, data.contact_whatsapp || null, data.notes || null,
      data.tags || null, data.health || null, data.mrr || null, data.potential_value || null
    );
    logActivity(id, 'account_created', `Account ${data.company_name} created as ${data.type}`);
    res.json({ id });
  });

  app.put("/api/accounts/:id", (req, res) => {
    const id = req.params.id;
    const data = req.body;
    const stmt = db.prepare(`
      UPDATE accounts SET
        type = ?, company_name = ?, segment = ?, acquisition_channel = ?, status = ?, owner = ?,
        contact_name = ?, contact_email = ?, contact_whatsapp = ?, notes = ?, tags = ?, health = ?, mrr = ?, potential_value = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(
      data.type, data.company_name, data.segment, data.acquisition_channel, data.status || null, data.owner || 'eu',
      data.contact_name || null, data.contact_email || null, data.contact_whatsapp || null, data.notes || null,
      data.tags || null, data.health || null, data.mrr || null, data.potential_value || null, id
    );
    logActivity(id, 'account_updated', `Account ${data.company_name} updated`);
    res.json({ success: true });
  });

  // Deals
  app.get("/api/deals", (req, res) => {
    const stmt = db.prepare(`
      SELECT d.*, a.company_name 
      FROM deals d 
      JOIN accounts a ON d.account_id = a.id
    `);
    res.json(stmt.all());
  });

  app.post("/api/deals", (req, res) => {
    const data = req.body;
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO deals (id, account_id, stage, next_action, next_action_date)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.account_id, data.stage, data.next_action, data.next_action_date);
    logActivity(data.account_id, 'deal_created', `Deal created in stage ${data.stage}`);
    res.json({ id });
  });

  app.put("/api/deals/:id", (req, res) => {
    const id = req.params.id;
    const data = req.body;
    
    // Get old stage for logging
    const oldDeal = db.prepare("SELECT stage, account_id FROM deals WHERE id = ?").get(id) as any;
    
    const stmt = db.prepare(`
      UPDATE deals SET
        stage = ?, next_action = ?, next_action_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(data.stage, data.next_action, data.next_action_date, id);
    
    if (oldDeal && oldDeal.stage !== data.stage) {
      logActivity(oldDeal.account_id, 'deal_stage_changed', `Deal moved from ${oldDeal.stage} to ${data.stage}`);
    }
    
    res.json({ success: true });
  });

  // Invoices
  app.get("/api/invoices", (req, res) => {
    const stmt = db.prepare(`
      SELECT i.*, a.company_name 
      FROM invoices i 
      JOIN accounts a ON i.account_id = a.id
      ORDER BY i.due_date ASC
    `);
    res.json(stmt.all());
  });

  app.post("/api/invoices", (req, res) => {
    const data = req.body;
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO invoices (id, account_id, competence_month, due_date, amount, status, paid_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.account_id, data.competence_month, data.due_date, data.amount, data.status, data.paid_date || null);
    logActivity(data.account_id, 'invoice_created', `Invoice created for ${data.amount} (${data.competence_month})`);
    res.json({ id });
  });

  app.put("/api/invoices/:id", (req, res) => {
    const id = req.params.id;
    const data = req.body;
    const stmt = db.prepare(`
      UPDATE invoices SET
        competence_month = ?, due_date = ?, amount = ?, status = ?, paid_date = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(data.competence_month, data.due_date, data.amount, data.status, data.paid_date || null, id);
    res.json({ success: true });
  });

  // Costs
  app.get("/api/costs", (req, res) => {
    const stmt = db.prepare(`
      SELECT c.*, a.company_name 
      FROM costs c 
      LEFT JOIN accounts a ON c.account_id = a.id
      ORDER BY c.created_at DESC
    `);
    res.json(stmt.all());
  });

  app.post("/api/costs", (req, res) => {
    const data = req.body;
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO costs (id, account_id, competence_month, category, amount, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, data.account_id || null, data.competence_month, data.category, data.amount, data.notes || null);
    if (data.account_id) {
      logActivity(data.account_id, 'cost_created', `Cost created for ${data.amount} (${data.category})`);
    }
    res.json({ id });
  });

  // Activities
  app.get("/api/activities/:accountId", (req, res) => {
    const stmt = db.prepare("SELECT * FROM activities WHERE account_id = ? ORDER BY created_at DESC");
    res.json(stmt.all(req.params.accountId));
  });

  // Dashboard Stats
  app.get("/api/dashboard", (req, res) => {
    const month = req.query.month as string || new Date().toISOString().slice(0, 7); // YYYY-MM
    
    const activeClients = db.prepare("SELECT COUNT(*) as count FROM accounts WHERE type = 'Cliente' AND status = 'Ativo'").get() as any;
    const openLeads = db.prepare("SELECT COUNT(*) as count FROM accounts WHERE type = 'Lead'").get() as any;
    
    const pipeline = db.prepare("SELECT stage, COUNT(*) as count FROM deals GROUP BY stage").all();
    
    const mrr = db.prepare("SELECT SUM(mrr) as total FROM accounts WHERE type = 'Cliente' AND status = 'Ativo'").get() as any;
    const costs = db.prepare("SELECT SUM(amount) as total FROM costs WHERE competence_month = ?").get(month) as any;
    const overdueInvoices = db.prepare("SELECT SUM(amount) as total FROM invoices WHERE status = 'Atrasado'").get() as any;
    
    res.json({
      activeClients: activeClients.count,
      openLeads: openLeads.count,
      pipeline,
      financials: {
        mrr: mrr.total || 0,
        costs: costs.total || 0,
        margin: (mrr.total || 0) - (costs.total || 0),
        overdue: overdueInvoices.total || 0
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
