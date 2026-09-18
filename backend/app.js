const express = require('express');
const session = require('express-session');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const ADMIN = path.join(PUBLIC, 'admin');
const DATA = path.join(ROOT, 'data');
const UPLOADS = path.join(PUBLIC, 'uploads');
const DB_FILE = path.join(DATA, 'behradar.sqlite3');

if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

const db = new sqlite3.Database(DB_FILE);
db.serialize(function () {
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL');
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, password_hash TEXT, role TEXT NOT NULL DEFAULT \'student\', theme TEXT NOT NULL DEFAULT \'light\', author_job TEXT DEFAULT \'مدرس ارشد زبان انگلیسی\', avatar TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
  db.run('CREATE TABLE IF NOT EXISTS otp_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, code TEXT NOT NULL, full_name TEXT, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)');
  db.run('CREATE TABLE IF NOT EXISTS access_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, phone TEXT NOT NULL, password_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT \'pending\', requested_at TEXT NOT NULL, reviewed_at TEXT, reviewed_by INTEGER, FOREIGN KEY(reviewed_by) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS articles (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, category TEXT NOT NULL, category_label TEXT NOT NULL, status TEXT NOT NULL DEFAULT \'draft\', summary TEXT NOT NULL, author_id INTEGER NOT NULL, reading_time TEXT NOT NULL DEFAULT \'۵ دقیقه\', image TEXT, tags TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(author_id) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS article_blocks (id INTEGER PRIMARY KEY AUTOINCREMENT, article_id INTEGER NOT NULL, block_order INTEGER NOT NULL, block_type TEXT NOT NULL, title TEXT, body TEXT, FOREIGN KEY(article_id) REFERENCES articles(id) ON DELETE CASCADE)');
  db.run('CREATE TABLE IF NOT EXISTS files (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL, grade TEXT, file_name TEXT NOT NULL, file_path TEXT NOT NULL, mime_type TEXT, size INTEGER NOT NULL DEFAULT 0, uploaded_by INTEGER NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(uploaded_by) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id INTEGER NOT NULL, receiver_id INTEGER NOT NULL, subject TEXT, body TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, FOREIGN KEY(sender_id) REFERENCES users(id), FOREIGN KEY(receiver_id) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS tests (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT NOT NULL UNIQUE, title TEXT NOT NULL, description TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)');
  db.run('CREATE TABLE IF NOT EXISTS test_questions (id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER NOT NULL, question TEXT NOT NULL, options_json TEXT NOT NULL, correct_index INTEGER NOT NULL, explanation TEXT, FOREIGN KEY(test_id) REFERENCES tests(id) ON DELETE CASCADE)');
  db.run('CREATE TABLE IF NOT EXISTS test_results (id INTEGER PRIMARY KEY AUTOINCREMENT, test_id INTEGER NOT NULL, student_id INTEGER, score INTEGER NOT NULL, total INTEGER NOT NULL, level TEXT NOT NULL, answers_json TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(test_id) REFERENCES tests(id), FOREIGN KEY(student_id) REFERENCES users(id))');
  db.run('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
  seed();
});

function now() { return new Date().toISOString(); }
function run(sql, params) { return new Promise(function (resolve, reject) { db.run(sql, params || [], function (err) { if (err) reject(err); else resolve({ id: this.lastID, changes: this.changes }); }); }); }
function get(sql, params) { return new Promise(function (resolve, reject) { db.get(sql, params || [], function (err, row) { if (err) reject(err); else resolve(row); }); }); }
function all(sql, params) { return new Promise(function (resolve, reject) { db.all(sql, params || [], function (err, rows) { if (err) reject(err); else resolve(rows); }); }); }
function slugify(value) { return String(value).toLowerCase().trim().replace(/[^\w\u0600-\u06FF\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '') || ('article-' + Date.now()); }
function hashPassword(password) { const salt = crypto.randomBytes(16).toString('hex'); const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 64, 'sha512').toString('hex'); return salt + ':' + hash; }
function verifyPassword(password, stored) { if (!stored || stored.indexOf(':') === -1) return false; const parts = stored.split(':'); const hash = crypto.pbkdf2Sync(String(password), parts[0], 120000, 64, 'sha512').toString('hex'); return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(parts[1], 'hex')); }
function safeUser(user) { if (!user) return null; return { id: user.id, full_name: user.full_name, phone: user.phone, role: user.role, theme: user.theme, author_job: user.author_job || 'مدرس ارشد زبان انگلیسی', avatar: user.avatar, is_active: user.is_active, created_at: user.created_at }; }
function requireTeacher(req, res, next) { if (req.session && req.session.userId && req.session.role === 'teacher') return next(); if (req.path.indexOf('/api/') === 0) return res.status(401).json({ success: false, message: 'نیاز به ورود استاد دارید.' }); return res.redirect('/admin/index.html'); }
function requireMaster(req, res, next) { if (req.session && req.session.userId && req.session.role === 'teacher') return next(); return res.status(401).json({ success: false, message: 'نیاز به ورود استاد دارید.' }); }
function uniqueSlug(base, excludeId) { return get('SELECT id FROM articles WHERE slug = ? AND id != ?', [base, excludeId || 0]).then(function (row) { return row ? base + '-' + Date.now() : base; }); }

