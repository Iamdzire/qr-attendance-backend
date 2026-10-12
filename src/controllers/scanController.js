import mongoose from 'mongoose';
import Event from '../models/event.js';
import Ticket from '../models/ticket.js';
import Scan from '../models/scan.js';

const TIMEZONE = 'Africa/Lagos'; // used to group check-ins by hour
const RECENT_LIMIT = 10;         // how many recent scans to return

const round1 = (n) => Math.round(n * 10) / 10;

// GET /api/scans/events/:id/attendance
export const getEventAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Make sure the id in the URL looks like a real MongoDB id
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid event id' });
    }

    // 2. Make sure the event exists
    const event = await Event.findById(id).select('name date venue').lean();
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Aggregations do NOT auto-convert text ids, so we convert by hand
    const eventId = new mongoose.Types.ObjectId(id);

    // 3. Ticket counts: how many tickets exist, grouped by status
    const ticketPipeline = [
      { $match: { event_id: eventId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ];

    // 4. Scan reports: four mini-reports run on the same set of scans
    const scanPipeline = [
      { $match: { event_id: eventId } },
      {
        $facet: {
          // Count of scans per result type
          outcomes: [{ $group: { _id: '$scan_result', count: { $sum: 1 } } }],

          // Valid check-ins per gate
          perGate: [
            { $match: { scan_result: 'valid' } },
            { $group: { _id: '$gate_label', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],

          // Valid check-ins per hour (shows peak times)
          perHour: [
            { $match: { scan_result: 'valid' } },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m-%d %H:00',
                    date: '$createdAt',
                    timezone: TIMEZONE,
                  },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],

          // Latest scans for a live feed (with the ticket code looked up)
          recent: [
            { $sort: { createdAt: -1 } },
            { $limit: RECENT_LIMIT },
            {
              $lookup: {
                from: Ticket.collection.name,
                localField: 'ticket_id',
                foreignField: '_id',
                as: 'ticket',
              },
            },
            {
              $project: {
                _id: 0,
                ticketCode: { $arrayElemAt: ['$ticket.code_string', 0] },
                result: '$scan_result',
                gate: '$gate_label',
                time: '$createdAt',
              },
            },
          ],
        },
      },
    ];

    // 5. Run both database queries at the same time
    const [ticketGroups, [facets]] = await Promise.all([
      Ticket.aggregate(ticketPipeline),
      Scan.aggregate(scanPipeline),
    ]);

    // 6. Turn the raw results into clean numbers
    const ticketCount = (status) => {
      const found = ticketGroups.find((t) => t._id === status);
      return found ? found.count : 0;
    };
    const scanCount = (result) => {
      const found = facets.outcomes.find((o) => o._id === result);
      return found ? found.count : 0;
    };

    const totalTickets = ticketGroups.reduce((sum, t) => sum + t.count, 0);
    const checkedIn = ticketCount('used');
    const totalScans = facets.outcomes.reduce((sum, o) => sum + o.count, 0);
    const duplicate = scanCount('duplicate');

    return res.status(200).json({
      success: true,
      data: {
        event: { id, name: event.name, date: event.date, venue: event.venue },
        totalTickets,
        checkedIn,
        notYetCheckedIn: Math.max(totalTickets - checkedIn, 0),
        attendanceRate: totalTickets > 0 ? round1((checkedIn / totalTickets) * 100) : 0,
        scans: {
          total: totalScans,
          valid: scanCount('valid'),
          duplicate,
          invalid: scanCount('invalid'),
          wrongEvent: scanCount('wrong-event'),
          pendingSync: scanCount('pending-sync'),
          duplicateRate: totalScans > 0 ? round1((duplicate / totalScans) * 100) : 0,
        },
        perGate: facets.perGate.map((g) => ({ gate: g._id || 'Unknown', count: g.count })),
        perHour: facets.perHour.map((h) => ({ hour: h._id, count: h.count })),
        recentScans: facets.recent,
      },
    });
  } catch (error) {
    console.error('getEventAttendance error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ======================================================================
   FRAUD PREVENTION (owner: Maddiiedev)
   Call this AFTER the right ticket has been found for the right event.
   Returns { statusCode, body }; it does NOT send the response itself.
   ====================================================================== */
export const checkInTicket = async ({ ticket, event_id, scannedBy, gate }) => {
  // One atomic step: only an UNUSED ticket can be changed, so two scanners
  // can never both succeed on the same ticket.
  const claimed = await Ticket.findOneAndUpdate(
    { _id: ticket._id, status: 'unused' },
    { $set: { status: 'used' } },
    { returnDocument: 'after' }
  );

  // Not claimed: already used, so block entry.
  if (!claimed) {
    const firstScan = await Scan.findOne({ ticket_id: ticket._id, scan_result: 'valid' })
      .sort({ createdAt: 1 })
      .lean();

    await Scan.create({
      ticket_id: ticket._id,
      event_id,
      scanned_by: scannedBy,
      scan_result: 'duplicate',
      ...(gate && { gate_label: gate }),
    });

    return {
      statusCode: 409,
      body: {
        status: 'duplicate',
        message: 'Ticket has already been used',  
        ticketCode: ticket.code_string,
        firstCheckedInAt: firstScan ? firstScan.createdAt : null,
      },
    };
  }

  // Claimed: record the check-in.
  try {
    const scan = await Scan.create({
      ticket_id: ticket._id,
      event_id,
      scanned_by: scannedBy,
      scan_result: 'valid',
      ...(gate && { gate_label: gate }),
    });

    return {
      statusCode: 200,
      body: {
             status: 'valid',
             message: 'Ticket is valid',
             ticketCode: claimed.code_string,
             checkedInAt: scan.createdAt,
     },
    };
  } catch (saveError) {
    // If the record failed to save, put the ticket back so the person
    // isn't locked out by a server hiccup.
    await Ticket.updateOne({ _id: ticket._id }, { $set: { status: 'unused' } });
    throw saveError;
  }
};
