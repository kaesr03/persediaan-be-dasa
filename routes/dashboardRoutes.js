import express from 'express';

import getDashboard from '../controllers/dashboardController.js';

import { protect } from '../controllers/authController.js';

const router = express.Router();

router.route('/').get(protect, getDashboard);

export default router;
