import express from "express";
import eventController from "../controllers/event.js";
import upload from '../config/multer.js'
import {
  requireAuth, requireOrganizer, requireStaff
} from '../middleware/auth.js'
const router = express.Router();

// EVENT ENDPOINTS
router.post("/", requireAuth, requireOrganizer, upload.single("image"), eventController.createEvent);
router.get("/", requireAuth, eventController.getAllEvents);

// EVENT TICKET ENDPOINTS
router.get("/:id/codes", requireAuth, eventController.getEventTickets);
router.delete("/:id/codes", requireAuth, requireOrganizer, eventController.bulkDeleteTickets);
router.post(
  "/:id/codes", requireAuth, requireOrganizer,
  upload.single("ticket"),
  eventController.batchUploadTickets,
);

export default router;
