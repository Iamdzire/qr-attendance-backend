import nodemailer from "nodemailer";

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
  ticketType,
}) => {
  const mailOptions = {
    from: `"EVENTIFY" <${process.env.MAIL_USER}>`,
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

export const sendQrEmail = async ({
  attendeeEmail,
  attendeeName,
  eventName,
  eventDate,
  eventVenue,
  ticketCode,
  ticketType, // <-- Make sure this is here
  qrCode,
}) => {
  if (!attendeeEmail) {
    throw new Error("Attendee email is required");
  }

  if (!qrCode) {
    throw new Error("QR code is required");
  }

  const base64Image = qrCode.split("base64,")[1];

  if (!base64Image) {
    throw new Error("Invalid QR code data");
  }

  await transporter.sendMail({
    from: `"EVENTIFY" <${process.env.MAIL_USER}>`,
    to: attendeeEmail,
    subject: `Your ${ticketType || "Event"} Ticket - ${eventName}`,

    text: `
Hello ${attendeeName || "Attendee"},

Your ticket for ${eventName} has been verified successfully.

Ticket Type: ${ticketType || "Standard"}
Ticket Code: ${ticketCode || "N/A"}
Date: ${eventDate ? new Date(eventDate).toLocaleString() : "TBD"}
Venue: ${eventVenue || "TBD"}

Please present the attached QR code at the event entrance.

Thank you.
    `,

    html: `
      <h2>Your Event Ticket</h2>

      <p>Hello <strong>${attendeeName || "Attendee"}</strong>,</p>

      <p>Your ticket for <strong>${eventName}</strong> has been verified successfully.</p>

      <div style="background-color: #f4f4f4; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p style="margin: 5px 0;"><strong>Ticket Type:</strong> <span style="color: #2563eb; font-weight: bold;">${ticketType || "Standard"}</span></p>
        <p style="margin: 5px 0;"><strong>Ticket Code:</strong> ${ticketCode || "N/A"}</p>
        <p style="margin: 5px 0;"><strong>Date:</strong> ${eventDate ? new Date(eventDate).toLocaleString() : "TBD"}</p>
        <p style="margin: 5px 0;"><strong>Venue:</strong> ${eventVenue || "TBD"}</p>
      </div>

      <p>Please present the QR code below at the event entrance:</p>

      <img
        src="cid:event-ticket-qr"
        alt="Event QR Code"
        width="300"
      />

      <p><small>Please keep this QR code safe and do not share it.</small></p>
    `,

    attachments: [
      {
        filename: "event-ticket-qr.png",
        content: base64Image,
        encoding: "base64",
        cid: "event-ticket-qr",
      },
    ],
  });
};
