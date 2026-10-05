import jwt from "jsonwebtoken";
import crypto from "crypto";

export const generateQrToken = ({ ticketId, eventId, attendeeId }) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  // create a unique identifier
  const tokenId = crypto.randomUUID();

  // details that goes into our token
  const payload = {
    ticketId: ticketId.toString(),
    eventId: eventId.toString(),
    attendeeId: attendeeId.toString(),
    jti: tokenId,
  };

  // signing the token
  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: process.env.QR_TOKEN_EXPIRES_IN,
  });
};

export const verifyQrToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configure");
  }

  return jwt.verify(token, process.env.JWT_SECRET, {
    algorithms: ["HS256"],
  });
};
