import mongoose from "mongoose";
import Ticket from "../models/ticket.js";
import Event from "../models/event.js";
import TicketType from "../models/ticketType.js";
import Attendee from "../models/attendee.js";
import { sendTicketCodeEmail } from "../services/emailService.js";

export const registerAttendee = async (req, res) => {
  try {
    const { eventId, firstName, lastName, email, phone, ticket_type_id } =
      req.body;

    // 1. Validate required fields.
    if (
      !eventId ||
      !firstName?.trim() ||
      !lastName?.trim() ||
      !email?.trim() ||
      !phone?.trim() ||
      !ticket_type_id
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Event ID, firstName,lastName, email, phone, and ticket type are required.",
      });
    }

    // 2. Validate MongoDB IDs.
    if (
      !mongoose.isValidObjectId(eventId) ||
      !mongoose.isValidObjectId(ticket_type_id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID or ticket type ID.",
      });
    }

    // 3. Confirm that the event exists.
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found.",
      });
    }

    if (event.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "This event is not currently active.",
      });
    }

    // 4. Confirm that the selected category belongs to this event.
    const ticketType = await TicketType.findOne({
      _id: ticket_type_id,
      event_id: eventId,
      status: "active",
    });

    if (!ticketType) {
      return res.status(404).json({
        success: false,
        message: "Ticket category not found or unavailable for this event.",
      });
    }

    // 5. Find or create the attendee.
    const normalizedEmail = email.trim().toLowerCase();

    let attendee = await Attendee.findOne({
      email: normalizedEmail,
    });

    if (!attendee) {
      attendee = await Attendee.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
      });
    }

    // 6. Check whether the attendee already has a ticket for this event.
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

    // 7. Atomically assign an available code from the selected category.
    const ticket = await Ticket.findOneAndUpdate(
      {
        event_id: eventId,
        ticket_type_id: ticket_type_id,
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

    if (!ticket) {
      return res.status(409).json({
        success: false,
        message: `No available ${ticketType.name} tickets for this event.`,
      });
    }

    // 8. Send the ticket code to the attendee.
    try {
      await sendTicketCodeEmail({
        attendeeName: `${attendee.firstName} ${attendee.lastName}`,
        attendeeEmail: attendee.email,
        eventName: event.name,
        eventDate: event.date,
        eventVenue: event.venue,
        ticketCode: ticket.code_string,
        ticketType: ticketType.name,
      });
    } catch (emailError) {
      console.error("Ticket email failed:", emailError);

      // Release the ticket so the attendee can safely retry.
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

      return res.status(502).json({
        success: false,
        message: "Ticket email delivery failed. Please try registering again.",
      });
    }

    // 9. Return registration details.
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
          ticketType: ticketType.name,
        },

        ticketType: {
          id: ticketType._id,
          name: ticketType.name,
          price: ticketType.price,
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
