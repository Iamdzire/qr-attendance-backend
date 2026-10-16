import express from "express";
import eventController from "../controllers/event.js";
import upload from '../config/multer.js'
import {
  requireAuth, requireOrganizer, requireStaff
} from '../middleware/auth.js'
const router = express.Router();

// EVENT ENDPOINTS
router.post(
  "/",
  requireAuth,
  requireOrganizer,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "ticket", maxCount: 1 },
  ]),
  eventController.createEvent
);
router.get("/", eventController.getAllEvents);
router.get('/events-by-organizer', requireAuth, requireOrganizer, eventController.getEventsByOrganizer);

// EVENT TICKET ENDPOINTS
router.get("/:id/codes", requireAuth, eventController.getEventTickets);
router.delete("/:id/codes", requireAuth, requireOrganizer, eventController.bulkDeleteTickets);
router.post(
  "/:id/codes", requireAuth, requireOrganizer,
  upload.single("ticket"),
  eventController.batchUploadTickets,
);

export default router;
