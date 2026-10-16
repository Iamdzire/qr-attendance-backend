import mongoose from "mongoose";
import Event from "../models/event.js";
import Ticket from "../models/ticket.js";
import Scan from "../models/scan.js";
import { checkInTicket } from "./scanController.js";
import { verifyQrToken } from "../services/tokenService.js";

export const validateTicket = async (req, res) => {
  try {
    const { qr_token, event_id, gate_label } = req.body;

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

    if (!mongoose.isValidObjectId(event_id)) {
      return res.status(400).json({
        status: "invalid",
        message: "Invalid event ID",
      });
    }

    const scannedBy = req.user?.id;

    if (!mongoose.isValidObjectId(scannedBy)) {
      return res.status(401).json({
        status: "unauthorized",
        message: "Staff login required",
      });
    }

    const gate =
      typeof gate_label === "string" && gate_label.trim()
        ? gate_label.trim()
        : "Main Gate";

    let decodedToken;

    try {
      decodedToken = verifyQrToken(qr_token);
    } catch {
      return res.status(400).json({
        status: "invalid",
        message: "Invalid or expired QR token",
      });
    }

    const event = await Event.findById(event_id).select("_id").lean();

    if (!event) {
      return res.status(404).json({
        status: "invalid",
        message: "Event not found",
      });
    }

    const ticket = await Ticket.findOne({ qr_token });

    if (!ticket) {
      await Scan.create({
        ticket_id: null,
        attendee_id: null,
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

    const ticketAttendeeId = ticket.attendee_id
      ? ticket.attendee_id.toString()
      : null;

    const tokenAttendeeId =
      decodedToken.attendeeId == null
        ? null
        : String(decodedToken.attendeeId);

    const tokenMatchesTicket =
      typeof decodedToken.ticketId === "string" &&
      decodedToken.ticketId === ticket._id.toString() &&
      typeof decodedToken.eventId === "string" &&
      decodedToken.eventId === ticket.event_id.toString() &&
      tokenAttendeeId === ticketAttendeeId;

    if (!tokenMatchesTicket) {
      await Scan.create({
        ticket_id: ticket._id,
        attendee_id: ticket.attendee_id ?? null,
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

    if (
      decodedToken.eventId !== event_id ||
      ticket.event_id.toString() !== event_id
    ) {
      await Scan.create({
        ticket_id: ticket._id,
        attendee_id: ticket.attendee_id ?? null,
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