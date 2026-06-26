const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../database');
const { SECRET } = require('../middleware/auth');

/*
requireAdmin → حماية الـ APIs.
GET → جلب بيانات وعرضها في الفرونت.
POST → إضافة بيانات جديدة.
DELETE → حذف البيانات وتحديث الواجهة.
bcrypt → تشفير كلمات المرور.
JWT → التحقق من هوية الأدمن.
SQLite (أو قاعدة البيانات المستخدمة) → تخزين واسترجاع البيانات.
-------------------------------------------------------------------------
"الفرونت لما بيحتاج بيانات أو يعمل أي عملية زي إضافة أو حذف، بيبعت 
Request للـ API باستخدام fetch أو axios. الطلب ده بيروح للـ Express Router في الباك إند. لو
 الـ API محمي، بيعدي الأول على requireAdmin عشان يتأكد إن اللي بعت الطلب أدمن عن طريق الـ 
 JWT Token. بعد كده الباك إند ينفذ استعلام على الداتابيز باستخدام db.prepare()،
 سواء يجيب بيانات أو يضيف أو يحذف. ولما يخلص، بيرجع النتيجة في شكل 
 JSON باستخدام res.json()، والفرونت يستقبلها ويعرضها أو يحدث الصفحة."
*/

// ── Admin auth middleware ──
//تتاكد ان المستخدم ادمن لو صح بيكمل لو غلط بيرجع ايرور
function requireAdmin(req, res, next) {
  const header = req.headers['authorization'];
  const token  = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Admin login required' });
  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/admin/stats — real platform stats
router.get('/stats', requireAdmin, (req, res) => {
  res.json({
    users:       db.prepare('SELECT COUNT(*) as n FROM users').get().n,
    //بيجمع عدد المستخدمين والبوستات والبروبوزال عشان الفرونت يعرضهم في الداشبورد
    clients:     db.prepare("SELECT COUNT(*) as n FROM users WHERE role='client'").get().n,
    freelancers: db.prepare("SELECT COUNT(*) as n FROM users WHERE role='freelancer'").get().n,
    posts:       db.prepare('SELECT COUNT(*) as n FROM posts').get().n,
    proposals:   db.prepare('SELECT COUNT(*) as n FROM proposals').get().n,
  });
});

// GET /api/admin/users — list platform users
router.get('/users', requireAdmin, (req, res) => {
  const rows = db.prepare(
    'SELECT id, name, email, role, created_at FROM users ORDER BY id DESC'
  ).all();
  res.json(rows);
});

// GET /api/admin/accounts — list all admin accounts
//يجمع كل حاسابات الادمن ويرجعهم للفرونت
router.get('/accounts', requireAdmin, (req, res) => {
  const rows = db.prepare(
    'SELECT id, name, email, created_at FROM admins ORDER BY id'
  ).all();
  res.json(rows);
});

// POST /api/admin/accounts — add new admin
//يتأكد ان البيانات والايميل مش موجود قبل كده يعني اكونت جديد
router.post('/accounts', requireAdmin, (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required' });

  if (db.prepare('SELECT id FROM admins WHERE email = ?').get(email))
    return res.status(409).json({ error: 'This email is already registered as admin' });

  //يشفر الباسورد

  const hash   = bcrypt.hashSync(password, 10);
  //الداتا بتروح الداتا بيز عن طريق db.prepare(...)
  const result = db.prepare(
    'INSERT INTO admins (name, email, password) VALUES (?, ?, ?)'
  ).run(name, email, hash);

  res.status(201).json({ id: result.lastInsertRowid, name, email, created_at: new Date().toISOString() });
});

// DELETE /api/admin/accounts/:id — delete admin
router.delete('/accounts/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  if (id === req.admin.id) return res.status(400).json({ error: 'You cannot delete your own account' });

  //لما اضغط حذف  الداتا بتروح الداتا بيز عن طريق db.prepare(...) 
  const changes = db.prepare('DELETE FROM admins WHERE id = ?').run(id).changes;
  if (!changes) return res.status(404).json({ error: 'Admin not found' });
  //بيرجع الرساله دي 
  res.json({ message: 'Admin deleted successfully' });
});

router.delete('/posts/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);

  db.prepare('DELETE FROM proposals WHERE post_id = ?').run(id);
  db.prepare('DELETE FROM conversations WHERE post_id = ?').run(id);

  const result = db.prepare(
    'DELETE FROM posts WHERE id = ?'
  ).run(id);

  if (!result.changes) {
    return res.status(404).json({ error: 'Post not found' });
  }

  res.json({ message: 'Post deleted successfully' });
}); 
router.delete('/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);

  db.prepare('DELETE FROM notifications WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM freelancer_profiles WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM client_profiles WHERE user_id = ?').run(id);

  db.prepare('DELETE FROM proposals WHERE user_id = ?').run(id);
  db.prepare('DELETE FROM posts WHERE user_id = ?').run(id);

  const result = db.prepare(
    'DELETE FROM users WHERE id = ?'
  ).run(id);

  if (!result.changes) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ message: 'User deleted successfully' });
});
module.exports = router;
