import mongoose from "mongoose";
import Attendee from "../models/attendee.js";
import Ticket from "../models/ticket.js";
import Event from "../models/event.js";

export const getAttendeeTicket = async (req, res) => {
  try {
    const { attendeeId, eventId } = req.params;

    // Validate MongoDB IDs
    if (
      !mongoose.isValidObjectId(attendeeId) ||
      !mongoose.isValidObjectId(eventId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendee ID or event ID",
      });
    }

    // Confirm that the attendee exists
    const attendee = await Attendee.findById(attendeeId).select(
      "firstName lastName email phone",
    );

    if (!attendee) {
      return res.status(404).json({
        success: false,
        message: "Attendee not found",
      });
    }

    // Confirm that the event exists
    const event = await Event.findById(eventId).select(
      "name date venue status",
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Find the attendee's ticket for this event
    const ticket = await Ticket.findOne({
      attendee_id: attendeeId,
      event_id: eventId,
    }).select("-qr_token");

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "No ticket found for this attendee and event",
      });
    }

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
          qrGenerated: Boolean(ticket.qr_token),
        },
      },
    });
  } catch (error) {
    console.error("Get attendee ticket error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve attendee ticket",
    });
  }
};
