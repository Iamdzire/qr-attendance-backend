import Event from "../models/event.js";
import mongoose from "mongoose";
import Ticket from "../models/ticket.js";
import Scan from "../models/scan.js";
import { checkInTicket } from "./scanController.js";
import { verifyQrToken } from "../services/tokenService.js";

export const validateTicket = async (req, res) => {
  try {
    const { qr_token, event_id, gate_label } = req.body;

    // 1. Validate required input
    if (
      typeof qr_token !== "string" ||
      !qr_token.trim() ||
      typeof event_id !== "string" ||
      !event_id.trim()
    ) {
      return res.status(400).json({
        status: "invalid",
        message: "QR token and event ID are required",
      });
    }

    // 2. Validate the event ID before database operations
    if (!mongoose.isValidObjectId(event_id)) {
      return res.status(400).json({
        status: "invalid",
        message: "Invalid event ID",
      });
    }

    // 3. Identify the staff member from the verified login token
    const scannedBy = req.user?.id;

    if (!mongoose.isValidObjectId(scannedBy)) {
      return res.status(401).json({
        status: "unauthorized",
        message: "Staff login required",
      });
    }

    // 4. Get the gate name
    const gate =
      typeof gate_label === "string" && gate_label.trim()
        ? gate_label.trim()
        : "Main Gate";

    // 5. Verify the QR token's signature and expiry
    let decodedToken;

    try {
      decodedToken = verifyQrToken(qr_token);
    } catch (error) {
      return res.status(400).json({
        status: "invalid",
        message: "Invalid or expired QR token",
      });
    }

    // 6. Confirm the event exists
    const event = await Event.findById(event_id).select("_id").lean();

    if (!event) {
      return res.status(404).json({
        status: "invalid",
        message: "Event not found",
      });
    }

    // 7. Find the ticket using the QR token
    const ticket = await Ticket.findOne({ qr_token });

    if (!ticket) {
      await Scan.create({
        ticket_id: null,
        event_id,
        scanned_by: scannedBy,
        scan_result: "invalid",
        gate_label: gate,
      });

      return res.status(404).json({
        status: "invalid",
        message: "Invalid QR token",
      });
    }

    // 8. Ensure the token claims match the stored ticket
    const tokenMatchesTicket =
      typeof decodedToken.ticketId === "string" &&
      decodedToken.ticketId === ticket._id.toString() &&
      typeof decodedToken.eventId === "string" &&
      decodedToken.eventId === ticket.event_id.toString() &&
      typeof decodedToken.attendeeId === "string" &&
      decodedToken.attendeeId === ticket.attendee_id.toString();

    if (!tokenMatchesTicket) {
      await Scan.create({
        ticket_id: ticket._id,
        event_id,
        scanned_by: scannedBy,
        scan_result: "invalid",
        gate_label: gate,
      });

      return res.status(400).json({
        status: "invalid",
        message: "QR token claims do not match the ticket",
      });
    }

    // 9. Check whether the ticket belongs to the requested event
    if (
      decodedToken.eventId !== event_id ||
      ticket.event_id.toString() !== event_id
    ) {
      await Scan.create({
        ticket_id: ticket._id,
        event_id,
        scanned_by: scannedBy,
        scan_result: "wrong-event",
        gate_label: gate,
      });

      return res.status(400).json({
        status: "wrong-event",
        message: "Ticket does not belong to this event",
      });
    }

    // 10. Handle check-in and duplicate scans
    const result = await checkInTicket({
      ticket,
      event_id,
      scannedBy,
      gate,
    });

    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    console.error("Ticket validation error:", error);

    return res.status(500).json({
      status: "invalid",
      message: "Server error while validating ticket",
    });
  }
};
