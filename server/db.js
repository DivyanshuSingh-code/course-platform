const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const dbPath = path.join(__dirname, "database.sqlite");
let db = null;

function persist() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows[0] || null;
}

function runStmt(sql, params = []) {
  db.run(sql, params);
  persist();
}

async function initDb() {
  if (db) return;
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(new Uint8Array(fileBuffer));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      course_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      paid INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      email TEXT NOT NULL,
      course_id TEXT NOT NULL,
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (email, course_id)
    );
  `);

  persist();
}

module.exports = {
  initDb,
  getUser: (email) =>
    queryOne("SELECT email, password_hash, salt FROM users WHERE email = ?", [email]),
  createUser: (email, passwordHash, salt) =>
    runStmt("INSERT INTO users (email, password_hash, salt) VALUES (?, ?, ?)", [
      email,
      passwordHash,
      salt
    ]),
  createSession: (token, email) =>
    runStmt("INSERT INTO sessions (token, email) VALUES (?, ?)", [token, email]),
  getSessionEmail: (token) =>
    queryOne("SELECT email FROM sessions WHERE token = ?", [token])?.email || null,
  getEnrolledCourseIds: (email) =>
    queryAll("SELECT course_id FROM enrollments WHERE email = ?", [email]).map(
      (row) => row.course_id
    ),
  createOrder: (orderId, email, courseId, amount) =>
    runStmt(
      "INSERT INTO orders (order_id, email, course_id, amount, paid) VALUES (?, ?, ?, ?, 0)",
      [orderId, email, courseId, amount]
    ),
  getOrder: (orderId) =>
    queryOne(
      "SELECT order_id, email, course_id, amount, paid FROM orders WHERE order_id = ?",
      [orderId]
    ),
  completePurchase: (orderId, email, courseId) => {
    db.run("BEGIN TRANSACTION");
    try {
      db.run("UPDATE orders SET paid = 1 WHERE order_id = ?", [orderId]);
      db.run("INSERT OR IGNORE INTO enrollments (email, course_id) VALUES (?, ?)", [
        email,
        courseId
      ]);
      db.run("COMMIT");
      persist();
    } catch (err) {
      db.run("ROLLBACK");
      throw err;
    }
  }
};