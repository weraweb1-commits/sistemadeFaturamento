import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import cron from "node-cron";

const app = express();
const PORT = 3000;

app.use(express.json());

// Database setup
const dbPath = path.join(process.cwd(), "pos.db");
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Backup setup
const backupsDir = path.join(process.cwd(), "backups");
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir);
}

const performBackup = async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupsDir, `pos_backup_${timestamp}.db`);
  
  console.log(`Starting backup to: ${backupPath}`);
  try {
    await db.backup(backupPath);
    console.log(`Backup completed successfully: ${backupPath}`);
    
    // Optional: Keep only last 30 backups to save space
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('pos_backup_'))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);
      
    if (files.length > 30) {
      files.slice(30).forEach(f => {
        fs.unlinkSync(path.join(backupsDir, f.name));
        console.log(`Deleted old backup: ${f.name}`);
      });
    }
  } catch (error) {
    console.error("Backup failed:", error);
  }
};

// Schedule daily backup at midnight
cron.schedule("0 0 * * *", () => {
  performBackup();
});

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT CHECK(role IN ('admin', 'operator'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price REAL,
    category_id INTEGER,
    active INTEGER DEFAULT 1,
    is_prepared INTEGER DEFAULT 0, -- 1 for burgers/sandwiches (no direct stock), 0 for drinks/items
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS product_price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    old_price REAL,
    new_price REAL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    quantity REAL DEFAULT 0,
    min_quantity REAL DEFAULT 5,
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  -- Initialize default settings if they don't exist
  INSERT OR IGNORE INTO settings (key, value) VALUES ('establishment_name', 'POS Restauração');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('establishment_nif', '500123456');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('establishment_address', 'Endereço do Estabelecimento');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('establishment_phone', '900000000');
  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT UNIQUE,
    user_id INTEGER,
    customer_name TEXT,
    total REAL,
    discount REAL DEFAULT 0,
    payment_method TEXT, -- 'cash', 'card', 'transfer', 'mixed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    product_id INTEGER,
    quantity INTEGER,
    price REAL,
    FOREIGN KEY(sale_id) REFERENCES sales(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS cash_register (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    opening_balance REAL,
    closing_balance REAL,
    status TEXT CHECK(status IN ('open', 'closed')),
    opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// Seed default admin if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE username = ?").get("admin");
if (!adminExists) {
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run("admin", "admin123", "admin");
}

// Seed categories if empty
const catCount = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
if (catCount.count === 0) {
  const insertCat = db.prepare("INSERT INTO categories (name) VALUES (?)");
  ['Hambúrgueres', 'Sandes', 'Bebidas', 'Extras'].forEach(cat => insertCat.run(cat));
}

// API Routes
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT id, username, role FROM users WHERE username = ? AND password = ?").get(username, password) as any;
  if (user) {
    res.json(user);
  } else {
    res.status(401).json({ error: "Credenciais inválidas" });
  }
});

app.get("/api/users", (req, res) => {
  const users = db.prepare("SELECT id, username, role FROM users").all();
  res.json(users);
});

app.post("/api/users", (req, res) => {
  const { username, password, role } = req.body;
  try {
    const info = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)").run(username, password, role);
    res.json({ id: info.lastInsertRowid });
  } catch (error) {
    res.status(400).json({ error: "Utilizador já existe" });
  }
});

app.put("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;
  if (password) {
    db.prepare("UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?").run(username, password, role, id);
  } else {
    db.prepare("UPDATE users SET username = ?, role = ? WHERE id = ?").run(username, role, id);
  }
  res.json({ success: true });
});

app.delete("/api/users/:id", (req, res) => {
  const { id } = req.params;
  try {
    // Prevent deleting the last admin
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
    const userToDelete = db.prepare("SELECT role FROM users WHERE id = ?").get(id) as { role: string };
    
    if (userToDelete && userToDelete.role === 'admin' && adminCount.count <= 1) {
      return res.status(400).json({ error: "Não é possível eliminar o último administrador do sistema." });
    }

    // Check if user has sales
    const salesCount = db.prepare("SELECT COUNT(*) as count FROM sales WHERE user_id = ?").get(id) as { count: number };
    if (salesCount.count > 0) {
      return res.status(400).json({ error: "Não é possível eliminar um utilizador com histórico de vendas. Considere mudar a palavra-passe para impedir o acesso." });
    }

    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao eliminar utilizador" });
  }
});

