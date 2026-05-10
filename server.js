require('dotenv').config();
const express = require('express');
const session = require(.express-session.);
const MemoryStore = require('memorystore')(session);
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// ── File Paths ────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  research: path.join(DATA_DIR, 'research.json'),
  articles: path.join(DATA_DIR, 'articles.json'),
  news:     path.join(DATA_DIR, 'news.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
};

// ── Helpers ───────────────────────────────────────────────────
const read = (file, def) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return def; }
};
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// ── Default Settings ──────────────────────────────────────────
const DEFAULT_SETTINGS = {
  hero: {
    siteTitle: 'Kshitij Sonal',
    tagline: 'Researcher · Economist · Writer',
    kicker: 'Welcome to My Research Hub',
    heading: "Exploring India's Economic Landscape",
    subtitle: 'Evidence-based research on macroeconomics, policy, and India\'s growth story.',
    metaLine: 'Researcher | Economist | Policy Analyst | Published Author',
    cta1Text: 'View Research', cta1Link: '/research.html',
    cta2Text: 'About Me', cta2Link: '/about.html',
    footerText: '© 2025 Kshitij Sonal. All rights reserved.',
    stat1Label: 'India GDP Rank', stat1Value: '#5 World',
    stat2Label: 'Services Sector', stat2Value: '54%',
    stat3Label: 'Manufacturing', stat3Value: '17%',
    stat4Label: 'IT Export Rank', stat4Value: '#1 Asia',
  },
  about: {
    name: 'Kshitij Sonal',
    titleLine: 'Researcher & Economist | Policy Analyst',
    bio1: "I am an economist and researcher specializing in macroeconomic policy, India's growth dynamics, and the intersection of technology and economic development. My work focuses on evidence-based analysis of India's evolving economic landscape.",
    bio2: "Over the years, I have published research across multiple domains including GDP analysis, sectoral growth, digital infrastructure, and fiscal policy. My research has been cited in academic journals and policy discussions at the national level.",
    bio3: "Beyond research, I am passionate about communicating complex economic ideas through accessible writing. I regularly contribute articles and essays on contemporary economic issues, bridging the gap between academic research and public understanding.",
    photoUrl: '',
    interests: 'Macroeconomics, Indian Economy, Policy Analysis, Data Science, Fiscal Policy, Digital Infrastructure, Academic Writing, Economic History',
  },
  social: { email: '', linkedin: '', twitter: '', github: '', researchgate: '', ssrn: '' },
  colors: {
    bg: '#0f0f0f', surface: '#1a1a1a', sidebar: '#141414',
    gold: '#c9a84c', orange: '#e07b39',
    text: '#e8e8e8', textSec: '#a0a0a0', muted: '#555555',
  },
  seo: {
    title: 'Kshitij Sonal | Researcher & Economist',
    description: "Personal research website of Kshitij Sonal — Economist, Policy Analyst, and Published Author.",
  },
  admin: { username: 'admin', passwordHash: '' },
};

