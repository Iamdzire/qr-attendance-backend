import express from "express";
import { validateTicket } from "../controllers/scan.js";
import {
  getEventAttendance,
  getStaffEventAttendance,
} from "../controllers/scanController.js";
import {
  requireAuth,
  requireOrganizer,
  requireStaff,
} from "../middleware/auth.js";

const router = express.Router();

router.get(
  "/events/:id/attendance",
  requireAuth,
  requireOrganizer,
  getEventAttendance,
);

router.get(
  "/events/:id/staff-attendance",
  requireAuth,
  requireStaff,
  getStaffEventAttendance,
);

router.post("/scan", requireAuth, requireStaff, validateTicket);

export default router;