const express = require("express");
const crypto = require("crypto");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

const COURSES = {
  "c-basics": {
    id: "c-basics",
    title: "C Programming Foundations",
    description: "Control flow, arrays, functions, and structured problem solving.",
    price: 499,
    lessonContent: "Module 1 unlocked: Variables, loops, arrays, and clean function decomposition."
  },
  "web-dev": {
    id: "web-dev",
    title: "Web Engineering Fundamentals",
    description: "Semantic HTML, modern CSS layouts, DOM events, and REST APIs.",
    price: 799,
    lessonContent: "Module 1 unlocked: Responsive layouts, fetch() requests, and client-server flow."
  }
};

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const email = db.getSessionEmail(token);

  if (!email) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  const user = db.getUser(email);
  if (!user) {
    return res.status(401).json({ error: "User account not found" });
  }

  req.user = {
    email: user.email,
    enrolledCourseIds: db.getEnrolledCourseIds(user.email)
  };
  next();
}

app.post("/api/signup", (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !email.includes("@") || password.length < 6) {
    return res.status(400).json({ error: "Enter a valid email and a password (min 6 chars)" });
  }

  if (db.getUser(email)) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const { salt, hash } = hashPassword(password);
  db.createUser(email, hash, salt);

  const token = crypto.randomUUID();
  db.createSession(token, email);

  return res.status(201).json({ email, token, enrolledCourseIds: [] });
});

app.post("/api/login", (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const user = db.getUser(email);

  if (!user || !password) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const { hash } = hashPassword(password, user.salt);
  const actualBuf = Buffer.from(hash, "hex");
  const expectedBuf = Buffer.from(user.password_hash, "hex");

  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = crypto.randomUUID();
  db.createSession(token, email);

  const enrolledCourseIds = db.getEnrolledCourseIds(email);
  return res.json({ email, token, enrolledCourseIds });
});

app.get("/api/courses", (_req, res) => {
  const catalog = Object.values(COURSES).map(({ lessonContent, ...publicFields }) => publicFields);
  return res.json(catalog);
});

app.post("/api/checkout", requireAuth, (req, res) => {
  const course = COURSES[req.body?.courseId];
  if (!course) {
    return res.status(404).json({ error: "Course not found" });
  }

  if (req.user.enrolledCourseIds.includes(course.id)) {
    return res.status(409).json({ error: "You are already enrolled in this course" });
  }

  const orderId = "ord_" + crypto.randomBytes(6).toString("hex");
  db.createOrder(orderId, req.user.email, course.id, course.price);

  return res.json({
    orderId,
    courseTitle: course.title,
    amount: course.price
  });
});

app.post("/api/confirm-payment", requireAuth, (req, res) => {
  const order = db.getOrder(req.body?.orderId);
  if (!order || order.email !== req.user.email) {
    return res.status(404).json({ error: "Order not found" });
  }

  if (!order.paid) {
    db.completePurchase(order.order_id, req.user.email, order.course_id);
  }

  const updatedEnrollments = db.getEnrolledCourseIds(req.user.email);
  return res.json({ enrolledCourseIds: updatedEnrollments });
});

app.get("/api/courses/:id/lesson", requireAuth, (req, res) => {
  const course = COURSES[req.params.id];
  if (!course) {
    return res.status(404).json({ error: "Course not found" });
  }

  if (!req.user.enrolledCourseIds.includes(course.id)) {
    return res.status(403).json({ error: "Purchase this course first to unlock lessons" });
  }

  return res.json({
    title: course.title,
    content: course.lessonContent
  });
});

async function startServer() {
  await db.initDb();
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});