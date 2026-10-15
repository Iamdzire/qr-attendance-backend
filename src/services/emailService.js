import { BrevoClient } from "@getbrevo/brevo";

// Brevo configuration
const apiKey = process.env.BREVO_API_KEY;
const fromEmail = process.env.BREVO_FROM_EMAIL;

if (!apiKey) {
  throw new Error("BREVO_API_KEY is missing from your environment variables");
}

if (!fromEmail) {
  throw new Error(
    "BREVO_FROM_EMAIL is missing from your environment variables",
  );
}

const brevo = new BrevoClient({
  apiKey: apiKey,
});

// Escape HTML values before inserting them into email templates.
const escapeHtml = (value) => {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
};

// Format event dates consistently.
const formatEventDate = (eventDate) => {
  if (!eventDate) {
    return "TBD";
  }

  const date = new Date(eventDate);

  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  return date.toLocaleString();
};

// Shared sender configuration.
const getSender = () => ({
  name: "EVENTIFY",
  email: fromEmail,
});

/**
 * Send the attendee's ticket code after registration.
 */
export const sendTicketCodeEmail = async ({
  attendeeName,
  attendeeEmail,
  eventName,
  eventDate,
  eventVenue,
  ticketCode,
  ticketType,
}) => {
  if (!attendeeEmail) {
    throw new Error("Attendee email is required");
  }

  if (!ticketCode) {
    throw new Error("Ticket code is required");
  }

  const safeName = escapeHtml(attendeeName || "Attendee");
  const safeEventName = escapeHtml(eventName || "Event");
  const safeEventDate = escapeHtml(formatEventDate(eventDate));
  const safeVenue = escapeHtml(eventVenue || "TBD");
  const safeTicketCode = escapeHtml(ticketCode);
  const safeTicketType = escapeHtml(ticketType || "Regular");

  try {
    const response = await brevo.transactionalEmails.sendTransacEmail({
      sender: getSender(),
      to: [{ email: attendeeEmail, name: attendeeName || "Attendee" }],
      subject: `Your Ticket Code - ${eventName || "Event"}`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: auto;">

          <h2>Registration Successful 🎟️</h2>

          <p>Hello ${safeName},</p>

          <p>
            Your registration for
            <strong>${safeEventName}</strong>
            was successful.
          </p>

          <h3>Event Details</h3>

          <p>
            <strong>Event:</strong> ${safeEventName}<br>
            <strong>Date:</strong> ${safeEventDate}<br>
            <strong>Venue:</strong> ${safeVenue}<br>
            <strong>Ticket Type:</strong> ${safeTicketType}
          </p>

          <h3>Your Ticket</h3>

          <p>Your ticket code is:</p>

          <div style="
            font-size: 28px;
            font-weight: bold;
            letter-spacing: 4px;
            background: #f4f4f4;
            padding: 15px;
            display: inline-block;
            border-radius: 5px;
          ">
            ${safeTicketCode}
          </div>

          <p>
            Keep this code safe. You will need it to verify your ticket
            and generate your event QR code.
          </p>

          <p>Thank you for registering with EVENTIFY.</p>

        </div>
      `,
    });

    console.log(
      "Ticket-code email accepted by Brevo:",
      response?.messageId || response,
    );
    return response;
  } catch (error) {
    console.error("Brevo ticket-code email error:", error);
    throw new Error("Failed to send ticket-code email");
  }
};

/**
 * Send the attendee's QR code after ticket verification.
 */
export const sendQrEmail = async ({
  attendeeEmail,
  attendeeName,
  eventName,
  eventDate,
  eventVenue,
  ticketCode,
  ticketType,
  qrCode,
}) => {
  if (!attendeeEmail) {
    throw new Error("Attendee email is required");
  }

  if (!qrCode || typeof qrCode !== "string") {
    throw new Error("QR code is required");
  }

  // Ensure full data URL format for inline HTML rendering
  const formattedQrCode = qrCode.startsWith("data:image/")
    ? qrCode
    : `data:image/png;base64,${qrCode}`;

  // Extract clean base64 string for the attachment object
  const base64Match = qrCode.match(
    /^data:image\/png;base64,([A-Za-z0-9+/=\r\n]+)$/,
  );
  const base64Image = base64Match ? base64Match[1].replace(/\s/g, "") : qrCode;

  const safeName = escapeHtml(attendeeName || "Attendee");
  const safeEventName = escapeHtml(eventName || "Event");
  const safeEventDate = escapeHtml(formatEventDate(eventDate));
  const safeVenue = escapeHtml(eventVenue || "TBD");
  const safeTicketCode = escapeHtml(ticketCode || "N/A");
  const safeTicketType = escapeHtml(ticketType || "Standard");

  const textContent = `
Hello ${attendeeName || "Attendee"},

Your ticket for ${eventName || "the event"} has been verified successfully.

Ticket Type: ${ticketType || "Standard"}
Ticket Code: ${ticketCode || "N/A"}
Date: ${formatEventDate(eventDate)}
Venue: ${eventVenue || "TBD"}

Please present your QR code at the event entrance.

Thank you,
EVENTIFY
  `.trim();

  try {
    const response = await brevo.transactionalEmails.sendTransacEmail({
      sender: getSender(),
      to: [{ email: attendeeEmail, name: attendeeName || "Attendee" }],
      subject: `Your ${ticketType || "Event"} Ticket - ${eventName || "Event"}`,
      textContent: textContent,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: auto;">

          <h2>Your Event Ticket 🎟️</h2>

          <p>Hello <strong>${safeName}</strong>,</p>

          <p>
            Your ticket for <strong>${safeEventName}</strong>
            has been verified successfully.
          </p>

          <div style="
            background-color: #f4f4f4;
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
          ">
            <p style="margin: 5px 0;">
              <strong>Ticket Type:</strong> ${safeTicketType}
            </p>

            <p style="margin: 5px 0;">
              <strong>Ticket Code:</strong> ${safeTicketCode}
            </p>

            <p style="margin: 5px 0;">
              <strong>Date:</strong> ${safeEventDate}
            </p>

            <p style="margin: 5px 0;">
              <strong>Venue:</strong> ${safeVenue}
            </p>
          </div>

         

          <p>
            <small>
              Keep your QR code safe and do not share it with other people.
            </small>
          </p>

          <p>Thank you,<br>EVENTIFY</p>

        </div>
      `,
      attachment: [
        {
          name: "qrcode.png", // Valid file format name for Brevo
          content: base64Image,
        },
      ],
    });

    return response;
  } catch (error) {
    console.error("Brevo QR email error:", error);
    throw new Error("Failed to send QR-code email");
  }
};
