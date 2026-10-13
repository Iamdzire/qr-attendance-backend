import Ticket from "../models/ticket.js";
import Event from "../models/event.js";
import Attendee from "../models/attendee.js";
import nodemailer from "nodemailer";

export const registerAttendee = async (req, res) => {
  try {
    const { eventId, name, email, phone } = req.body;

    // Validate required information
    if (!eventId || !name || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: "eventId, name, email, phone ",
      });
    }

    //  Confirm that the event exists
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    // Look for the attendee
    let attendee = await Attendee.findOne({
      email: email.toLowerCase().trim(),
    });

    // Create attendee if they don't exist
    if (!attendee) {
      attendee = await Attendee.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
      });
    }

    // Check if attendee already has a ticket
    const existingTicket = await Ticket.findOne({
      event_id: eventId,
      attendee_id: attendee._id,
    });

    if (existingTicket) {
      return res.status(409).json({
        success: false,
        message: "Attendee already has a ticket for this event",
      });
    }

    // Find an available ticket from the organizer's pool
    const ticket = await Ticket.findOneAndUpdate(
      {
        event_id: eventId,
        attendee_id: null,
        status: "unused",
      },
      {
        $set: {
          attendee_id: attendee._id,
        },
      },
      {
        returnDocument: "after",
      },
    );

    // Check if a ticket was available
    if (!ticket) {
      return res.status(409).json({
        success: false,
        message: "No available tickets for this event",
      });
    }
    // send the ticket details to the attendee
    try {
      await sendTicketCodeEmail({
        attendeeName: attendee.name,
        attendeeEmail: attendee.email,
        eventName: event.name,
        eventDate: event.date,
        eventVenue: event.venue,
        ticketCode: ticket.code_string,
      });
    } catch (emailError) {
      console.error("Ticket email failed:", emailError);

      return res.status(500).json({
        success: false,
        message: "Ticket was assigned, but we could not send the ticket email",
      });
    }
    // Return the assigned ticket
    return res.status(201).json({
      success: true,
      message: "Registration successful. Ticket assigned.",
      data: {
        attendee: {
          id: attendee._id,
          name: attendee.name,
          email: attendee.email,
          phone: attendee.phone,
        },

        ticket: {
          id: ticket._id,
          code: ticket.code_string,
          status: ticket.status,
        },

        event: {
          id: event._id,
          name: event.name,
          date: event.date,
          venue: event.venue,
        },
      },
    });
  } catch (error) {
    console.error("Attendee registration error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to register attendee",
    });
  }
};

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: Number(process.env.MAIL_PORT) === 465,

  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});

export const sendTicketCodeEmail = async ({
  attendeeName,
  attendeeEmail,
  eventName,
  eventDate,
  eventVenue,
  ticketCode,
}) => {
  const mailOptions = {
    from: `"Event Ticketing System" <${process.env.MAIL_USER}>`,
    to: attendeeEmail,

    subject: `Your Ticket Code - ${eventName}`,

    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Registration Successful 🎟️</h2>

        <p>Hello ${attendeeName},</p>

        <p>
          Your registration for <strong>${eventName}</strong>
          was successful.
        </p>

        <h3>Event Details</h3>

        <p>
          <strong>Event:</strong> ${eventName}<br>
          <strong>Date:</strong> ${new Date(eventDate).toLocaleString()}<br>
          <strong>Venue:</strong> ${eventVenue}
        </p>

        <h3>Your Ticket</h3>

        <p>
          <strong>Ticket Code:</strong>
        </p>

        <div
          style="
            font-size: 28px;
            font-weight: bold;
            letter-spacing: 4px;
            background: #f4f4f4;
            padding: 15px;
            display: inline-block;
          "
        >
          ${ticketCode}
        </div>

        <p>
          Keep this code safe. You will need it to verify your ticket
          and generate your event QR code.
        </p>

        <p>
          Thank you.
        </p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};
