
import express from 'express';
import { validateTicket } from '../controllers/scan.js';
import { getEventAttendance } from '../controllers/scanController.js';
import {
  requireAuth,
  requireOrganizer,
  requireStaff,
} from '../middleware/auth.js';

const router = express.Router();

// Only authenticated organizers can access attendance reports.
// Event ownership will also be checked in the controller.
router.get(
  '/events/:id/attendance',
  requireAuth,
  requireOrganizer,
  getEventAttendance
);

// Only authenticated staff can scan tickets.
router.post(
  '/scan',
  requireAuth,
  requireStaff,
  validateTicket
);

export default router;
