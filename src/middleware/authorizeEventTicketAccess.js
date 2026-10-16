import mongoose from "mongoose";
import Event from "../models/event.js";

export const authorizeEventTicketAccess = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event ID",
      });
    }

    const event = await Event.findById(id)
      .select("_id organizer_id staff")
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const userId = req.user?.id;
    const role = req.user?.role;

    const isOrganizer =
      role === "organizer" &&
      event.organizer_id?.toString() === userId;

    const isAssignedStaff =
      role === "staff" &&
      Array.isArray(event.staff) &&
      event.staff.some((staffId) => staffId.toString() === userId);

    if (!isOrganizer && !isAssignedStaff) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this event's ticket codes",
      });
    }

    return next();
  } catch (error) {
    console.error("authorizeEventTicketAccess error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to authorize event ticket access",
    });
  }
};