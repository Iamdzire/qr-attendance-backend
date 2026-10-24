import mongoose from "mongoose";
import Attendee from "../models/attendee.js";
import Ticket from "../models/ticket.js";
import Event from "../models/event.js";
import generateQrCode from "../services/qrService.js";
import { verifyQrToken } from "../services/tokenService.js";

export const getAttendeeTicket = async (req, res) => {
  try {
    const { attendeeId, eventId } = req.ticketAccess;

    if (
      !mongoose.isValidObjectId(attendeeId) ||
      !mongoose.isValidObjectId(eventId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendee ID or event ID",
      });
    }

    const attendee = await Attendee.findById(attendeeId).select(
      "firstName lastName email phone",
    );

    if (!attendee) {
      return res.status(404).json({
        success: false,
        message: "Attendee not found",
      });
    }

    const event = await Event.findById(eventId).select(
      "name date venue status",
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const ticket = await Ticket.findOne({
      attendee_id: attendeeId,
      event_id: eventId,
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "No ticket found for this attendee and event",
      });
    }

    if (!ticket.qr_token) {
      return res.status(409).json({
        success: false,
        message: "The QR code is not ready yet",
      });
    }

    let decodedToken;

    try {
      decodedToken = verifyQrToken(ticket.qr_token);
    } catch {
      return res.status(409).json({
        success: false,
        message: "The saved QR token is invalid or expired",
      });
    }

    const tokenAttendeeId =
      decodedToken.attendeeId == null ? null : String(decodedToken.attendeeId);

    const ticketMatchesToken =
      decodedToken.ticketId === ticket._id.toString() &&
      decodedToken.eventId === ticket.event_id.toString() &&
      tokenAttendeeId === ticket.attendee_id?.toString();

    if (!ticketMatchesToken) {
      return res.status(409).json({
        success: false,
        message: "The saved QR token does not match this ticket",
      });
    }

    const qrCode = await generateQrCode(ticket.qr_token);

    return res.status(200).json({
      success: true,
      message: "Attendee ticket retrieved successfully",
      data: {
        attendee: {
          id: attendee._id,
          firstName: attendee.firstName,
          lastName: attendee.lastName,
          email: attendee.email,
          phone: attendee.phone,
        },
        event: {
          id: event._id,
          name: event.name,
          date: event.date,
          venue: event.venue,
          status: event.status,
        },
        ticket: {
          id: ticket._id,
          code: ticket.code_string,
          status: ticket.status,
          ticket_type: ticket.ticket_type,
          qrGenerated: true,
          qrCode,
        },
      },
    });
  } catch (error) {
    console.error("getAttendeeTicket error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve attendee ticket",
    });
  }
};
