import express from "express";
import multer from "multer";

import { verifyTicketCode } from "../controllers/verifyTicket.js";

const router = express.Router();

// VERIFY TICKET ENDPOINTS
router.post("/verify-code", verifyTicketCode);

export default router;
