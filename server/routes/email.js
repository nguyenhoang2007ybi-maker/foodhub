import { Router } from 'express';
import crypto from 'crypto';
import { getDb, saveDb } from '../db.js';

const router = Router();

const SECRET = process.env.JWT_SECRET || 'foodhub_secret_key_production_2026_super_secure';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Thời gian hiệu lực của mã OTP và cooldown gửi lại
const OTP_TTL_MS = 10 * 60 * 1000; // 10 phút
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 giây
const MAX_VERIFY_ATTEMPTS = 5;
const VERIFICATION_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 phút để hoàn tất đặt hàng

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashOtp(email, otp) {
  return crypto.createHmac('sha256', SECRET).update(`${email}:${otp}`).digest('hex');
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function getEmailStore(db) {
  if (!db.emailVerifications || typeof db.emailVerifications !== 'object') {
    db.emailVerifications = {};
  }
  return db.emailVerifications;
}

// Kiểm tra cấu hình SMTP thật. Nếu chưa cấu hình, hệ thống ghi log mã OTP ra
// console server và trả về `devCode` để phục vụ kiểm thử (KHÔNG dùng production).
function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Gửi email thật nếu có cấu hình SMTP. Nodemailer là tùy chọn (optionalDependency),
// nếu chưa cài đặt hoặc chưa cấu hình SMTP thì trả về false.
async function sendVerificationEmail(toEmail, otp) {
  if (!isSmtpConfigured()) return false;

  try {
    const { default: nodemailer } = await import('nodemailer');
    const port = Number(process.env.SMTP_PORT || 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"FoodHub" <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: 'FoodHub - Mã xác nhận email đặt hàng',
      text: `Mã xác nhận email của bạn là: ${otp}. Mã có hiệu lực trong 10 phút.`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2 style="color:#ab3500;">FoodHub - Xác nhận email</h2>
          <p>Xin chào, bạn đang thực hiện đặt hàng trên FoodHub. Vui lòng dùng mã dưới đây để xác nhận email:</p>
          <p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#151c27;margin:16px 0;">${otp}</p>
          <p style="color:#5f5e5e;font-size:13px;">Mã có hiệu lực trong 10 phút. Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email.</p>
        </div>
      `
    });
    return true;
  } catch (error) {
    console.error('Không thể gửi email xác nhận qua SMTP:', error.message);
    return false;
  }
}

// 1. Gửi mã OTP xác nhận email
// POST /api/email/send-otp  { email }
router.post('/send-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: 'Địa chỉ email không hợp lệ. Vui lòng kiểm tra lại.' });
    }

    const db = getDb();
    const store = getEmailStore(db);
    const now = Date.now();
    const existing = store[email];

    // Chống spam: chỉ cho gửi lại sau RESEND_COOLDOWN_MS
    if (existing && existing.lastSentAt && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
      const remain = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastSentAt)) / 1000);
      return res.status(429).json({
        success: false,
        message: `Vui lòng chờ ${remain} giây trước khi yêu cầu gửi lại mã xác nhận.`
      });
    }

    const otp = generateOtp();

    store[email] = {
      otpHash: hashOtp(email, otp),
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      lastSentAt: now,
      verified: false,
      verificationToken: null,
      tokenExpiresAt: null,
      updatedAt: new Date().toISOString()
    };

    saveDb();

    const sent = await sendVerificationEmail(email, otp);

    const response = {
      success: true,
      message: sent
        ? `Mã xác nhận đã được gửi tới email ${email}. Vui lòng kiểm tra hộp thư (cả thư rác).`
        : `Đã tạo mã xác nhận cho email ${email}.`,
      email,
      expiresInSeconds: Math.round(OTP_TTL_MS / 1000),
      emailSent: sent
    };

    // Chưa cấu hình SMTP: không thể gửi mail thật. Để việc phát triển/kiểm thử
    // vẫn thực hiện được, mã OTP được ghi ra console server và (chỉ ngoài
    // môi trường production) trả kèm trong response dưới nhãn `devCode`.
    if (!sent) {
      console.log(`[FoodHub OTP] Mã xác nhận cho ${email} là: ${otp} (hết hạn sau 10 phút)`);
      if (process.env.NODE_ENV !== 'production') {
        response.devCode = otp;
        response.note = 'SMTP chưa được cấu hình. Mã OTP hiển thị ở đây chỉ dùng cho môi trường phát triển/kiểm thử.';
      }
    }

    res.json(response);
  } catch (error) {
    console.error('Lỗi gửi OTP xác nhận email:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi gửi mã xác nhận email.' });
  }
});

// 2. Xác nhận mã OTP và nhận token xác thực email
// POST /api/email/verify-otp  { email, otp }
router.post('/verify-otp', (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();

    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: 'Địa chỉ email không hợp lệ.' });
    }

    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: 'Mã xác nhận phải gồm đúng 6 chữ số.' });
    }

    const db = getDb();
    const store = getEmailStore(db);
    const record = store[email];

    if (!record || !record.otpHash) {
      return res.status(400).json({ success: false, message: 'Chưa có mã xác nhận cho email này. Vui lòng yêu cầu gửi mã mới.' });
    }

    if (Date.now() > record.expiresAt) {
      delete store[email];
      saveDb();
      return res.status(400).json({ success: false, message: 'Mã xác nhận đã hết hạn. Vui lòng yêu cầu gửi lại mã mới.' });
    }

    if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
      delete store[email];
      saveDb();
      return res.status(429).json({ success: false, message: 'Bạn đã nhập sai quá nhiều lần. Vui lòng yêu cầu gửi lại mã mới.' });
    }

    const expected = hashOtp(email, otp);
    const isValid = crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(record.otpHash, 'hex'));

    if (!isValid) {
      record.attempts = (record.attempts || 0) + 1;
      saveDb();
      const remaining = MAX_VERIFY_ATTEMPTS - record.attempts;
      return res.status(400).json({
        success: false,
        message: remaining > 0
          ? `Mã xác nhận không chính xác. Bạn còn ${remaining} lần thử.`
          : 'Mã xác nhận không chính xác. Bạn đã hết lượt thử, vui lòng yêu cầu gửi lại mã mới.'
      });
    }

    // Xác nhận thành công: tạo token dùng để hoàn tất đặt hàng
    const verificationToken = crypto.randomBytes(32).toString('hex');
    store[email] = {
      otpHash: null,
      expiresAt: null,
      attempts: record.attempts,
      lastSentAt: record.lastSentAt,
      verified: true,
      verificationToken,
      tokenExpiresAt: Date.now() + VERIFICATION_TOKEN_TTL_MS,
      verifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveDb();

    res.json({
      success: true,
      message: `Xác nhận email ${email} thành công!`,
      email,
      verificationToken,
      verified: true
    });
  } catch (error) {
    console.error('Lỗi xác nhận OTP email:', error);
    res.status(500).json({ success: false, message: 'Lỗi máy chủ khi xác nhận mã email.' });
  }
});

// 3. Kiểm tra trạng thái xác nhận email (tùy chọn, phục vụ UI)
// GET /api/email/status?email=...
router.get('/status', (req, res) => {
  const email = normalizeEmail(req.query.email);
  if (!email) {
    return res.status(400).json({ success: false, message: 'Thiếu tham số email.' });
  }

  const db = getDb();
  const store = getEmailStore(db);
  const record = store[email];

  const verified = Boolean(
    record &&
    record.verified &&
    record.verificationToken &&
    record.tokenExpiresAt &&
    Date.now() < record.tokenExpiresAt
  );

  res.json({ success: true, email, verified });
});

// Helper dùng chung: xác thực token đặt hàng có hợp lệ với email tương ứng không
export function isEmailVerified(email, verificationToken) {
  const normalized = normalizeEmail(email);
  if (!normalized || !verificationToken) return false;

  const db = getDb();
  const store = getEmailStore(db);
  const record = store[normalized];

  if (!record || !record.verified || !record.verificationToken) return false;
  if (!record.tokenExpiresAt || Date.now() > record.tokenExpiresAt) return false;

  const expected = Buffer.from(String(record.verificationToken));
  const received = Buffer.from(String(verificationToken));
  if (expected.length !== received.length) return false;

  return crypto.timingSafeEqual(expected, received);
}

// Helper dùng chung: tiêu hủy token sau khi đặt hàng thành công
export function consumeEmailVerification(email) {
  const normalized = normalizeEmail(email);
  const db = getDb();
  const store = getEmailStore(db);
  if (store[normalized]) {
    delete store[normalized];
    saveDb();
  }
}

export default router;
