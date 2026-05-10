const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");

admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ── Environment Variables ──────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || "ks-jwt-secret-2024-change-in-prod";
const JWT_EXPIRY = "24h";

// ── Default Settings ──────────────────────────────────────────
const DEFAULT_SETTINGS = {
  hero: {
    siteTitle: "Kshitij Sonal",
    tagline: "Researcher · Economist · Writer",
    kicker: "Welcome to My Research Hub",
    heading: "Exploring India's Economic Landscape",
    subtitle: "Evidence-based research on macroeconomics, policy, and India's growth story.",
    metaLine: "Researcher | Economist | Policy Analyst | Published Author",
    cta1Text: "View Research", cta1Link: "/research.html",
    cta2Text: "About Me", cta2Link: "/about.html",
    footerText: "© 2025 Kshitij Sonal. All rights reserved.",
    stat1Label: "India GDP Rank", stat1Value: "#5 World",
    stat2Label: "Services Sector", stat2Value: "54%",
    stat3Label: "Manufacturing", stat3Value: "17%",
    stat4Label: "IT Export Rank", stat4Value: "#1 Asia",
  },
  about: {
    name: "Kshitij Sonal",
    titleLine: "Researcher & Economist | Policy Analyst",
    bio1: "I am an economist and researcher specializing in macroeconomic policy, India's growth dynamics, and the intersection of technology and economic development.",
    bio2: "Over the years, I have published research across multiple domains including GDP analysis, sectoral growth, digital infrastructure, and fiscal policy.",
    bio3: "Beyond research, I am passionate about communicating complex economic ideas through accessible writing.",
    photoUrl: "",
    interests: "Macroeconomics, Indian Economy, Policy Analysis, Data Science, Fiscal Policy, Digital Infrastructure, Academic Writing, Economic History",
  },
  social: { email: "", linkedin: "", twitter: "", github: "", researchgate: "", ssrn: "" },
  colors: {
    bg: "#0f0f0f", surface: "#1a1a1a", sidebar: "#141414",
    gold: "#c9a84c", orange: "#e07b39",
    text: "#e8e8e8", textSec: "#a0a0a0", muted: "#555555",
  },
  seo: {
    title: "Kshitij Sonal | Researcher & Economist",
    description: "Personal research website of Kshitij Sonal — Economist, Policy Analyst, and Published Author.",
  },
  admin: { username: "admin", passwordHash: "" },
};

