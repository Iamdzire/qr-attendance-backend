import mongoose from "mongoose";

import Ticket from "../models/ticket.js";
import Event from "../models/event.js";
import Attendee from "../models/attendee.js";

import { sendTicketCodeEmail } from "../services/emailService.js";

export const registerAttendee = async (req, res) => {
  try {
    const { eventId, firstName, lastName, email, phone, ticket_type } =
      req.body;

    // 1. Validate required fields
    if (
      !eventId ||
      typeof firstName !== "string" ||
      !firstName.trim() ||
      typeof lastName !== "string" ||
      !lastName.trim() ||
      typeof email !== "string" ||
      !email.trim() ||
      typeof phone !== "string" ||
      !phone.trim() ||
      typeof ticket_type !== "string" ||
      !ticket_type.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Event ID, first name, last name, email, phone, and ticket type are required.",
      });
    }

    // 2. Validate event ID
    if (!mongoose.isValidObjectId(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID.",
      });
    }

    // 3. Normalize and validate ticket category
    const normalizedTicketType = ticket_type.trim().toUpperCase();

    const allowedTicketTypes = ["REGULAR", "VIP", "VVIP"];

    if (!allowedTicketTypes.includes(normalizedTicketType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket type. Choose Regular, VIP, or VVIP.",
      });
    }

    const selectedTicketType =
      normalizedTicketType === "REGULAR" ? "Regular" : normalizedTicketType;

    // 4. Confirm that the event exists
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    // Your Event model uses "active" and "inactive" statuses.
    if (event.status !== "upcoming") {
      return res.status(400).json({
        success: false,
        message: "This event is not open for registration.",
      });
    }

    // 5. Normalize attendee details
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedPhone = phone.trim();

    // 6. Find or create the attendee
    let attendee = await Attendee.findOne({
      email: normalizedEmail,
    });

    if (!attendee) {
      try {
        attendee = await Attendee.create({
          firstName: normalizedFirstName,
          lastName: normalizedLastName,
          email: normalizedEmail,
          phone: normalizedPhone,
        });
      } catch (error) {
        // Handle concurrent creation of an attendee with the same email.
        if (error.code === 11000) {
          attendee = await Attendee.findOne({
            email: normalizedEmail,
          });

          if (!attendee) {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    // 7. Prevent duplicate registration for the same event
    const existingTicket = await Ticket.findOne({
      event_id: eventId,
      attendee_id: attendee._id,
    });

    if (existingTicket) {
      return res.status(409).json({
        success: false,
        message: "Attendee already has a ticket for this event.",
      });
    }

    // 8. Atomically assign an available ticket from the selected category
    const ticket = await Ticket.findOneAndUpdate(
      {
        event_id: eventId,
        ticket_type: selectedTicketType,
        attendee_id: null,
        status: "unused",
        qr_token: null,
      },
      {
        $set: {
          attendee_id: attendee._id,
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    // 9. Handle unavailable tickets
    if (!ticket) {
      return res.status(409).json({
        success: false,
        message: `No available ${selectedTicketType} tickets for this event.`,
      });
    }

    // 10. Send the ticket code through Brevo
    try {
      await sendTicketCodeEmail({
        attendeeName: `${attendee.firstName} ${attendee.lastName}`,
        attendeeEmail: attendee.email,
        eventName: event.name,
        eventDate: event.date,
        eventVenue: event.venue,
        ticketCode: ticket.code_string,
        ticketType: ticket.ticket_type,
      });
    } catch (emailError) {
      console.error("Ticket email failed:", emailError);

      // Release the ticket if Brevo rejects the email request.
      try {
        await Ticket.updateOne(
          {
            _id: ticket._id,
            attendee_id: attendee._id,
            status: "unused",
            qr_token: null,
          },
          {
            $set: {
              attendee_id: null,
            },
          },
        );
      } catch (releaseError) {
        console.error("Failed to release assigned ticket:", releaseError);
      }

      return res.status(502).json({
        success: false,
        message:
          "Ticket email could not be sent. Please try again or contact support.",
      });
    }

    // 11. Return successful registration details
    return res.status(201).json({
      success: true,
      message: "Registration successful. Ticket code sent to your email.",

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
        },

        ticket: {
          id: ticket._id,
          code: ticket.code_string,
          status: ticket.status,
          ticketType: ticket.ticket_type,
        },
      },
    });
  } catch (error) {
    console.error("Attendee registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to register attendee.",
    });
  }
};
