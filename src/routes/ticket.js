import express from "express";
import { verifyTicketCode } from "../controllers/verifyTicket.js";
import { registerAttendee } from "../controllers/attendee.js";

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({
    message: "Ticket routes are working",
  });
});

// VERIFY TICKET ENDPOINTS
router.post("/verify-code", verifyTicketCode);

// ATTENDEE REGISTER ENDPOINT
router.post("/register", registerAttendee);

export default router; // Exporting using ES Modules syntax