async function seed() {
  const master = await get('SELECT id FROM users WHERE phone = ?', ['09000000000']);
  if (!master) {
    await run('INSERT INTO users (full_name, phone, password_hash, role, theme, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)', ['استاد اصلی', '09000000000', hashPassword('123'), 'teacher', 'light', now(), now()]);
  }
  const testCount = await get('SELECT COUNT(*) AS count FROM tests');
  if (!testCount || testCount.count === 0) seedTests();
}

function seedTests() {
  const levels = [
    ['A1', 'آزمون پایه A1', 'آزمون تشخیصی هم‌راستا با CEFR برای زبان‌آموزان مبتدی.'],
    ['A2', 'آزمون پایه A2', 'آزمون تشخیصی هم‌راستا با CEFR برای سطح پیش‌متوسط.'],
    ['B1', 'آزمون پایه B1', 'آزمون تشخیصی هم‌راستا با CEFR برای سطح متوسط.'],
    ['B2', 'آزمون پایه B2', 'آزمون تشخیصی هم‌راستا با CEFR برای سطح بالاتر از متوسط.'],
    ['C1', 'آزمون پایه C1', 'آزمون تشخیصی هم‌راستا با CEFR برای سطح پیشرفته.'],
    ['C2', 'آزمون پایه C2', 'آزمون تشخیصی هم‌راستا با CEFR برای سطح تسلط.']
  ];
  const bank = {
    A1: [
      ['She ___ a student.', ['am','is','are','be'], 1], ['I have ___ apple.', ['a','an','the','-'], 1], ['They ___ from Iran.', ['is','are','am','be'], 1], ['What ___ your name?', ['am','is','are','be'], 1], ['We go to school ___ Monday.', ['in','on','at','by'], 1], ['There ___ a book on the table.', ['are','is','be','am'], 1], ['He ___ coffee every morning.', ['drink','drinks','drinking','drank'], 1], ['My sister is ___ than me.', ['young','younger','youngest','more young'], 1], ['I can ___ English.', ['speaks','speaking','speak','spoke'], 2], ['Where ___ you live?', ['do','does','are','is'], 0], ['This is ___ pen.', ['I','me','my','mine'], 2], ['How many brothers ___ you have?', ['does','do','are','is'], 1], ['The opposite of “big” is ___.', ['small','long','high','fast'], 0], ['Please ___ the door.', ['open','opens','opening','opened'], 0], ['Yesterday I ___ at home.', ['am','is','was','were'], 2], ['She ___ TV every evening.', ['watch','watches','watched','watching'], 1], ['I am interested ___ music.', ['on','at','in','to'], 2], ['Can you help ___?', ['I','me','my','mine'], 1], ['We ___ lunch now.', ['have','had','are having','has'], 2], ['How ___ is this book?', ['many','much','old','long'], 3]
    ],
    A2: [
      ['I have lived here ___ 2020.', ['for','since','from','during'], 1], ['She ___ to the cinema last night.', ['go','goes','went','gone'], 2], ['There isn’t ___ milk left.', ['many','some','any','few'], 2], ['If it rains, we ___ at home.', ['stay','will stay','stayed','staying'], 1], ['He is good ___ mathematics.', ['in','at','on','for'], 1], ['I ___ my homework before dinner yesterday.', ['finish','finished','have finished','am finishing'], 1], ['This bag is ___ than that one.', ['cheap','cheaper','cheapest','more cheap'], 1], ['Would you like ___ tea?', ['some','any','many','few'], 0], ['She has never ___ to London.', ['be','been','was','being'], 1], ['You ___ smoke here.', ['must','mustn’t','can','could'], 1], ['I’m looking ___ my keys.', ['at','for','on','to'], 1], ['He said he ___ tired.', ['is','was','were','be'], 1], ['We used ___ play outside.', ['to','for','at','-'], 0], ['How long ___ you known him?', ['did','do','have','are'], 2], ['The train arrives ___ 7 pm.', ['in','on','at','to'], 2], ['I enjoy ___ books.', ['read','reading','to read','reads'], 1], ['She is afraid ___ spiders.', ['from','of','at','with'], 1], ['I need ___ information.', ['an','a','some','many'], 2], ['They were ___ dinner when I called.', ['have','had','having','has'], 2], ['Could you tell me where the station ___?', ['is','are','be','was'], 0]
    ],
    B1: [
      ['If I ___ enough money, I would travel more.', ['have','had','will have','am having'], 1], ['She has been working here ___ five years.', ['since','for','during','from'], 1], ['The report ___ by the manager yesterday.', ['approved','was approved','is approving','has approve'], 1], ['I wish I ___ more time.', ['have','had','will have','am having'], 1], ['He asked me ___ I needed help.', ['what','whether','which','where'], 1], ['By next month, they ___ the project.', ['finish','finished','will have finished','are finishing'], 2], ['Despite ___ tired, she continued working.', ['be','being','was','been'], 1], ['You should ___ a doctor.', ['see','to see','seeing','saw'], 0], ['The meeting was cancelled ___ the storm.', ['because','because of','although','despite'], 1], ['I’m not used to ___ so early.', ['wake','waking','woke','be wake'], 1], ['He ___ have forgotten the appointment.', ['must','should','can','would'], 0], ['Neither Ali nor Sara ___ available.', ['are','were','is','be'], 2], ['The teacher suggested ___ more practice.', ['do','to do','doing','did'], 2], ['I’d rather ___ at home tonight.', ['stay','staying','to stay','stayed'], 0], ['She told me she ___ the book before.', ['reads','had read','has read','is reading'], 1], ['We need to find a solution ___ the problem.', ['for','to','at','on'], 1], ['He is responsible ___ training new staff.', ['of','for','to','with'], 1], ['The film was much ___ than I expected.', ['interesting','more interesting','most interesting','interest'], 1], ['If you had called, I ___ helped you.', ['will have','would have','would','had'], 1], ['It’s time we ___ home.', ['go','went','have gone','are going'], 1]
    ],
    B2: [
      ['Had I known, I ___ you earlier.', ['would call','would have called','called','will call'], 1], ['The proposal needs ___ before publication.', ['review','reviewing','to review','reviewed'], 1], ['Hardly ___ when the alarm rang.', ['I had arrived','had I arrived','I arrived','did I arrive'], 1], ['She denied ___ the confidential file.', ['to open','opening','open','opened'], 1], ['The results are consistent ___ previous studies.', ['to','with','for','at'], 1], ['No sooner had he left ___ the phone rang.', ['when','than','then','that'], 1], ['The company is believed ___ the policy.', ['change','to have changed','changing','changed'], 1], ['Were it not for your help, we ___ failed.', ['would','will','would have','had'], 2], ['He spoke as though he ___ everything already.', ['knows','knew','has known','will know'], 1], ['The issue remains highly ___.', ['controversy','controversial','controversially','controversies'], 1], ['She is accustomed to ___ under pressure.', ['work','working','worked','be work'], 1], ['The committee objected ___ the proposal.', ['to','at','on','for'], 0], ['It is essential that every applicant ___ the form.', ['completes','complete','completed','will complete'], 1], ['The more you practice, ___ your fluency becomes.', ['the better','better','the best','more better'], 0], ['He would rather you ___ him directly.', ['tell','told','have told','telling'], 1], ['The project was completed on time, ___ several setbacks.', ['despite','although','because','whereas'], 0], ['I regret ___ you that your application was unsuccessful.', ['inform','to inform','informing','informed'], 1], ['The article raises questions that are far from ___.', ['settle','settled','settling','settlement'], 1], ['She has a tendency ___ details.', ['to overlook','overlooking','overlook','overlooked'], 0], ['His explanation was too vague to be ___.', ['rely','reliable','reliably','reliance'], 1]
    ],
    C1: [
      ['Were the evidence ___, the case would be reopened.', ['conclusive','conclusively','conclusion','conclude'], 0], ['The findings lend ___ to the hypothesis.', ['support','supportive','supported','supporting'], 0], ['She spoke with a degree of confidence that ___ everyone.', ['impressed','impressive','impression','impressing'], 0], ['Little ___ that the policy would have such consequences.', ['they knew','did they know','they had known','had they know'], 1], ['The report falls short ___ providing a viable alternative.', ['from','of','to','with'], 1], ['His remarks were open to several ___.', ['interpret','interpretations','interpreting','interpretive'], 1], ['It is imperative that the issue ___ without delay.', ['is addressed','be addressed','was addressed','has addressed'], 1], ['The author takes issue ___ the conventional account.', ['with','to','for','on'], 0], ['The results are by no means ___.', ['conclusive','conclusively','conclusion','conclude'], 0], ['She is credited ___ having transformed the programme.', ['with','for','to','of'], 0], ['The distinction is subtle but nevertheless ___.', ['meaningful','meaningfully','meaning','mean'], 0], ['He was reluctant to draw any firm ___.', ['conclude','conclusion','conclusions','conclusive'], 2], ['The policy has far-reaching ___.', ['implication','implications','imply','implied'], 1], ['The study provides a compelling ___ for reform.', ['case','reasoning','cause','occasion'], 0], ['The issue is more complex than it might first ___.', ['appear','appears','appeared','appearing'], 0], ['Not until later ___ the significance of the finding.', ['we understood','did we understand','we had understood','understood we'], 1], ['The proposal was met with considerable ___.', ['resist','resistance','resistant','resisting'], 1], ['She qualified her statement by ___ that the data were limited.', ['noting','note','to note','noted'], 0], ['His argument is predicated ___ the assumption that demand will rise.', ['in','on','at','to'], 1], ['The conclusion is difficult to ___ from the available data.', ['draw','make','take','give'], 0]
    ],
    C2: [
      ['The argument is so nuanced that it defies easy ___.', ['categorisation','categorise','categorical','categorically'], 0], ['His account is at odds ___ the available evidence.', ['to','with','for','from'], 1], ['The proposal was rejected, not because it was impractical, ___ because it was premature.', ['but','and','yet','or'], 0], ['The author’s caveat is easy to overlook, but it is by no means ___.', ['trivial','trivially','triviality','trivialise'], 0], ['The findings are equivocal, ___ a definitive conclusion.', ['precluding','precluded','preclude','to preclude'], 0], ['She was at pains ___ that the figures were provisional.', ['to stress','stressing','stress','stressed'], 0], ['The policy is unlikely to withstand close ___.', ['scrutiny','scrutinise','scrutinised','scrutinising'], 0], ['His criticism was couched in terms that were deliberately ___.', ['ambiguous','ambiguity','ambiguously','ambiguate'], 0], ['The evidence is too scant to ___ such a sweeping claim.', ['substantiate','substantial','substantially','substantiation'], 0], ['The distinction, though subtle, is of considerable ___.', ['import','important','importantly','importance'], 0], ['The report offers little by way of ___.', ['remedy','remedial','remediate','remediating'], 0], ['Her remarks were sufficiently ___ to warrant further investigation.', ['intriguing','intrigue','intrigued','intriguingly'], 0], ['The issue cannot be reduced to a simple dichotomy; it is inherently ___.', ['multifaceted','multifacetedly','multifacetedness','multifacet'], 0], ['The author’s thesis is predicated on a premise that is far from ___.', ['self-evident','self-evidently','evidence','evidentness'], 0], ['The committee’s decision was ostensibly based on cost, but the rationale was more ___.', ['complex','complexity','complexly','complexes'], 0], ['There is a tendency to conflate correlation ___ causation.', ['with','to','for','by'], 0], ['The article warrants careful reading, ___ its dense prose.', ['notwithstanding','although','despite of','whereas'], 0], ['He gave a response that was both measured and ___.', ['perspicacious','perspicacity','perspicaciously','perspicaciousness'], 0], ['The evidence does not lend itself ___ a straightforward interpretation.', ['to','for','with','at'], 0], ['Her conclusion was carefully worded so as not to ___ the data.', ['overstate','overstated','overstatement','overstating'], 0]
    ]
  };
  levels.forEach(function (item) {
    run('INSERT INTO tests (level,title,description,active) VALUES (?,?,?,1)', item).then(function (r) {
      (bank[item[0]] || []).forEach(function (q) { run('INSERT INTO test_questions (test_id,question,options_json,correct_index,explanation) VALUES (?,?,?,?,?)', [r.id, q[0], JSON.stringify(q[1]), q[2], 'پاسخ در بانک ارزیابی سطح ثبت شده است.']); });
    });
  });
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({ secret: process.env.SESSION_SECRET || 'behradar-local-session-2026', resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 12 } }));