// ── Sample Data ───────────────────────────────────────────────
const sampleResearch = [
  { id: uuidv4(), title: "India's GDP Growth Trajectory in the Post-Pandemic Era", area: 'Macroeconomics', abstract: "This paper examines India's remarkable economic recovery following the COVID-19 pandemic, analyzing the structural factors that enabled a resilient GDP growth trajectory. We explore fiscal stimulus measures, monetary policy responses, and sectoral contributions to aggregate demand recovery.", keywords: ['GDP', 'India', 'Post-Pandemic', 'Economic Recovery', 'Fiscal Policy'], date: '2024-03-15', body: "<h2>Introduction</h2><p>India's economic recovery from the COVID-19 pandemic has been one of the most remarkable stories in global economics. Despite a historic GDP contraction of 7.3% in FY2020-21, India bounced back with 8.7% growth in FY2021-22.</p><h2>Methodology</h2><p>This study employs a mixed-methods approach combining quantitative analysis of macroeconomic indicators with qualitative assessment of policy interventions.</p><h2>Key Findings</h2><p>Our analysis reveals three primary drivers of recovery: (1) robust government capital expenditure, (2) digital infrastructure enabling service sector resilience, and (3) strong export performance in IT and pharmaceuticals.</p><h2>Conclusion</h2><p>India's post-pandemic recovery trajectory demonstrates the importance of fiscal space management and structural reform in building economic resilience.</p>", link: '', createdAt: new Date().toISOString() },
  { id: uuidv4(), title: "Digital Infrastructure and India's Service Sector Expansion", area: 'Policy Analysis', abstract: 'An empirical investigation into how digital public infrastructure—including UPI, Aadhaar, and broadband expansion—has catalyzed growth in India\'s service sector, contributing significantly to the nation\'s 54% services share of GDP.', keywords: ['Digital Infrastructure', 'Service Sector', 'UPI', 'India', 'Technology'], date: '2023-11-20', body: "<h2>Abstract</h2><p>Digital infrastructure has emerged as a critical enabler of India's service sector growth. This paper provides empirical evidence linking India Stack components to measurable productivity gains across financial services, retail, and professional services.</p><h2>India Stack: A Transformative Framework</h2><p>The JAM trinity (Jan Dhan, Aadhaar, Mobile) and UPI have collectively onboarded over 500 million Indians into the formal financial system, creating an unprecedented digital services market.</p><h2>Sectoral Impact Analysis</h2><p>Financial technology services have grown at a CAGR of 22% since UPI's launch in 2016. E-commerce, enabled by digital payments and identity verification, now represents 7% of total retail trade.</p>", link: '', createdAt: new Date().toISOString() },
  { id: uuidv4(), title: 'Manufacturing Sector Challenges: India vs. East Asian Economies', area: 'Comparative Economics', abstract: 'A comparative analysis of manufacturing sector performance between India and East Asian economies, identifying structural bottlenecks and policy opportunities to increase India\'s manufacturing share beyond the current 17% of GDP.', keywords: ['Manufacturing', 'East Asia', 'India', 'Comparative Study', 'Industrialization'], date: '2023-07-08', body: "<h2>Introduction</h2><p>India's manufacturing sector has consistently underperformed relative to its East Asian peers. While China, Vietnam, and Bangladesh have leveraged manufacturing as an engine of growth, India's sector stagnated at 15-17% of GDP for over two decades.</p><h2>Comparative Analysis</h2><p>We compare India's manufacturing competitiveness across six dimensions: labor costs, logistics efficiency, regulatory environment, energy costs, infrastructure quality, and skill availability.</p><h2>Policy Recommendations</h2><p>The PLI (Production-Linked Incentive) scheme represents a promising intervention. Our analysis suggests that sector-specific targeting, combined with logistics reform under PM Gati Shakti, could add 3-4 percentage points to manufacturing's GDP share by 2030.</p>", link: '', createdAt: new Date().toISOString() },
];

const sampleArticles = [
  { id: uuidv4(), title: "The Paradox of India's IT Dominance", category: 'Commentary', excerpt: "How can a nation ranked #1 in Asia for IT exports still struggle with last-mile digital connectivity? India's IT paradox reveals deep structural divides between its globally competitive tech elite and its digitally excluded masses.", body: "<p>India's IT industry is a global phenomenon. With over $250 billion in annual exports and a presence in virtually every Fortune 500 company's technology supply chain, India has earned its reputation as the world's back office.</p><p>Yet step outside the gleaming campuses of Bengaluru's Electronic City or Hyderabad's HITEC City, and a starkly different reality emerges. Broadband penetration in rural India remains below 40%. Digital literacy among adults over 45 hovers around 25%. The India that exports software sophistication to the world cannot yet reliably deliver last-mile digital services to its own citizens.</p><p>This is India's IT paradox — a nation simultaneously at the cutting edge and the trailing edge of the digital revolution.</p>", tags: ['IT', 'Digital Divide', 'India', 'Technology'], date: '2024-04-20', createdAt: new Date().toISOString() },
  { id: uuidv4(), title: 'Rethinking Fiscal Policy in Emerging Economies', category: 'Economics', excerpt: 'Traditional fiscal conservatism may be poorly suited to the development challenges facing emerging economies. This essay argues for a more dynamic, growth-oriented fiscal framework that balances sustainability with investment imperatives.', body: "<p>The fiscal policy debate in emerging economies has long been dominated by a conservative orthodoxy inherited from IMF structural adjustment programmes of the 1980s and 1990s. The prescription was simple: cut deficits, reduce debt, and let markets allocate resources efficiently.</p><p>But the empirical record tells a more complex story. Economies that maintained fiscal space for public investment — infrastructure, education, health — consistently outperformed those that pursued austerity. India's own experience with the FRBM (Fiscal Responsibility and Budget Management Act) illustrates both the value of fiscal rules and their limitations when applied rigidly during growth downturns.</p><p>The post-pandemic consensus is shifting. The IMF itself now recognizes that well-targeted public investment can be self-financing through growth multipliers. The question for India is not whether to invest, but where and how efficiently.</p>", tags: ['Fiscal Policy', 'Emerging Markets', 'Development', 'Economics'], date: '2024-02-10', createdAt: new Date().toISOString() },
  { id: uuidv4(), title: "India's Agricultural Transformation: Progress and Pitfalls", category: 'Policy', excerpt: "Despite employing 42% of India's workforce, agriculture contributes only 18% to GDP. This piece examines the challenges and opportunities in modernizing Indian agriculture while protecting farmer livelihoods.", body: "<p>Agriculture remains the backbone of India's rural economy, yet its contribution to national GDP has steadily declined from 30% in 1990 to around 18% today — even as it continues to employ nearly half the workforce. This structural paradox represents one of India's most pressing development challenges.</p><p>The farm law protests of 2020-21 dramatically illustrated the political sensitivity of agricultural reform. But beyond the politics lies a genuine economic dilemma: how do you modernize agriculture, improve efficiency, and integrate farmers into market supply chains without exposing millions of smallholder farmers to price volatility and corporate market power?</p><p>The answer lies in sequenced reform — building market infrastructure, crop insurance systems, and farmer producer organizations before liberalizing procurement.</p>", tags: ['Agriculture', 'Rural Economy', 'India', 'Policy Reform'], date: '2024-01-05', createdAt: new Date().toISOString() },
];

