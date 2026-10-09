import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb, saveDb } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'foodhub_secret_key_production_2026_super_secure';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// 1. Đăng ký
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, confirmPassword } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập họ và tên.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Định dạng email không hợp lệ.' });
    }

    if (phone && !/^(0|\+84)[0-9]{9}$/.test(phone.trim())) {
      return res.status(400).json({ success: false, message: 'Số điện thoại không hợp lệ (cần 10 chữ số).' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu xác nhận không khớp.' });
    }

    const db = getDb();
    const existing = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());
    if (existing) {
      return res.status(400).json({ success: false, message: 'Email này đã được sử dụng bởi một tài khoản khác.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newId = db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1;

    const newUser = {
      id: newId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone ? phone.trim() : '',
      passwordHash,
      role: 'customer',
      status: 'active',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name.trim())}&background=ff6b35&color=fff`,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    saveDb();

    const token = generateToken(newUser);
    const { passwordHash: _, ...safeUser } = newUser;

    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công!',
      token,
      user: safeUser,
      data: { token, user: safeUser }
    });
  } catch (error) {
    console.error('Lỗi đăng ký:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi đăng ký tài khoản.' });
  }
});

// 2. Đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ email và mật khẩu.' });
    }

    const db = getDb();
    const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ ban quản trị.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác.' });
    }

    const token = generateToken(user);
    const { passwordHash: _, resetPasswordToken, resetPasswordExpires, ...safeUser } = user;

    res.json({
      success: true,
      message: 'Đăng nhập thành công!',
      token,
      user: safeUser,
      data: { token, user: safeUser }
    });
  } catch (error) {
    console.error('Lỗi đăng nhập:', error);
    res.status(500).json({ success: false, message: 'Lỗi hệ thống khi đăng nhập.' });
  }
});

// 3. Lấy thông tin user hiện tại (Me)
router.get('/me', authenticateToken, (req, res) => {
  const db = getDb();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
  }

  const { passwordHash, resetPasswordToken, resetPasswordExpires, ...safeUser } = user;
  const favoritesCount = (db.favorites || []).filter(f => f.userId === user.id).length;
  const reviewsCount = (db.reviews || []).filter(r => r.userId === user.id).length;

  const userData = {
    ...safeUser,
    favoritesCount,
    reviewsCount
  };

  res.json({
    success: true,
    user: userData,
    data: userData
  });
});

// 4. Cập nhật hồ sơ
router.put('/profile', authenticateToken, (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    const db = getDb();
    const user = db.users.find(u => u.id === req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản.' });
    }

    if (name && name.trim()) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    if (avatar !== undefined) user.avatar = avatar.trim();

    db.reviews.forEach(r => {
      if (r.userId === user.id) {
        if (name && name.trim()) r.userName = name.trim();
        if (avatar !== undefined) r.userAvatar = avatar.trim();
      }
    });

    saveDb();

    const { passwordHash, ...safeUser } = user;
    res.json({
      success: true,
      message: 'Cập nhật thông tin cá nhân thành công!',
      user: safeUser
    });
  } catch (error) {
    console.error('Lỗi cập nhật hồ sơ:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi cập nhật thông tin.' });
  }
});

// 5. Đổi mật khẩu
router.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ success: false, message: 'Xác nhận mật khẩu mới không khớp.' });
    }

    const db = getDb();
    const user = db.users.find(u => u.id === req.user.id);

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không chính xác.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    saveDb();

    res.json({ success: true, message: 'Đổi mật khẩu thành công!' });
  } catch (error) {
    console.error('Lỗi đổi mật khẩu:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi đổi mật khẩu.' });
  }
});

// 6. Quên mật khẩu
router.post('/forgot-password', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp địa chỉ email.' });
    }

    const db = getDb();
    const user = db.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

    if (!user) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản với email này.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    saveDb();

    res.json({
      success: true,
      message: 'Mã xác nhận đặt lại mật khẩu đã được tạo thành công!',
      resetToken,
      resetUrl: `/forgot-password.html?token=${resetToken}&email=${encodeURIComponent(user.email)}`
    });
  } catch (error) {
    console.error('Lỗi quên mật khẩu:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xử lý yêu cầu quên mật khẩu.' });
  }
});

// 7. Đặt lại mật khẩu
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin token hoặc mật khẩu mới.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu xác nhận không khớp.' });
    }

    const db = getDb();
    const user = db.users.find(u => u.resetPasswordToken === token && u.resetPasswordExpires > Date.now());

    if (!user) {
      return res.status(400).json({ success: false, message: 'Mã xác nhận không hợp lệ hoặc đã hết hạn.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    delete user.resetPasswordToken;
    delete user.resetPasswordExpires;
    saveDb();

    res.json({ success: true, message: 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bây giờ.' });
  } catch (error) {
    console.error('Lỗi reset mật khẩu:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi đặt lại mật khẩu.' });
  }
});

export default router;