const storage = multer.diskStorage({ destination: function (req, file, cb) { cb(null, UPLOADS); }, filename: function (req, file, cb) { const ext = path.extname(file.originalname).toLowerCase(); cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext); } });
const upload = multer({ storage: storage, limits: { fileSize: 15 * 1024 * 1024 } });

app.get('/admin', function (req, res) { res.redirect('/admin/index.html'); });
app.use('/admin', function (req, res, next) {
  if (req.path === '/index.html' || req.path === '/css/admin.css' || req.path.indexOf('/js/') === 0 || req.path.indexOf('/assets/') === 0) return express.static(ADMIN)(req, res, next);
  return requireTeacher(req, res, next);
});
app.use('/admin', express.static(ADMIN));

app.post('/api/auth/admin-login', async function (req, res) {
  try {
    const phone = normalizePhone(req.body.phone);
    const user = await get('SELECT * FROM users WHERE phone = ? AND role = \'teacher\' AND is_active = 1', [phone]);
    if (!user || !verifyPassword(req.body.password || '', user.password_hash)) return res.status(401).json({ success: false, message: 'شماره موبایل یا رمز عبور صحیح نیست.' });
    req.session.userId = user.id; req.session.role = 'teacher';
    res.json({ success: true, user: safeUser(user) });
  } catch (e) { res.status(500).json({ success: false, message: 'خطای سرور.' }); }
});
app.post('/api/auth/admin-logout', function (req, res) { req.session.destroy(function () { res.clearCookie('connect.sid'); res.json({ success: true }); }); });
app.get('/api/auth/me', async function (req, res) { if (!req.session.userId) return res.json({ authenticated: false }); const user = await get('SELECT * FROM users WHERE id = ?', [req.session.userId]); if (!user) return res.json({ authenticated: false }); res.json({ authenticated: true, user: safeUser(user) }); });

