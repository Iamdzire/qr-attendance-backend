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

    // 2. Validate the event ID
    if (!mongoose.isValidObjectId(eventId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID.",
      });
    }

    // 3. Normalize and validate the ticket category
    const normalizedTicketType = ticket_type.trim().toUpperCase();

    const allowedTicketTypes = ["REGULAR", "VIP", "VVIP"];

    if (!allowedTicketTypes.includes(normalizedTicketType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket type. Choose Regular, VIP, or VVIP.",
      });
    }

    // Match the capitalization used in your Ticket model
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

    if (event.status !== "upcoming") {
      return res.status(400).json({
        success: false,
        message: "This event is not open for registration.",
      });
    }

    // 5. Find or create the attendee
    const normalizedEmail = email.trim().toLowerCase();

    let attendee = await Attendee.findOne({
      email: normalizedEmail,
    });

    if (!attendee) {
      try {
        attendee = await Attendee.create({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: normalizedEmail,
          phone: phone.trim(),
        });
      } catch (error) {
        // Handle another request creating the same attendee concurrently
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

    // 6. Check whether this attendee already has a ticket for this event
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

    // 7. Find and atomically assign a ticket from the selected category
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

    // 8. Handle unavailable tickets
    if (!ticket) {
      return res.status(409).json({
        success: false,
        message: `No available ${selectedTicketType} tickets for this event.`,
      });
    }

    // 9. Email the assigned ticket code
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

      // Release the ticket if email delivery fails
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
          "Ticket email delivery failed. Please try again or contact support.",
      });
    }

    // 10. Return successful registration details
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
