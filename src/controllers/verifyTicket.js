import Ticket from "../models/ticket.js";
import Attendee from "../models/attendee.js";
import { generateQrToken, verifyQrToken } from "../services/tokenService.js";

import generateQrCode from "../services/qrService.js";

import sendQrEmail from "../services/emailService.js";

export const verifyTicketCode = async (req, res) => {
  try {
    const { code } = req.body;

    // Validate input
    const cleanCode = typeof code === "string" ? code.trim() : "";

    if (!cleanCode) {
      return res.status(400).json({
        success: false,
        message: "Ticket code is required",
      });
    }
    //  Find ticket
    const ticket = await Ticket.findOne({
      code_string: cleanCode,
    }).populate({ path: "attendee_id", model: Attendee });

    // Ticket does not exist
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Invalid ticket code",
      });
    }

    //  Check ticket status
    if (ticket.status === "used") {
      return res.status(409).json({
        success: false,
        message: "This ticket has already been used",
      });
    }
    //  Check attendee
    if (!ticket.attendee_id) {
      return res.status(404).json({
        success: false,
        message: "Attendee information not found",
      });
    }
    //  Get existing QR token
    let qrToken = ticket.qr_token;

    // Verify existing token
    if (qrToken) {
      try {
        verifyQrToken(qrToken);
      } catch (error) {
        // Existing token is invalid or expired.
        qrToken = null;
      }
    }

    //  Generate new token if needed

    if (!qrToken) {
      qrToken = generateQrToken({
        ticketId: ticket._id,
        eventId: ticket.event_id,
        attendeeId: ticket.attendee_id._id,
      });

      ticket.qr_token = qrToken;

      await ticket.save();
    }

    // Generate QR image
    const qrCode = await generateQrCode(qrToken);

    //  Send QR to attende
    await sendQrEmail({
      attendeeEmail: ticket.attendee_id.email,
      attendeeName: ticket.attendee_id.name,
      qrCode,
    });
    // Successful response
    return res.status(200).json({
      success: true,

      message: "Ticket verified and QR code sent successfully",

      data: {
        ticketId: ticket._id,
        attendeeId: ticket.attendee_id._id,
        attendeeEmail: ticket.attendee_id.email,
        eventId: ticket.event_id,
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
