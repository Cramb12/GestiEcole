import { Router } from 'express';
import { adminDashboard, teacherDashboard } from '../controllers/dashboardController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

// Admin-only dashboard.
router.get('/admin', authenticate, authorize('super_admin'), adminDashboard);

// Teacher dashboard (any authenticated teacher; admin may also view).
router.get('/teacher', authenticate, authorize('teacher', 'super_admin'), teacherDashboard);

export default router;
