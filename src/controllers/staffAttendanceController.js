import Event from "../models/event.js";

export const getAssignedStaffEvents = async (req, res) => {
  try {
    const events = await Event.find({
      staff: req.user.id,
    })
      .select("name date venue status organizer_id")
      .sort({ date: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: events.map((event) => ({
        id: event._id,
        name: event.name,
        date: event.date,
        venue: event.venue,
        status: event.status,
        organizerId: event.organizer_id,
      })),
    });
  } catch (error) {
    console.error("getAssignedStaffEvents error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve assigned events",
    });
  }
};