app.get("/api/products", (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name, s.quantity as stock_quantity, s.min_quantity
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN stock s ON p.id = s.product_id
  `).all();
  res.json(products);
});

app.post("/api/products", (req, res) => {
  const { name, price, category_id, is_prepared, initial_stock } = req.body;
  const info = db.prepare("INSERT INTO products (name, price, category_id, is_prepared) VALUES (?, ?, ?, ?)").run(name, price, category_id, is_prepared);
  const productId = info.lastInsertRowid;
  
  // Initial price history
  db.prepare("INSERT INTO product_price_history (product_id, old_price, new_price) VALUES (?, ?, ?)").run(productId, 0, price);

  if (is_prepared === 0) {
    db.prepare("INSERT INTO stock (product_id, quantity) VALUES (?, ?)").run(productId, initial_stock || 0);
  }
  
  res.json({ id: productId });
});

app.put("/api/products/:id", (req, res) => {
  const { id } = req.params;
  const { name, price, category_id, is_prepared, active } = req.body;
  
  const oldProduct = db.prepare("SELECT price FROM products WHERE id = ?").get(id) as any;
  
  if (oldProduct && oldProduct.price !== price) {
    db.prepare("INSERT INTO product_price_history (product_id, old_price, new_price) VALUES (?, ?, ?)").run(id, oldProduct.price, price);
  }

  db.prepare("UPDATE products SET name = ?, price = ?, category_id = ?, is_prepared = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(name, price, category_id, is_prepared, active, id);
  
  res.json({ success: true });
});

app.get("/api/products/:id/details", (req, res) => {
  const { id } = req.params;
  const product = db.prepare(`
    SELECT p.*, c.name as category_name, s.quantity as stock_quantity
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN stock s ON p.id = s.product_id
    WHERE p.id = ?
  `).get(id);
  
  const history = db.prepare("SELECT * FROM product_price_history WHERE product_id = ? ORDER BY changed_at DESC").all(id);
  
  res.json({ product, history });
});

app.patch("/api/products/:id/stock", (req, res) => {
  const { id } = req.params;
  const { quantity } = req.body;
  db.prepare("UPDATE stock SET quantity = ? WHERE product_id = ?").run(quantity, id);
  res.json({ success: true });
});

app.patch("/api/products/:id/active", (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  db.prepare("UPDATE products SET active = ? WHERE id = ?").run(active, id);
  res.json({ success: true });
});

app.get("/api/categories", (req, res) => {
  const categories = db.prepare("SELECT * FROM categories").all();
  res.json(categories);
});

app.post("/api/categories", (req, res) => {
  const { name } = req.body;
  try {
    const info = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
    res.json({ id: info.lastInsertRowid });
  } catch (error) {
    res.status(400).json({ error: "Categoria já existe" });
  }
});

app.put("/api/categories/:id", (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    db.prepare("UPDATE categories SET name = ? WHERE id = ?").run(name, id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: "Erro ao atualizar categoria" });
  }
});

app.delete("/api/categories/:id", (req, res) => {
  const { id } = req.params;
  try {
    // Check if category has products
    const products = db.prepare("SELECT COUNT(*) as count FROM products WHERE category_id = ?").get(id) as { count: number };
    if (products.count > 0) {
      return res.status(400).json({ error: "Não é possível eliminar uma categoria com produtos associados" });
    }
    db.prepare("DELETE FROM categories WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: "Erro ao eliminar categoria" });
  }
});

app.delete("/api/products/:id", (req, res) => {
  const { id } = req.params;
  try {
    // Check if product has sales
    const sales = db.prepare("SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?").get(id) as { count: number };
    
    if (sales.count > 0) {
      // If has sales, we recommend deactivating instead of deleting to preserve history
      // But if the user really wants to delete, we should probably allow it if they confirm
      // For now, let's just soft-delete (deactivate) by default if it has sales
      db.prepare("UPDATE products SET active = 0 WHERE id = ?").run(id);
      return res.json({ success: true, message: "Produto desativado em vez de eliminado por possuir histórico de vendas." });
    }

    const transaction = db.transaction(() => {
      db.prepare("DELETE FROM stock WHERE product_id = ?").run(id);
      db.prepare("DELETE FROM product_price_history WHERE product_id = ?").run(id);
      db.prepare("DELETE FROM products WHERE id = ?").run(id);
    });
    
    transaction();
    res.json({ success: true });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(400).json({ error: "Erro ao eliminar produto: " + (error as Error).message });
  }
});

app.get("/api/admin/backups", (req, res) => {
  try {
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('pos_backup_'))
      .map(f => {
        const stats = fs.statSync(path.join(backupsDir, f));
        return {
          name: f,
          size: stats.size,
          created_at: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: "Erro ao listar backups" });
  }
});

app.delete("/api/admin/backups/:name", (req, res) => {
  const { name } = req.params;
  try {
    const filePath = path.join(backupsDir, name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Backup não encontrado" });
    }
  } catch (error) {
    res.status(500).json({ error: "Erro ao eliminar backup" });
  }
});

app.post("/api/sales", (req, res) => {
  const { user_id, items, total, discount, payment_method, customer_name } = req.body;
  
  const invoiceNumber = `FAC-${Date.now()}`;
  
  const transaction = db.transaction(() => {
    const saleInfo = db.prepare("INSERT INTO sales (invoice_number, user_id, total, discount, payment_method, customer_name) VALUES (?, ?, ?, ?, ?, ?)").run(invoiceNumber, user_id, total, discount, payment_method, customer_name);
    const saleId = saleInfo.lastInsertRowid;
    
    const insertItem = db.prepare("INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)");
    const updateStock = db.prepare("UPDATE stock SET quantity = quantity - ? WHERE product_id = ?");
    
    for (const item of items) {
      insertItem.run(saleId, item.id, item.quantity, item.price);
      
      // Only update stock for non-prepared items (like drinks)
      const product = db.prepare("SELECT is_prepared FROM products WHERE id = ?").get(item.id) as any;
      if (product && product.is_prepared === 0) {
        updateStock.run(item.quantity, item.id);
      }
    }
    
    return { saleId, invoiceNumber };
  });
  
  try {
    const result = transaction();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get("/api/reports/daily", (req, res) => {
  const sales = db.prepare(`
    SELECT DATE(created_at) as date, SUM(total) as total_sales, COUNT(*) as count
    FROM sales
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `).all();
  res.json(sales);
});

app.get("/api/reports/top-products", (req, res) => {
  const products = db.prepare(`
    SELECT p.name, SUM(si.quantity) as total_qty
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    GROUP BY p.id
    ORDER BY total_qty DESC
    LIMIT 10
  `).all();
  res.json(products);
});

app.get("/api/cash/status", (req, res) => {
  const status = db.prepare("SELECT * FROM cash_register WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();
  res.json(status || { status: 'closed' });
});

app.get("/api/cash/summary/:id", (req, res) => {
  const { id } = req.params;
  const cashSession = db.prepare("SELECT * FROM cash_register WHERE id = ?").get(id) as any;
  
  if (!cashSession) {
    return res.status(404).json({ error: "Sessão de caixa não encontrada" });
  }

  const sales = db.prepare(`
    SELECT payment_method, SUM(total) as total
    FROM sales
    WHERE created_at >= ?
    GROUP BY payment_method
  `).all(cashSession.opened_at) as any[];

  const summary = {
    opening_balance: cashSession.opening_balance,
    sales_by_method: sales.reduce((acc, curr) => {
      acc[curr.payment_method] = curr.total;
      return acc;
    }, { cash: 0, card: 0, transfer: 0 }),
    total_sales: sales.reduce((sum, s) => sum + s.total, 0)
  };

  res.json(summary);
});

app.post("/api/cash/open", (req, res) => {
  const { user_id, opening_balance } = req.body;
  db.prepare("INSERT INTO cash_register (user_id, opening_balance, status) VALUES (?, ?, 'open')").run(user_id, opening_balance);
  res.json({ success: true });
});

app.post("/api/cash/close", (req, res) => {
  const { id, closing_balance } = req.body;
  db.prepare("UPDATE cash_register SET closing_balance = ?, status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE id = ?").run(closing_balance, id);
  res.json({ success: true });
});

app.get("/api/sales", (req, res) => {
  const sales = db.prepare(`
    SELECT s.*, u.username as operator_name
    FROM sales s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC
  `).all() as any[];

  const salesWithItems = sales.map(sale => {
    const items = db.prepare(`
      SELECT si.*, p.name as product_name
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `).all(sale.id);
    return { ...sale, items };
  });

  res.json(salesWithItems);
});

app.get("/api/reports/monthly", (req, res) => {
  const sales = db.prepare(`
    SELECT STRFTIME('%Y-%m', created_at) as month, SUM(total) as total_sales, COUNT(*) as count
    FROM sales
    GROUP BY month
    ORDER BY month DESC
  `).all();
  res.json(sales);
});

app.get("/api/settings", (req, res) => {
  const settings = db.prepare("SELECT * FROM settings").all() as any[];
  const settingsObj = settings.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});
  res.json(settingsObj);
});

app.post("/api/settings", (req, res) => {
  const { establishment_name, establishment_nif, establishment_address, establishment_phone } = req.body;
  
  const updateStmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  
  db.transaction(() => {
    if (establishment_name !== undefined) updateStmt.run('establishment_name', establishment_name);
    if (establishment_nif !== undefined) updateStmt.run('establishment_nif', establishment_nif);
    if (establishment_address !== undefined) updateStmt.run('establishment_address', establishment_address);
    if (establishment_phone !== undefined) updateStmt.run('establishment_phone', establishment_phone);
  })();

  res.json({ success: true });
});

app.post("/api/admin/backup", async (req, res) => {
  try {
    await performBackup();
    res.json({ success: true, message: "Backup realizado com sucesso" });
  } catch (error) {
    res.status(500).json({ error: "Falha ao realizar backup" });
  }
});

app.get("/api/admin/export", (req, res) => {
  try {
    const data = {
      users: db.prepare("SELECT id, username, role FROM users").all(),
      categories: db.prepare("SELECT * FROM categories").all(),
      products: db.prepare("SELECT * FROM products").all(),
      stock: db.prepare("SELECT * FROM stock").all(),
      sales: db.prepare("SELECT * FROM sales").all(),
      sale_items: db.prepare("SELECT * FROM sale_items").all(),
      settings: db.prepare("SELECT * FROM settings").all(),
      cash_register: db.prepare("SELECT * FROM cash_register").all(),
      export_date: new Date().toISOString()
    };
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Erro ao exportar dados" });
  }
});

app.post("/api/admin/import", (req, res) => {
  const data = req.body;
  
  try {
    const transaction = db.transaction(() => {
      // Clear existing data
      db.prepare("DELETE FROM sale_items").run();
      db.prepare("DELETE FROM sales").run();
      db.prepare("DELETE FROM stock").run();
      db.prepare("DELETE FROM product_price_history").run();
      db.prepare("DELETE FROM products").run();
      db.prepare("DELETE FROM categories").run();
      db.prepare("DELETE FROM cash_register").run();
      db.prepare("DELETE FROM settings").run();
      // Keep users to avoid lockout, or restore them too
      db.prepare("DELETE FROM users WHERE username != 'admin'").run();

      // Restore Categories
      const insertCat = db.prepare("INSERT INTO categories (id, name) VALUES (?, ?)");
      data.categories.forEach((cat: any) => insertCat.run(cat.id, cat.name));

      // Restore Products
      const insertProd = db.prepare("INSERT INTO products (id, name, price, category_id, active, is_prepared, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      data.products.forEach((p: any) => insertProd.run(p.id, p.name, p.price, p.category_id, p.active, p.is_prepared, p.created_at, p.updated_at));

      // Restore Stock
      const insertStock = db.prepare("INSERT INTO stock (id, product_id, quantity, min_quantity) VALUES (?, ?, ?, ?)");
      data.stock.forEach((s: any) => insertStock.run(s.id, s.product_id, s.quantity, s.min_quantity));

      // Restore Sales
      const insertSale = db.prepare("INSERT INTO sales (id, invoice_number, user_id, customer_name, total, discount, payment_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      data.sales.forEach((s: any) => insertSale.run(s.id, s.invoice_number, s.user_id, s.customer_name, s.total, s.discount, s.payment_method, s.created_at));

      // Restore Sale Items
      const insertSaleItem = db.prepare("INSERT INTO sale_items (id, sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?, ?)");
      data.sale_items.forEach((si: any) => insertSaleItem.run(si.id, si.sale_id, si.product_id, si.quantity, si.price));

      // Restore Settings
      const insertSetting = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
      data.settings.forEach((s: any) => insertSetting.run(s.key, s.value));

      // Restore Cash Register
      const insertCash = db.prepare("INSERT INTO cash_register (id, user_id, opening_balance, closing_balance, status, opened_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
      data.cash_register.forEach((c: any) => insertCash.run(c.id, c.user_id, c.opening_balance, c.closing_balance, c.status, c.opened_at, c.closed_at));
    });

    transaction();
    res.json({ success: true });
  } catch (error) {
    console.error("Import failed:", error);
    res.status(500).json({ error: "Erro ao importar dados: " + (error as Error).message });
  }
});

app.post("/api/admin/reset", (req, res) => {
  try {
    const transaction = db.transaction(() => {
      db.prepare("DELETE FROM sale_items").run();
      db.prepare("DELETE FROM sales").run();
      db.prepare("DELETE FROM stock").run();
      db.prepare("DELETE FROM product_price_history").run();
      db.prepare("DELETE FROM products").run();
      db.prepare("DELETE FROM categories").run();
      db.prepare("DELETE FROM cash_register").run();
      db.prepare("DELETE FROM settings").run();
      db.prepare("DELETE FROM users WHERE username != 'admin'").run();
      
      // Re-initialize default settings
      db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('establishment_name', 'POS Restauração')").run();
      db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('establishment_nif', '500123456')").run();
      db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('establishment_address', 'Endereço do Estabelecimento')").run();
      db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('establishment_phone', '900000000')").run();
    });
    
    transaction();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao resetar sistema" });
  }
});

// Vite middleware for development
async function startServer() {
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
