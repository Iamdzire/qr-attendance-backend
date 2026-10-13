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

const sendQrEmail = async ({ attendeeEmail, attendeeName, qrCode }) => {
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
    from: `"QR Attendance System" <${process.env.MAIL_USER}>`,

    to: attendeeEmail,

    subject: "Your Event QR Ticket",

    text: `
Hello ${attendeeName || "Attendee"},

Your event ticket has been verified successfully.

Please present the attached QR code at the event entrance.

Thank you.
    `,

    html: `
      <h2>Your Event Ticket</h2>

      <p>Hello ${attendeeName || "Attendee"},</p>

      <p>
        Your ticket has been verified successfully.
      </p>

      <p>
        Please present the QR code below at the event entrance.
      </p>

      <img
        src="cid:event-ticket-qr"
        alt="Event QR Code"
        width="400"
      />

      <p>
        Please keep this QR code safe and do not share it.
      </p>
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

export default sendQrEmail;
