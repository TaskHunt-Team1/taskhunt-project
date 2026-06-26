
/*الكود ده مسؤول عن الإشعارات (Notifications) في الموقع.

يعني أي إشعار زي:

رسالة جديدة.
Proposal جديد.
أي تنبيه للمستخدم.

الـ API دي هي اللي بتجيب الإشعارات وتحدد إذا كانت اتقرت ولا لأ.*/
//استخدمت Express Router لعمل APIs.
const router = require('express').Router();
//استخدمت Database للتعامل مع قاعدة البيانات.
const db     = require('../database');
//استخدمت requireAuth علشان محدش يقدر يشوف إشعارات غير لو عامل Login.
const { requireAuth } = require('../middleware/auth');

// GET /api/notifications — my notifications
//لما المستخدم يضغط على أيقونة الجرس 🔔.
//الباك بيتاكد ان المتخدم مسجل دخول وبيجيب اخر 50 اشعار 
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(rows);
});

// GET /api/notifications/unread-count
router.get('/unread-count', requireAuth, (req, res) => {
  const row = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id=? AND is_read=0').get(req.user.id);
  res.json({ count: row.count });
});

// PUT /api/notifications/:id/read
router.put('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ message: 'Marked as read' });
});

// PUT /api/notifications/read-all
router.put('/read-all', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
  res.json({ message: 'All marked as read' });
});

module.exports = router;
/*أهم الدوال المستخدمة
الدالة	وظيفتها
router.get()	جلب الإشعارات أو عدد الإشعارات غير المقروءة.
router.put()	تحديث حالة الإشعار إلى مقروء.
requireAuth	التأكد إن المستخدم عامل Login.
db.prepare().all()	جلب كل الإشعارات.
db.prepare().get()	جلب قيمة واحدة مثل عدد الإشعارات.
db.prepare().run()	تنفيذ عملية Update.
res.json()	إرسال البيانات للفرونت بصيغة JSON.
*/

/*
Notifications Flow:

1- عند حدوث حدث جديد (مثل رسالة)، يتم حفظ Notification في قاعدة البيانات.
2- الفرونت يرسل GET Request لجلب إشعارات المستخدم.
3- الباك إند يجلب الإشعارات من جدول notifications.
4- يعيدها للفرونت بصيغة JSON ليتم عرضها.
5- عند فتح إشعار أو الضغط على "Mark All As Read"،
   يرسل الفرونت PUT Request لتحديث حالة الإشعار إلى Read.
*/