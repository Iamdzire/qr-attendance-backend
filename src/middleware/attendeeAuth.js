import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Attendee from "../models/attendee.js";
import Ticket from "../models/ticket.js";

export const requireAttendeeAuth = async (req, res, next) => {
  try {
    // Step 1: Read the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Bearer token is required.",
      });
    }

    // Step 2: Extract the token
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access token is missing.",
      });
    }

    // Step 3: Ensure the JWT secret is configured
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not configured.");

      return res.status(500).json({
        success: false,
        message: "Authentication service is not configured.",
      });
    }

    // Step 4: Verify the JWT signature and expiration
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired access token.",
      });
    }

    // Step 5: Validate the token's purpose and identifiers
    if (
      decoded.purpose !== "attendee-ticket-access" ||
      !mongoose.isValidObjectId(decoded.id) ||
      !mongoose.isValidObjectId(decoded.eventId) ||
      !mongoose.isValidObjectId(decoded.ticketId)
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid attendee access token.",
      });
    }

    // Step 6: Confirm the attendee still exists
    const attendee = await Attendee.findById(decoded.id).select(
      "_id firstName lastName",
    );

    if (!attendee) {
      return res.status(401).json({
        success: false,
        message: "Attendee account not found.",
      });
    }

    // Step 7: Confirm the ticket belongs to this attendee and event
    const ticket = await Ticket.findOne({
      _id: decoded.ticketId,
      attendee_id: attendee._id,
      event_id: decoded.eventId,
    }).select("_id");

    if (!ticket) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this ticket.",
      });
    }

    // Step 8: Attach verified information to the request
    req.attendee = {
      id: attendee._id.toString(),
      firstName: attendee.firstName,
      lastName: attendee.lastName,
    };

    req.ticketAccess = {
      attendeeId: attendee._id.toString(),
      eventId: decoded.eventId,
    };

    // Step 9: Continue to the controller
    return next();
  } catch (error) {
    console.error("requireAttendeeAuth error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to authenticate attendee.",
    });
  }
};