const sampleNews = [
  { id: uuidv4(), headline: "New Research Paper Published on India's Post-Pandemic GDP Recovery", category: 'Publication', content: "Kshitij Sonal's latest research paper examining India's GDP growth trajectory in the post-pandemic era has been accepted for publication. The paper provides a comprehensive analysis of fiscal and monetary policy responses and identifies key structural drivers of India's resilient recovery.", date: '2024-03-20', link: '', createdAt: new Date().toISOString() },
  { id: uuidv4(), headline: 'Invited Speaker at National Economic Policy Symposium 2024', category: 'Event', content: 'Kshitij Sonal has been invited as a speaker at the National Economic Policy Symposium, where he will present findings from his research on digital infrastructure and India\'s service sector growth. The symposium brings together leading economists and policymakers from across India.', date: '2024-02-15', link: '', createdAt: new Date().toISOString() },
  { id: uuidv4(), headline: 'Article Featured in Leading Economic Policy Journal', category: 'Media', content: "The article 'Rethinking Fiscal Policy in Emerging Economies' has been featured in a leading economic policy journal, generating significant discussion among policymakers and academics. The piece has been widely shared across academic and policy networks.", date: '2024-01-18', link: '', createdAt: new Date().toISOString() },
];

// ── Init Data ─────────────────────────────────────────────────
function initData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILES.research)) write(FILES.research, sampleResearch);
  if (!fs.existsSync(FILES.articles)) write(FILES.articles, sampleArticles);
  if (!fs.existsSync(FILES.news))     write(FILES.news, sampleNews);
  if (!fs.existsSync(FILES.settings)) {
    const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    s.admin.passwordHash = bcrypt.hashSync('admin123', 10);
    write(FILES.settings, s);
  } else {
    const s = read(FILES.settings, {});
    if (!s.admin?.passwordHash) {
      if (!s.admin) s.admin = {};
      s.admin.passwordHash = bcrypt.hashSync('admin123', 10);
      write(FILES.settings, s);
    }
  }
}

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'ks-secret-2024-change-me',
  resave: false,
  saveUninitialized: false,
  store: new MemoryStore({ checkPeriod: 86400000 }),
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 },
}));
app.use(express.static(path.join(__dirname, 'public')));

const requireAdmin = (req, res, next) => {
  if (req.session?.isAdmin) return next();
  res.status(401).json({ error: 'Unauthorized' });
};

