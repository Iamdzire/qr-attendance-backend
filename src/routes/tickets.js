import express from "express";
import multer from "multer";
import ticketController from "../controllers/ticket.js";
import { verifyTicketCode } from "../controllers/verifyTicket.js";

const router = express.Router();
const upload = multer({
  dest: "uploads/",
  storage: multer.memoryStorage(),
  limits: {
    filesize: 5 * 1024 * 1024,
  },
});

// VERIFY TICKET ENDPOINTS
router.post("/verify-code", verifyTicketCode);

export default router;
