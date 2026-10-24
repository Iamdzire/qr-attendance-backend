import express from "express";
import { getAttendeeTicket } from "../controllers/attendeeController.js";
import { requireAttendeeAuth } from "../middleware/attendeeAuth.js";
import { registerAttendee } from "../controllers/attendee.js";

const router = express.Router();

// ATTENDEE REGISTER ENDPOINT
router.post("/register", registerAttendee);

// Retrieve an attendee's ticket for a particular event
router.get("/my-ticket", requireAttendeeAuth, getAttendeeTicket);

export default router;