app.post('/api/teacher/access-request', async function (req, res) {
  try {
    const name = String(req.body.full_name || '').trim(); const phone = normalizePhone(req.body.phone); const password = String(req.body.password || '');
    if (!name || !phone || password.length < 3) return res.status(400).json({ success: false, message: 'نام، شماره و رمز عبور معتبر لازم است.' });
    const existing = await get('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing) return res.status(409).json({ success: false, message: 'این شماره قبلاً در سامانه ثبت شده است.' });
    const pending = await get('SELECT id FROM access_requests WHERE phone = ? AND status = \'pending\'', [phone]);
    if (pending) return res.status(409).json({ success: false, message: 'درخواست شما قبلاً ثبت شده و در انتظار بررسی است.' });
    await run('INSERT INTO access_requests (full_name,phone,password_hash,status,requested_at) VALUES (?,?,?,\'pending\',?)', [name, phone, hashPassword(password), now()]);
    res.json({ success: true, message: 'درخواست شما برای استادهای دارای دسترسی ارسال شد.' });
  } catch (e) { res.status(500).json({ success: false, message: 'خطا در ثبت درخواست.' }); }
});

app.post('/api/auth/request-otp', async function (req, res) {
  try {
    const name = String(req.body.full_name || '').trim(); const phone = normalizePhone(req.body.phone);
    if (!name || !phone) return res.status(400).json({ success: false, message: 'نام و شماره موبایل را وارد کنید.' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await run('INSERT INTO otp_codes (phone,code,full_name,expires_at,created_at) VALUES (?,?,?,?,?)', [phone, code, name, Date.now() + 5 * 60 * 1000, now()]);
    res.json({ success: true, message: 'کد تایید ایجاد شد.', dev_code: code });
  } catch (e) { res.status(500).json({ success: false, message: 'خطا در ارسال کد.' }); }
});
app.post('/api/auth/verify-otp', async function (req, res) {
  try {
    const phone = normalizePhone(req.body.phone); const code = String(req.body.code || '');
    const otp = await get('SELECT * FROM otp_codes WHERE phone = ? AND code = ? AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1', [phone, code, Date.now()]);
    if (!otp) return res.status(400).json({ success: false, message: 'کد تایید نادرست یا منقضی شده است.' });
    await run('UPDATE otp_codes SET used = 1 WHERE id = ?', [otp.id]);
    let user = await get('SELECT * FROM users WHERE phone = ?', [phone]);
    if (!user) { const r = await run('INSERT INTO users (full_name,phone,role,is_active,created_at,updated_at) VALUES (?,?,\'student\',1,?,?)', [otp.full_name || 'زبان‌آموز', phone, now(), now()]); user = await get('SELECT * FROM users WHERE id = ?', [r.id]); }
    res.json({ success: true, message: 'ثبت‌نام با موفقیت انجام شد.', user: safeUser(user) });
  } catch (e) { res.status(500).json({ success: false, message: 'خطا در ثبت‌نام.' }); }
});

app.get('/api/dashboard/stats', requireTeacher, async function (req, res) {
  const students = await get('SELECT COUNT(*) AS count FROM users WHERE role = \'student\''); const teachers = await get('SELECT COUNT(*) AS count FROM users WHERE role = \'teacher\''); const articles = await get('SELECT COUNT(*) AS count FROM articles'); const messages = await get('SELECT COUNT(*) AS count FROM messages WHERE receiver_id = ? AND is_read = 0', [req.session.userId]); const requests = await get('SELECT COUNT(*) AS count FROM access_requests WHERE status = \'pending\''); res.json({ students: students.count, teachers: teachers.count, articles: articles.count, unread_messages: messages.count, pending_requests: requests.count });
});
app.get('/api/students', requireTeacher, async function (req, res) { const rows = await all('SELECT id,full_name,phone,created_at,is_active FROM users WHERE role = \'student\' ORDER BY id DESC'); res.json(rows); });
app.get('/api/teachers', requireTeacher, async function (req, res) { const rows = await all('SELECT id,full_name,phone,theme,created_at FROM users WHERE role = \'teacher\' AND is_active = 1 ORDER BY full_name'); res.json(rows); });

app.get('/api/access-requests', requireTeacher, async function (req, res) { const rows = await all('SELECT id,full_name,phone,status,requested_at,reviewed_at FROM access_requests ORDER BY CASE WHEN status = \'pending\' THEN 0 ELSE 1 END, id DESC'); res.json(rows); });
app.post('/api/access-requests/:id/decision', requireTeacher, async function (req, res) {
  try {
    const request = await get('SELECT * FROM access_requests WHERE id = ?', [req.params.id]);
    if (!request || request.status !== 'pending') return res.status(404).json({ success: false, message: 'درخواست معتبر نیست.' });
    const decision = req.body.decision === 'approve' ? 'approved' : 'rejected';
    if (decision === 'approved') {
      const existing = await get('SELECT id FROM users WHERE phone = ?', [request.phone]);
      if (!existing) await run('INSERT INTO users (full_name,phone,password_hash,role,is_active,created_at,updated_at) VALUES (?,?,?,\'teacher\',1,?,?)', [request.full_name, request.phone, request.password_hash, now(), now()]);
    }
    await run('UPDATE access_requests SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?', [decision, now(), req.session.userId, request.id]);
    res.json({ success: true, message: decision === 'approved' ? 'دسترسی استاد تایید شد.' : 'درخواست رد شد.' });
  } catch (e) { res.status(500).json({ success: false, message: 'خطا در بررسی درخواست.' }); }
});

app.get('/api/profile', requireTeacher, async function (req, res) { const user = await get('SELECT * FROM users WHERE id = ?', [req.session.userId]); res.json(safeUser(user)); });
app.put('/api/profile', requireTeacher, async function (req, res) { try { const name = String(req.body.full_name || '').trim(); const job = String(req.body.author_job || '').trim(); if (!name) return res.status(400).json({ success: false, message: 'نام معتبر نیست.' }); await run('UPDATE users SET full_name = ?, author_job = ?, updated_at = ? WHERE id = ?', [name, job || 'مدرس ارشد زبان انگلیسی', now(), req.session.userId]); res.json({ success: true, user: safeUser(await get('SELECT * FROM users WHERE id = ?', [req.session.userId])) }); } catch (e) { res.status(500).json({ success: false, message: 'خطا در تغییر پروفایل.' }); } });
app.put('/api/profile/password', requireTeacher, async function (req, res) { try { const user = await get('SELECT * FROM users WHERE id = ?', [req.session.userId]); if (!verifyPassword(req.body.current_password || '', user.password_hash)) return res.status(400).json({ success: false, message: 'رمز فعلی صحیح نیست.' }); if (String(req.body.new_password || '').length < 4) return res.status(400).json({ success: false, message: 'رمز جدید حداقل ۴ کاراکتر باشد.' }); await run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [hashPassword(req.body.new_password), now(), req.session.userId]); res.json({ success: true, message: 'رمز عبور تغییر کرد.' }); } catch (e) { res.status(500).json({ success: false, message: 'خطا در تغییر رمز.' }); } });
app.put('/api/profile/theme', requireTeacher, async function (req, res) { const theme = req.body.theme === 'dark' ? 'dark' : 'light'; await run('UPDATE users SET theme = ?, updated_at = ? WHERE id = ?', [theme, now(), req.session.userId]); res.json({ success: true, theme: theme }); });

app.get('/api/messages', requireTeacher, async function (req, res) { const rows = await all('SELECT m.id,m.subject,m.body,m.is_read,m.created_at,u.id AS sender_id,u.full_name AS sender_name,u.phone AS sender_phone FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.receiver_id = ? ORDER BY m.id DESC', [req.session.userId]); res.json(rows); });
app.get('/api/messages/sent', requireTeacher, async function (req, res) { const rows = await all('SELECT m.id,m.subject,m.body,m.created_at,u.id AS receiver_id,u.full_name AS receiver_name FROM messages m JOIN users u ON u.id = m.receiver_id WHERE m.sender_id = ? ORDER BY m.id DESC', [req.session.userId]); res.json(rows); });
app.post('/api/messages', requireTeacher, async function (req, res) { try { const receiver = await get('SELECT id FROM users WHERE id = ? AND role = \'teacher\' AND is_active = 1', [Number(req.body.receiver_id)]); if (!receiver) return res.status(404).json({ success: false, message: 'استاد مقصد پیدا نشد.' }); const body = String(req.body.body || '').trim(); if (!body) return res.status(400).json({ success: false, message: 'متن پیام خالی است.' }); await run('INSERT INTO messages (sender_id,receiver_id,subject,body,created_at) VALUES (?,?,?,?,?)', [req.session.userId, receiver.id, String(req.body.subject || '').trim(), body, now()]); res.json({ success: true, message: 'پیام ارسال شد.' }); } catch (e) { res.status(500).json({ success: false, message: 'خطا در ارسال پیام.' }); } });
app.put('/api/messages/:id/read', requireTeacher, async function (req, res) { await run('UPDATE messages SET is_read = 1 WHERE id = ? AND receiver_id = ?', [req.params.id, req.session.userId]); res.json({ success: true }); });

app.get('/api/articles', async function (req, res) { const rows = await all('SELECT a.*,u.full_name AS author_name,u.author_job AS author_job,u.phone AS author_phone FROM articles a JOIN users u ON u.id=a.author_id WHERE a.status=\'published\' ORDER BY a.id DESC'); rows.forEach(function (r) { r.tags = r.tags ? JSON.parse(r.tags) : []; }); res.json(rows); });
app.get('/api/articles/admin', requireTeacher, async function (req, res) { const rows = await all('SELECT a.*,u.full_name AS author_name,u.author_job AS author_job FROM articles a JOIN users u ON u.id=a.author_id ORDER BY a.id DESC'); rows.forEach(function (r) { r.tags = r.tags ? JSON.parse(r.tags) : []; }); res.json(rows); });
app.get('/api/articles/:id', async function (req, res) { try { const a = await get('SELECT a.*,u.full_name AS author_name,u.author_job AS author_job,u.phone AS author_phone FROM articles a JOIN users u ON u.id=a.author_id WHERE a.id=?', [req.params.id]); if (!a || (a.status !== 'published' && !(req.session.userId && req.session.role === 'teacher'))) return res.status(404).json({ success: false, message: 'مقاله پیدا نشد.' }); const blocks = await all('SELECT block_type,title,body,block_order FROM article_blocks WHERE article_id=? ORDER BY block_order', [a.id]); a.blocks = blocks; a.tags = a.tags ? JSON.parse(a.tags) : []; res.json(a); } catch (e) { res.status(500).json({ success: false, message: 'خطا در دریافت مقاله.' }); } });
app.get('/api/articles/by-title', async function (req, res) { const title = String(req.query.title || ''); const a = await get('SELECT a.*,u.full_name AS author_name,u.author_job AS author_job FROM articles a JOIN users u ON u.id=a.author_id WHERE a.title=? AND a.status=\'published\'', [title]); if (!a) return res.status(404).json({ success: false }); a.blocks = await all('SELECT block_type,title,body,block_order FROM article_blocks WHERE article_id=? ORDER BY block_order', [a.id]); a.tags = a.tags ? JSON.parse(a.tags) : []; res.json(a); });
app.post('/api/articles', requireTeacher, upload.single('image'), async function (req, res) { try { const title = String(req.body.title || '').trim(); const category = String(req.body.category || 'general'); const categoryLabel = String(req.body.category_label || req.body.category || 'آموزش عمومی'); const status = req.body.status === 'published' ? 'published' : 'draft'; const summary = String(req.body.summary || '').trim(); const reading = String(req.body.reading_time || '۵ دقیقه').trim(); const tags = req.body.tags ? JSON.parse(req.body.tags) : []; const blocks = req.body.blocks ? JSON.parse(req.body.blocks) : []; if (!title || !summary || !blocks.length) return res.status(400).json({ success: false, message: 'عنوان، خلاصه و حداقل یک بخش مقاله لازم است.' }); const slug = await uniqueSlug(slugify(title)); const image = req.file ? '/uploads/' + req.file.filename : '/img/avatar16266754.jpg'; const r = await run('INSERT INTO articles (title,slug,category,category_label,status,summary,author_id,reading_time,image,tags,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [title, slug, category, categoryLabel, status, summary, req.session.userId, reading, image, JSON.stringify(tags), now(), now()]); for (let i = 0; i < blocks.length; i++) { const b = blocks[i]; await run('INSERT INTO article_blocks (article_id,block_order,block_type,title,body) VALUES (?,?,?,?,?)', [r.id, i, b.type, b.title || '', b.body || '']); } res.json({ success: true, id: r.id }); } catch (e) { console.error(e); res.status(500).json({ success: false, message: 'خطا در ذخیره مقاله.' }); } });
app.put('/api/articles/:id', requireTeacher, upload.single('image'), async function (req, res) { try { const a = await get('SELECT * FROM articles WHERE id=?', [req.params.id]); if (!a) return res.status(404).json({ success: false, message: 'مقاله پیدا نشد.' }); const title = String(req.body.title || '').trim(); const summary = String(req.body.summary || '').trim(); const blocks = req.body.blocks ? JSON.parse(req.body.blocks) : []; const tags = req.body.tags ? JSON.parse(req.body.tags) : []; const image = req.file ? '/uploads/' + req.file.filename : a.image; await run('UPDATE articles SET title=?,summary=?,category=?,category_label=?,status=?,reading_time=?,image=?,tags=?,updated_at=? WHERE id=?', [title, summary, String(req.body.category || a.category), String(req.body.category_label || a.category_label), req.body.status === 'published' ? 'published' : 'draft', String(req.body.reading_time || a.reading_time), image, JSON.stringify(tags), now(), a.id]); await run('DELETE FROM article_blocks WHERE article_id=?', [a.id]); for (let i=0;i<blocks.length;i++) { const b=blocks[i]; await run('INSERT INTO article_blocks (article_id,block_order,block_type,title,body) VALUES (?,?,?,?,?)',[a.id,i,b.type,b.title||'',b.body||'']); } res.json({ success:true }); } catch(e) { res.status(500).json({ success:false,message:'خطا در ویرایش مقاله.' }); } });
app.delete('/api/articles/:id', requireTeacher, async function (req,res) { try { const a=await get('SELECT image FROM articles WHERE id=?',[req.params.id]); if(!a) return res.status(404).json({success:false,message:'مقاله پیدا نشد.'}); if(a.image && a.image.indexOf('/uploads/')===0){const p=path.join(PUBLIC,a.image);if(fs.existsSync(p))fs.unlinkSync(p);} await run('DELETE FROM articles WHERE id=?',[req.params.id]); res.json({success:true}); }catch(e){res.status(500).json({success:false,message:'خطا در حذف مقاله.'});} });

app.get('/api/files', async function(req,res){ const rows=await all('SELECT id,title,category,grade,file_name,file_path,mime_type,size,created_at FROM files ORDER BY id DESC'); res.json(rows); });
app.post('/api/files', requireTeacher, upload.single('file'), async function(req,res){ try{ if(!req.file)return res.status(400).json({success:false,message:'فایل انتخاب نشده است.'}); const title=String(req.body.title||req.file.originalname).trim(); const category=String(req.body.category||'others'); const grade=String(req.body.grade||''); const p='/uploads/'+req.file.filename; const r=await run('INSERT INTO files (title,category,grade,file_name,file_path,mime_type,size,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)',[title,category,grade,req.file.originalname,p,req.file.mimetype,req.file.size,req.session.userId,now()]); res.json({success:true,id:r.id}); }catch(e){res.status(500).json({success:false,message:'خطا در آپلود فایل.'});} });
app.delete('/api/files/:id', requireTeacher, async function(req,res){ try{const f=await get('SELECT file_path FROM files WHERE id=?',[req.params.id]);if(!f)return res.status(404).json({success:false,message:'فایل پیدا نشد.'});const p=path.join(PUBLIC,f.file_path);if(fs.existsSync(p))fs.unlinkSync(p);await run('DELETE FROM files WHERE id=?',[req.params.id]);res.json({success:true});}catch(e){res.status(500).json({success:false,message:'خطا در حذف فایل.'});} });

app.get('/api/tests', async function(req,res){ const rows=await all('SELECT id,level,title,description FROM tests WHERE active=1 ORDER BY id'); res.json(rows); });
app.get('/api/tests/:id', async function(req,res){ const t=await get('SELECT id,level,title,description FROM tests WHERE id=? AND active=1',[req.params.id]); if(!t)return res.status(404).json({success:false}); t.questions=await all('SELECT id,question,options_json FROM test_questions WHERE test_id=? ORDER BY id',[t.id]); t.questions.forEach(q=>{q.options=JSON.parse(q.options_json);delete q.options_json;});res.json(t); });
app.post('/api/tests/:id/submit', async function(req,res){ try{const t=await get('SELECT * FROM tests WHERE id=?',[req.params.id]);if(!t)return res.status(404).json({success:false});const qs=await all('SELECT id,correct_index FROM test_questions WHERE test_id=? ORDER BY id',[t.id]);const answers=req.body.answers||{};let score=0;qs.forEach(q=>{if(Number(answers[q.id])===q.correct_index)score++;});let studentId=req.session.userId||null;if(req.session.role==='teacher')studentId=null;await run('INSERT INTO test_results (test_id,student_id,score,total,level,answers_json,created_at) VALUES (?,?,?,?,?,?,?)',[t.id,studentId,score,qs.length,t.level,JSON.stringify(answers),now()]);res.json({success:true,score,total:qs.length,level:t.level});}catch(e){res.status(500).json({success:false,message:'خطا در ثبت نتیجه.'});} });

app.get('/api/db/health', function(req,res){res.json({success:true,database:'sqlite3',version:'5.0.2-target',node:'13.14.0-target'});});

app.use(express.static(PUBLIC));

function normalizePhone(phone) { let p=String(phone || '').replace(/[\s-]/g,''); const fa='۰۱۲۳۴۵۶۷۸۹'; for(let i=0;i<fa.length;i++)p=p.split(fa[i]).join(String(i)); if(p.indexOf('+98')===0)p='0'+p.slice(3); if(p.indexOf('98')===0)p='0'+p.slice(2); return p; }

app.use(function(err, req, res, next){ console.error(err); res.status(500).json({success:false,message:'خطای غیرمنتظره سرور.'}); });

app.listen(PORT, function(){ console.log('Behradar server: http://localhost:' + PORT); console.log('Admin: http://localhost:' + PORT + '/admin'); console.log('Master teacher: 09000000000 / 123'); });
