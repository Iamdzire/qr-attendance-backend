import mongoose from "mongoose";
import Ticket from "../models/ticket.js";
import Attendee from "../models/attendee.js";
import Event from "../models/event.js";

import { generateQrToken, verifyQrToken } from "../services/tokenService.js";

import generateQrCode from "../services/qrService.js";
import { sendQrEmail } from "../services/emailService.js";

export const verifyTicketCode = async (req, res) => {
  try {
    const { code, eventId } = req.body;

    // 1. Validate input
    const cleanCode = typeof code === "string" ? code.trim() : "";

    if (!cleanCode || !eventId) {
      return res.status(400).json({
        success: false,
        message: "Ticket code and event ID are required",
      });
    }

    // 2. Validate event ID
    if (!mongoose.isValidObjectId(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    // 3. Confirm that the event exists
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // 4. Find the ticket for this event
    const ticket = await Ticket.findOne({
      code_string: cleanCode,
      event_id: eventId,
    })
      .populate({
        path: "attendee_id",
        model: Attendee,
      })
      .populate("ticket_type");

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Invalid ticket code for this event",
      });
    }

    // 5. Check whether the ticket has already been used
    if (ticket.status === "used") {
      return res.status(409).json({
        success: false,
        message: "This ticket has already been used",
      });
    }

    // 6. Confirm that the ticket has an attendee
    if (!ticket.attendee_id) {
      return res.status(400).json({
        success: false,
        message: "This ticket has not been assigned to an attendee",
      });
    }

    const attendee = ticket.attendee_id;

    // 7. Reuse an existing valid QR token where possible
    let qrToken = ticket.qr_token;

    if (qrToken) {
      try {
        verifyQrToken(qrToken);
      } catch {
        qrToken = null;
      }
    }

    // 8. Generate and save a token if one does not exist
    if (!qrToken) {
      qrToken = generateQrToken({
        ticketId: ticket._id,
        eventId: ticket.event_id,
        attendeeId: attendee._id,
      });

      ticket.qr_token = qrToken;

      await ticket.save();
    }

    // 9. Generate the QR image
    const qrCode = await generateQrCode(qrToken);

    //Generate a goodle Maps link based on the event venue
    const mapUrl =
      event.mapUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue)}"`;

    // 10. Email the QR code using the attendee's full name
    await sendQrEmail({
      attendeeEmail: attendee.email,
      attendeeName: `${attendee.firstName} ${attendee.lastName}`,
      eventName: event.name,
      eventDate: event.date,
      eventVenue: event.venue,
      ticketCode: ticket.code_string,
      ticketType: ticket.ticket_type,
      qrCode,
    });

    // 11. Return a successful response
    return res.status(200).json({
      success: true,
      message: "Ticket verified and QR code emailed successfully",
      data: {
        ticketId: ticket._id,
        attendee: {
          id: attendee._id,
          firstName: attendee.firstName,
          lastName: attendee.lastName,
          email: attendee.email,
        },
        event: {
          id: event._id,
          name: event.name,
          date: event.date,
          venue: event.venue,
          mapUrl: mapUrl,
        },
      },
    });
  } catch (error) {
    console.error("Ticket verification error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to verify ticket and send QR code",
    });
  }
};
