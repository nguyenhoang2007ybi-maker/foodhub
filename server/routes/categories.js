import express from 'express';
import { getDb, saveDb } from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// 1. Lấy danh sách danh mục
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const categoriesWithCount = db.categories.map(c => {
      const count = db.restaurants.filter(r => r.category && r.category.toLowerCase() === c.name.toLowerCase()).length;
      return {
        ...c,
        count
      };
    });

    res.json({
      success: true,
      data: categoriesWithCount
    });
  } catch (error) {
    console.error('Lỗi lấy danh mục:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi lấy danh sách danh mục.' });
  }
});

// 2. Thêm danh mục mới (Admin only)
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { name, icon, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên danh mục không được để trống.' });
    }

    const db = getDb();
    const exists = db.categories.some(c => c.name.toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      return res.status(400).json({ success: false, message: 'Danh mục này đã tồn tại trong hệ thống.' });
    }

    const newId = db.categories.length > 0 ? Math.max(...db.categories.map(c => c.id)) + 1 : 1;
    const newCategory = {
      id: newId,
      name: name.trim(),
      icon: icon ? icon.trim() : 'restaurant',
      description: description ? description.trim() : ''
    };

    db.categories.push(newCategory);
    saveDb();

    res.status(201).json({
      success: true,
      message: 'Thêm danh mục mới thành công!',
      data: newCategory
    });
  } catch (error) {
    console.error('Lỗi thêm danh mục:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi thêm danh mục.' });
  }
});

// 3. Sửa danh mục (Admin only)
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, icon, description } = req.body;

    const db = getDb();
    const cat = db.categories.find(c => c.id === id);

    if (!cat) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục để chỉnh sửa.' });
    }

    if (name && name.trim()) {
      const oldName = cat.name;
      const newName = name.trim();

      const duplicate = db.categories.some(c => c.id !== id && c.name.toLowerCase() === newName.toLowerCase());
      if (duplicate) {
        return res.status(400).json({ success: false, message: 'Tên danh mục đã tồn tại.' });
      }

      cat.name = newName;

      db.restaurants.forEach(r => {
        if (r.category === oldName) {
          r.category = newName;
        }
      });
    }

    if (icon !== undefined) cat.icon = icon.trim();
    if (description !== undefined) cat.description = description.trim();

    saveDb();

    res.json({
      success: true,
      message: 'Cập nhật danh mục thành công!',
      data: cat
    });
  } catch (error) {
    console.error('Lỗi sửa danh mục:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi sửa danh mục.' });
  }
});

// 4. Xóa danh mục an toàn (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const db = getDb();
    const catIndex = db.categories.findIndex(c => c.id === id);

    if (catIndex === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục để xóa.' });
    }

    const catName = db.categories[catIndex].name;
    const restaurantCount = db.restaurants.filter(r => r.category === catName).length;

    if (restaurantCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa danh mục này vì đang có ${restaurantCount} quán ăn thuộc danh mục "${catName}". Vui lòng chuyển các quán sang danh mục khác trước.`
      });
    }

    db.categories.splice(catIndex, 1);
    saveDb();

    res.json({
      success: true,
      message: 'Đã xóa danh mục thành công!'
    });
  } catch (error) {
    console.error('Lỗi xóa danh mục:', error);
    res.status(500).json({ success: false, message: 'Lỗi khi xóa danh mục.' });
  }
});

export default router;

