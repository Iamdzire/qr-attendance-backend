import jwt from "jsonwebtoken";
import crypto from "crypto";

export const generateQrToken = ({ ticketId, eventId, attendeeId }) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  if (!ticketId || !eventId) {
    throw new Error("Ticket ID and event ID are required");
  }

  const payload = {
    ticketId: ticketId.toString(),
    eventId: eventId.toString(),
    attendeeId: attendeeId == null ? null : attendeeId.toString(),
    jti: crypto.randomUUID(),
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.QR_TOKEN_EXPIRES_IN,
  });
};

export const verifyQrToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ["HS256"],
  });
};