// ── Firestore Helpers ─────────────────────────────────────────
async function getCollection(name) {
  const snap = await db.collection(name).orderBy("date", "desc").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getSettings() {
  const doc = await db.collection("meta").doc("settings").get();
  if (!doc.exists) return DEFAULT_SETTINGS;
  return doc.data();
}

// ── Auth Middleware ────────────────────────────────────────────
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.adminUser = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ── Public API ─────────────────────────────────────────────────
app.get("/api/research", async (req, res) => {
  try { res.json(await getCollection("research")); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/articles", async (req, res) => {
  try { res.json(await getCollection("articles")); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/news", async (req, res) => {
  try { res.json(await getCollection("news")); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/settings", async (req, res) => {
  try {
    const s = await getSettings();
    const { admin, ...pub } = s;
    res.json(pub);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/post/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  const allowed = ["research", "articles", "news"];
  if (!allowed.includes(type)) return res.status(400).json({ error: "Invalid type" });
  try {
    const doc = await db.collection(type).doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "Not found" });
    res.json({ id: doc.id, ...doc.data() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/contact", async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: "Missing required fields" });
  try {
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    if (smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false,
        auth: { user: smtpUser, pass: smtpPass },
      });
      await transporter.sendMail({
        from: `"${name}" <${smtpUser}>`,
        to: process.env.SMTP_TO || smtpUser,
        replyTo: email,
        subject: `[Contact] ${subject || "New Message"} — from ${name}`,
        html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p><strong>Subject:</strong> ${subject}</p><hr><p>${message.replace(/\n/g, "<br>")}</p>`,
      });
    } else {
      console.log("[Contact Form]", { name, email, subject, message });
    }
    res.json({ success: true, message: "Message sent successfully!" });
  } catch (err) {
    console.error("Mail error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ── Admin Auth ─────────────────────────────────────────────────
app.post("/api/admin/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const s = await getSettings();
    const adminCfg = s.admin || {};
    // If no password hash set yet, use default admin123
    const hashToCheck = adminCfg.passwordHash || bcrypt.hashSync("admin123", 10);
    if (username !== (adminCfg.username || "admin") || !bcrypt.compareSync(password, hashToCheck)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ username, isAdmin: true }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    res.json({ success: true, token });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/logout", (req, res) => res.json({ success: true }));
app.get("/api/admin/check", requireAdmin, (req, res) => res.json({ isAdmin: true }));

// ── Admin Stats ────────────────────────────────────────────────
app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  try {
    const [rSnap, aSnap, nSnap] = await Promise.all([
      db.collection("research").get(),
      db.collection("articles").get(),
      db.collection("news").get(),
    ]);
    const toArr = (snap, type) => snap.docs.map(d => ({ id: d.id, ...d.data(), type }));
    const all = [
      ...toArr(rSnap, "Research"),
      ...toArr(aSnap, "Article"),
      ...toArr(nSnap, "News"),
    ].sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)).slice(0, 6);
    res.json({
      research: rSnap.size, articles: aSnap.size, news: nSnap.size,
      total: rSnap.size + aSnap.size + nSnap.size, recent: all,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin CRUD — Generic ───────────────────────────────────────
function crudRoutes(collectionName) {
  app.post(`/api/admin/${collectionName}`, requireAdmin, async (req, res) => {
    try {
      const id = uuidv4();
      const item = { ...req.body, createdAt: new Date().toISOString() };
      await db.collection(collectionName).doc(id).set(item);
      res.json({ id, ...item });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.put(`/api/admin/${collectionName}/:id`, requireAdmin, async (req, res) => {
    try {
      const ref = db.collection(collectionName).doc(req.params.id);
      const doc = await ref.get();
      if (!doc.exists) return res.status(404).json({ error: "Not found" });
      await ref.update(req.body);
      res.json({ id: req.params.id, ...doc.data(), ...req.body });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.delete(`/api/admin/${collectionName}/:id`, requireAdmin, async (req, res) => {
    try {
      await db.collection(collectionName).doc(req.params.id).delete();
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
}

crudRoutes("research");
crudRoutes("articles");
crudRoutes("news");

// ── Admin Settings ─────────────────────────────────────────────
app.get("/api/admin/settings", requireAdmin, async (req, res) => {
  try { res.json(await getSettings()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put("/api/admin/settings", requireAdmin, async (req, res) => {
  try {
    const current = await getSettings();
    const updated = { ...current, ...req.body, admin: current.admin };
    await db.collection("meta").doc("settings").set(updated);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/admin/change-password", requireAdmin, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const s = await getSettings();
    const currentHash = s.admin && s.admin.passwordHash ? s.admin.passwordHash : bcrypt.hashSync("admin123", 10);
    if (!bcrypt.compareSync(oldPassword, currentHash)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    const updated = { ...s, admin: { ...s.admin, passwordHash: bcrypt.hashSync(newPassword, 10) } };
    await db.collection("meta").doc("settings").set(updated);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/admin/export", requireAdmin, async (req, res) => {
  try {
    const [research, articles, news] = await Promise.all([
      getCollection("research"), getCollection("articles"), getCollection("news"),
    ]);
    res.setHeader("Content-Disposition", "attachment; filename=\"kshitij-sonal-export.json\"");
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({ research, articles, news, exportedAt: new Date().toISOString() }, null, 2));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/admin/clear-all", requireAdmin, async (req, res) => {
  try {
    const deleteCol = async (name) => {
      const snap = await db.collection(name).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    };
    await Promise.all([deleteCol("research"), deleteCol("articles"), deleteCol("news")]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Seed (one-time to populate sample data) ───────────────────
app.post("/api/admin/seed", requireAdmin, async (req, res) => {
  try {
    const sampleResearch = [
      { title: "India's GDP Growth Trajectory in the Post-Pandemic Era", area: "Macroeconomics", abstract: "This paper examines India's remarkable economic recovery following the COVID-19 pandemic, analyzing structural factors that enabled a resilient GDP growth trajectory.", keywords: ["GDP", "India", "Post-Pandemic", "Economic Recovery", "Fiscal Policy"], date: "2024-03-15", body: "<h2>Introduction</h2><p>India's economic recovery from the COVID-19 pandemic has been one of the most remarkable stories in global economics. Despite a historic GDP contraction of 7.3% in FY2020-21, India bounced back with 8.7% growth in FY2021-22.</p><h2>Key Findings</h2><p>Our analysis reveals three primary drivers: robust government capital expenditure, digital infrastructure enabling service sector resilience, and strong export performance in IT and pharmaceuticals.</p>", link: "", createdAt: new Date().toISOString() },
      { title: "Digital Infrastructure and India's Service Sector Expansion", area: "Policy Analysis", abstract: "An empirical investigation into how digital public infrastructure has catalyzed growth in India's service sector.", keywords: ["Digital Infrastructure", "Service Sector", "UPI", "India"], date: "2023-11-20", body: "<h2>Abstract</h2><p>Digital infrastructure has emerged as a critical enabler of India's service sector growth. The JAM trinity and UPI have collectively onboarded over 500 million Indians into the formal financial system.</p>", link: "", createdAt: new Date().toISOString() },
      { title: "Manufacturing Sector Challenges: India vs. East Asian Economies", area: "Comparative Economics", abstract: "A comparative analysis of manufacturing sector performance between India and East Asian economies.", keywords: ["Manufacturing", "East Asia", "India", "Industrialization"], date: "2023-07-08", body: "<h2>Introduction</h2><p>India's manufacturing sector has consistently underperformed relative to its East Asian peers.</p><h2>Policy Recommendations</h2><p>The PLI scheme represents a promising intervention that could add 3-4 percentage points to manufacturing's GDP share by 2030.</p>", link: "", createdAt: new Date().toISOString() },
    ];
    const sampleArticles = [
      { title: "The Paradox of India's IT Dominance", category: "Commentary", excerpt: "How can a nation ranked #1 in Asia for IT exports still struggle with last-mile digital connectivity?", body: "<p>India's IT industry is a global phenomenon. With over $250 billion in annual exports, India has earned its reputation as the world's back office. Yet broadband penetration in rural India remains below 40%.</p>", tags: ["IT", "Digital Divide", "India", "Technology"], date: "2024-04-20", createdAt: new Date().toISOString() },
      { title: "Rethinking Fiscal Policy in Emerging Economies", category: "Economics", excerpt: "Traditional fiscal conservatism may be poorly suited to the development challenges facing emerging economies.", body: "<p>The fiscal policy debate in emerging economies has long been dominated by a conservative orthodoxy. But the empirical record tells a more complex story.</p>", tags: ["Fiscal Policy", "Emerging Markets", "Development"], date: "2024-02-10", createdAt: new Date().toISOString() },
    ];
    const sampleNews = [
      { headline: "New Research Paper Published on India's Post-Pandemic GDP Recovery", category: "Publication", content: "Kshitij Sonal's latest research paper examining India's GDP growth trajectory has been accepted for publication.", date: "2024-03-20", link: "", createdAt: new Date().toISOString() },
      { headline: "Invited Speaker at National Economic Policy Symposium 2024", category: "Event", content: "Kshitij Sonal has been invited as a speaker at the National Economic Policy Symposium to present findings on digital infrastructure and India's service sector growth.", date: "2024-02-15", link: "", createdAt: new Date().toISOString() },
    ];
    for (const item of sampleResearch) await db.collection("research").doc(uuidv4()).set(item);
    for (const item of sampleArticles) await db.collection("articles").doc(uuidv4()).set(item);
    for (const item of sampleNews) await db.collection("news").doc(uuidv4()).set(item);
    res.json({ success: true, message: "Sample data seeded successfully!" });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

exports.api = functions.https.onRequest(app);
