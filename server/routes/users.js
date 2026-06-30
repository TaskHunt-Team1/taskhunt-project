const router = require('express').Router();
const db     = require('../database');
/*
"الكود ده مسؤول عن عرض البروفايل العام لأي مستخدم. أولًا يحدد إذا كان المستخدم فريلانسر أو عميل، 
وبعدها يجيب البيانات المناسبة لكل نوع من قاعدة البيانات ويرجعها للفرونت لعرضها."
 */
// GET /api/users/:id/profile — public user profile
router.get('/:id/profile', (req, res) => {
  const userId = Number(req.params.id);
  const user = db.prepare('SELECT id, name, role, created_at FROM users WHERE id=?').get(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role === 'freelancer') {
    const profile = db.prepare('SELECT * FROM freelancer_profiles WHERE user_id=?').get(userId);
    const propStats = db.prepare(`
      SELECT
        CAST(COALESCE(SUM(CASE WHEN status='accepted' THEN 1 ELSE 0 END), 0) AS INTEGER) AS projects_done,
        ROUND(AVG(CASE WHEN status='accepted' THEN price END), 2) AS avg_price
      FROM proposals
      WHERE user_id = ?
    `).get(userId);

    const reviewStats = db.prepare(`
      SELECT
        ROUND(AVG(rating), 1) AS avg_rating,
        CAST(COUNT(*) AS INTEGER) AS review_count
      FROM reviews
      WHERE freelancer_id = ?
    `).get(userId);

    return res.json({
      ...user,
      ...(profile || {}),
      projects_done: propStats?.projects_done || 0,
      avg_price:     propStats?.avg_price     || null,
      avg_rating:    reviewStats?.avg_rating    || null,
      review_count:  reviewStats?.review_count  || 0
    });
  } else {
    const profile = db.prepare('SELECT * FROM client_profiles WHERE user_id=?').get(userId);
    const stats   = db.prepare('SELECT COUNT(*) AS total_posts FROM posts WHERE user_id=?').get(userId);
    const posts   = db.prepare(
      'SELECT id, title, category, budget, status, created_at FROM posts WHERE user_id=? ORDER BY created_at DESC LIMIT 10'
    ).all(userId);
    return res.json({
      ...user,
      ...(profile || {}),
      total_posts:  stats?.total_posts || 0,
      recent_posts: posts
    });
  }
});

module.exports = router;
/*
أهم الدوال المستخدمة
الدالة	وظيفتها
router.get()	إنشاء API لجلب بيانات البروفايل.
req.params.id	قراءة رقم المستخدم من الرابط.
db.prepare().get()	جلب سجل واحد مثل بيانات المستخدم أو البروفايل.
db.prepare().all()	جلب مجموعة بيانات مثل آخر المشاريع.
COUNT()	حساب عدد المشاريع أو التقييمات.
AVG()	حساب متوسط السعر أو متوسط التقييم.
LEFT JOIN	ربط جدول التقييمات مع الـ Proposals لحساب الإحصائيات.
res.json()	إرسال البيانات للفرونت بصيغة JSON.
*/
/*
Public Profile Flow:

1- المستخدم يضغط على بروفايل شخص.
2- الفرونت يرسل User ID للـ API.
3- الباك إند يبحث عن المستخدم في جدول users.
4- يحدد إذا كان Freelancer أو Client.
5- إذا كان Freelancer:
   - يجلب بيانات البروفايل.
   - يحسب عدد المشاريع ومتوسط السعر والتقييم وعدد الـ Reviews.
6- إذا كان Client:
   - يجلب بيانات البروفايل.
   - يحسب عدد المشاريع.
   - يجلب آخر المشاريع المنشورة.
7- يرجع جميع البيانات بصيغة JSON.
8- الفرونت يعرض صفحة البروفايل للمستخدم.
*/