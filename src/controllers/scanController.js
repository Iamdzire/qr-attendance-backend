import mongoose from "mongoose";
import Event from "../models/event.js";
import Ticket from "../models/ticket.js";
import Attendee from "../models/attendee.js";
import Scan from "../models/scan.js";

const TIMEZONE = "Africa/Lagos";
const RECENT_LIMIT = 10;

const round1 = (number) => Math.round(number * 10) / 10;

const getAttendeeDetails = async (attendeeId) => {
  if (!attendeeId) {
    return null;
  }

  const attendee = await Attendee.findById(attendeeId)
    .select("firstName lastName")
    .lean();

  if (!attendee) {
    return null;
  }

  return {
    id: attendee._id,
    firstName: attendee.firstName,
    lastName: attendee.lastName,
  };
};

// GET /api/scans/events/:id/attendance
export const getEventAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event id",
      });
    }

    const event = await Event.findOne({
      _id: id,
      organizer_id: req.user.id,
    })
      .select("name date venue")
      .lean();

    if (!event) {
      return res.status(404).json({
        success: false,
        message: "Event not found",
      });
    }

    const eventId = new mongoose.Types.ObjectId(id);

    const ticketPipeline = [
      { $match: { event_id: eventId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ];

    const scanPipeline = [
      { $match: { event_id: eventId } },
      {
        $facet: {
          outcomes: [
            { $group: { _id: "$scan_result", count: { $sum: 1 } } },
          ],
          perGate: [
            { $match: { scan_result: "valid" } },
            { $group: { _id: "$gate_label", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          perHour: [
            { $match: { scan_result: "valid" } },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: "%Y-%m-%d %H:00",
                    date: "$createdAt",
                    timezone: TIMEZONE,
                  },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          recent: [
            { $sort: { createdAt: -1 } },
            { $limit: RECENT_LIMIT },
            {
              $lookup: {
                from: Ticket.collection.name,
                localField: "ticket_id",
                foreignField: "_id",
                as: "ticket",
              },
            },
            {
              $project: {
                _id: 0,
                ticketCode: {
                  $arrayElemAt: ["$ticket.code_string", 0],
                },
                result: "$scan_result",
                gate: "$gate_label",
                time: "$createdAt",
              },
            },
          ],
        },
      },
    ];

    const [ticketGroups, [facets]] = await Promise.all([
      Ticket.aggregate(ticketPipeline),
      Scan.aggregate(scanPipeline),
    ]);

    const ticketCount = (status) => {
      const found = ticketGroups.find((ticket) => ticket._id === status);
      return found ? found.count : 0;
    };

    const scanCount = (result) => {
      const found = facets.outcomes.find((outcome) => outcome._id === result);
      return found ? found.count : 0;
    };

    const totalTickets = ticketGroups.reduce(
      (sum, ticket) => sum + ticket.count,
      0,
    );
    const checkedIn = ticketCount("used");
    const totalScans = facets.outcomes.reduce(
      (sum, outcome) => sum + outcome.count,
      0,
    );
    const duplicate = scanCount("duplicate");

    return res.status(200).json({
      success: true,
      data: {
        event: {
          id,
          name: event.name,
          date: event.date,
          venue: event.venue,
        },
        totalTickets,
        checkedIn,
        notYetCheckedIn: Math.max(totalTickets - checkedIn, 0),
        attendanceRate:
          totalTickets > 0 ? round1((checkedIn / totalTickets) * 100) : 0,
        scans: {
          total: totalScans,
          valid: scanCount("valid"),
          duplicate,
          invalid: scanCount("invalid"),
          wrongEvent: scanCount("wrong-event"),
          pendingSync: scanCount("pending-sync"),
          duplicateRate:
            totalScans > 0 ? round1((duplicate / totalScans) * 100) : 0,
        },
        perGate: facets.perGate.map((gate) => ({
          gate: gate._id || "Unknown",
          count: gate.count,
        })),
        perHour: facets.perHour.map((hour) => ({
          hour: hour._id,
          count: hour.count,
        })),
        recentScans: facets.recent,
      },
    });
  } catch (error) {
    console.error("getEventAttendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// GET /api/scans/events/:id/staff-attendance
export const getStaffEventAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid event id",
      });
    }

    const event = await Event.findOne({
      _id: id,
      staff: req.user.id,
    })
      .select("name date venue")
      .lean();

    if (!event) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this event",
      });
    }

    const eventFilter = { event_id: id };

    const [totalTickets, checkedIn, notYetCheckedIn, recentRecords] =
      await Promise.all([
        Ticket.countDocuments(eventFilter),
        Ticket.countDocuments({ ...eventFilter, status: "used" }),
        Ticket.countDocuments({ ...eventFilter, status: "unused" }),
        Scan.find(eventFilter)
          .sort({ createdAt: -1 })
          .limit(RECENT_LIMIT)
          .populate({
            path: "ticket_id",
            select: "code_string ticket_type attendee_id",
            populate: {
              path: "attendee_id",
              select: "firstName lastName",
            },
          })
          .populate("attendee_id", "firstName lastName")
          .lean(),
      ]);

    const recentScans = recentRecords.map((record) => {
      const ticket = record.ticket_id;
      const attendee =
        record.attendee_id || (ticket && ticket.attendee_id) || null;

      return {
        ticketCode: ticket?.code_string ?? null,
        result: record.scan_result,
        time: record.createdAt,
        ticketType: ticket?.ticket_type ?? null,
        attendee: attendee
          ? {
              id: attendee._id,
              firstName: attendee.firstName,
              lastName: attendee.lastName,
            }
          : null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        event: {
          id: event._id,
          name: event.name,
          date: event.date,
          venue: event.venue,
        },
        totalTickets,
        checkedIn,
        notYetCheckedIn,
        attendanceRate:
          totalTickets > 0 ? round1((checkedIn / totalTickets) * 100) : 0,
        recentScans,
      },
    });
  } catch (error) {
    console.error("getStaffEventAttendance error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/*
 * Called after a valid ticket has been found.
 * The atomic update prevents simultaneous scans from checking in
 * the same ticket more than once.
 */
export const checkInTicket = async ({ ticket, event_id, scannedBy, gate }) => {
  const attendee = await getAttendeeDetails(ticket.attendee_id);

  const claimed = await Ticket.findOneAndUpdate(
    { _id: ticket._id, status: "unused" },
    { $set: { status: "used" } },
    { returnDocument: "after" },
  );

  if (!claimed) {
    const firstScan = await Scan.findOne({
      ticket_id: ticket._id,
      scan_result: "valid",
    })
      .sort({ createdAt: 1 })
      .lean();

    await Scan.create({
      ticket_id: ticket._id,
      attendee_id: ticket.attendee_id ?? null,
      event_id,
      scanned_by: scannedBy,
      scan_result: "duplicate",
      ...(gate && { gate_label: gate }),
    });

    return {
      statusCode: 409,
      body: {
        status: "duplicate",
        message: "Ticket has already been used",
        ticketCode: ticket.code_string,
        ticketType: ticket.ticket_type,
        attendee,
        firstCheckedInAt: firstScan ? firstScan.createdAt : null,
      },
    };
  }

  try {
    const scan = await Scan.create({
      ticket_id: claimed._id,
      attendee_id: claimed.attendee_id ?? null,
      event_id,
      scanned_by: scannedBy,
      scan_result: "valid",
      ...(gate && { gate_label: gate }),
    });

    return {
      statusCode: 200,
      body: {
        status: "valid",
        message: "Ticket is valid",
        ticketCode: claimed.code_string,
        ticketType: claimed.ticket_type,
        attendee,
        checkedInAt: scan.createdAt,
      },
    };
  } catch (saveError) {
    await Ticket.updateOne(
      { _id: claimed._id },
      { $set: { status: "unused" } },
    );

    throw saveError;
  }
};