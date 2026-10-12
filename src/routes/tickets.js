import express from "express";
import multer from "multer";

import { verifyTicketCode } from "../controllers/verifyTicket.js";

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({
    message: "Ticket routes are working",
  });
});

// VERIFY TICKET ENDPOINTS
router.post("/verify-code", verifyTicketCode);

export default router;
