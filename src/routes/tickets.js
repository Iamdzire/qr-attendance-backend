import express from "express";
import multer from "multer";
import ticketController from "../controllers/ticket.js";
import express from "express";
import { verifyTicketCode } from "../controllers/verifyTicket.js";
import { registerAttendee } from "../controllers/attendee.js";

const router = express.Router();
const upload = multer({
  dest: "uploads/",
  storage: multer.memoryStorage(),
  limits: {
    filesize: 5 * 1024 * 1024,
  },
});

router.get("/test", (req, res) => {
  res.json({
    message: "Ticket routes are working",
  });
});

// VERIFY TICKET ENDPOINTS
router.post("/verify-code", verifyTicketCode);

// ATTENDEE REGISTER ENDPOINT
router.post("/register", registerAttendee);

// TICKET ENDPOINTS
// this is a bulk delete tickets endpoint
router.delete("/:id/codes", ticketController.bulkDeleteTickets);
router.post(
  "/:id/codes",
  upload.single("file"),
  ticketController.batchUploadTickets,
);

export default router;