// ── Public API ────────────────────────────────────────────────
app.get('/api/research', (req, res) => {
  res.json(read(FILES.research, []).sort((a,b) => new Date(b.date) - new Date(a.date)));
});
app.get('/api/articles', (req, res) => {
  res.json(read(FILES.articles, []).sort((a,b) => new Date(b.date) - new Date(a.date)));
});
app.get('/api/news', (req, res) => {
  res.json(read(FILES.news, []).sort((a,b) => new Date(b.date) - new Date(a.date)));
});
app.get('/api/settings', (req, res) => {
  const s = read(FILES.settings, DEFAULT_SETTINGS);
  const { admin, ...pub } = s;
  res.json(pub);
});
app.get('/api/post/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const fileMap = { research: FILES.research, articles: FILES.articles, news: FILES.news };
  if (!fileMap[type]) return res.status(400).json({ error: 'Invalid type' });
  const item = read(fileMap[type], []).find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'Missing required fields' });
  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: `"${name}" <${process.env.SMTP_USER}>`,
        to: process.env.CONTACT_TO || process.env.SMTP_USER,
        replyTo: email,
        subject: `[Contact] ${subject || 'New Message'} — from ${name}`,
        html: `<p><strong>From:</strong> ${name} &lt;${email}&gt;</p><p><strong>Subject:</strong> ${subject}</p><hr><p>${message.replace(/\n/g,'<br>')}</p>`,
      });
    } else {
      console.log('[Contact Form Submission]', { name, email, subject, message });
    }
    res.json({ success: true, message: 'Message sent successfully!' });
  } catch (err) {
    console.error('Mail error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ── Admin Auth ────────────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const s = read(FILES.settings, DEFAULT_SETTINGS);
  const admin = s.admin || {};
  if (username !== admin.username || !bcrypt.compareSync(password, admin.passwordHash || '')) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  req.session.isAdmin = true;
  req.session.username = username;
  res.json({ success: true });
});
app.post('/api/admin/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });
app.get('/api/admin/check', (req, res) => res.json({ isAdmin: !!req.session?.isAdmin }));

// ── Admin CRUD — Research ─────────────────────────────────────
app.post('/api/admin/research', requireAdmin, (req, res) => {
  const items = read(FILES.research, []);
  const item = { id: uuidv4(), ...req.body, createdAt: new Date().toISOString() };
  items.unshift(item); write(FILES.research, items); res.json(item);
});
app.put('/api/admin/research/:id', requireAdmin, (req, res) => {
  const items = read(FILES.research, []);
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  items[idx] = { ...items[idx], ...req.body }; write(FILES.research, items); res.json(items[idx]);
});
app.delete('/api/admin/research/:id', requireAdmin, (req, res) => {
  write(FILES.research, read(FILES.research, []).filter(i => i.id !== req.params.id));
  res.json({ success: true });
});

// ── Admin CRUD — Articles ─────────────────────────────────────
app.post('/api/admin/articles', requireAdmin, (req, res) => {
  const items = read(FILES.articles, []);
  const item = { id: uuidv4(), ...req.body, createdAt: new Date().toISOString() };
  items.unshift(item); write(FILES.articles, items); res.json(item);
});
app.put('/api/admin/articles/:id', requireAdmin, (req, res) => {
  const items = read(FILES.articles, []);
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  items[idx] = { ...items[idx], ...req.body }; write(FILES.articles, items); res.json(items[idx]);
});
app.delete('/api/admin/articles/:id', requireAdmin, (req, res) => {
  write(FILES.articles, read(FILES.articles, []).filter(i => i.id !== req.params.id));
  res.json({ success: true });
});

// ── Admin CRUD — News ─────────────────────────────────────────
app.post('/api/admin/news', requireAdmin, (req, res) => {
  const items = read(FILES.news, []);
  const item = { id: uuidv4(), ...req.body, createdAt: new Date().toISOString() };
  items.unshift(item); write(FILES.news, items); res.json(item);
});
app.put('/api/admin/news/:id', requireAdmin, (req, res) => {
  const items = read(FILES.news, []);
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  items[idx] = { ...items[idx], ...req.body }; write(FILES.news, items); res.json(items[idx]);
});
app.delete('/api/admin/news/:id', requireAdmin, (req, res) => {
  write(FILES.news, read(FILES.news, []).filter(i => i.id !== req.params.id));
  res.json({ success: true });
});

// ── Admin — Settings ──────────────────────────────────────────
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  res.json(read(FILES.settings, DEFAULT_SETTINGS));
});
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  const current = read(FILES.settings, DEFAULT_SETTINGS);
  const updated = { ...current, ...req.body, admin: current.admin };
  write(FILES.settings, updated); res.json({ success: true });
});
app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const s = read(FILES.settings, DEFAULT_SETTINGS);
  if (!bcrypt.compareSync(oldPassword, s.admin.passwordHash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  s.admin.passwordHash = bcrypt.hashSync(newPassword, 10);
  write(FILES.settings, s); res.json({ success: true });
});
app.get('/api/admin/export', requireAdmin, (req, res) => {
  const data = {
    research: read(FILES.research, []),
    articles: read(FILES.articles, []),
    news: read(FILES.news, []),
    exportedAt: new Date().toISOString(),
  };
  res.setHeader('Content-Disposition', 'attachment; filename="kshitij-sonal-export.json"');
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify(data, null, 2));
});
app.delete('/api/admin/clear-all', requireAdmin, (req, res) => {
  write(FILES.research, []); write(FILES.articles, []); write(FILES.news, []);
  res.json({ success: true });
});
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const research = read(FILES.research, []);
  const articles = read(FILES.articles, []);
  const news     = read(FILES.news, []);
  const all = [
    ...research.map(i=>({...i,type:'Research'})),
    ...articles.map(i=>({...i,type:'Article'})),
    ...news.map(i=>({...i,type:'News'})),
  ].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,6);
  res.json({ research: research.length, articles: articles.length, news: news.length, total: research.length+articles.length+news.length, recent: all });
});

// ── Start ─────────────────────────────────────────────────────
initData();
app.listen(PORT, () => console.log(`\n🚀 Kshitij Sonal website running at http://localhost:${PORT}\n   Admin panel: http://localhost:${PORT}/admin/login.html\n   Login: admin / admin123\n`));
