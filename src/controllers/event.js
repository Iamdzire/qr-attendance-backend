import Event from "../models/event.js";
import mongoose from "mongoose";
import TicketCode from "../models/ticket.js";
import csvParser from "csv-parser";
import { Readable } from "stream";
import uploadToCloudinary from '../utils/uploadToCloudinary.js';
import User from '../models/user.js';
class EventController {
  async createEvent(req, res) {
  const session = await mongoose.startSession();

  let uploadedImagePublicId;

  try {
    const {
      name,
      description,
      date,
      startAt,
      venue,
      status,
      organizer_id,
    } = req.body;

    let staff = req.body.staff ?? [];

    if (typeof staff === "string") {
      try {
        staff = JSON.parse(staff);
      } catch {
        return res.status(400).json({
          success: false,
          message: "Staff must be a valid JSON array of user IDs",
        });
      }
    }

    // Validate required fields.
    if (
      !name?.trim() ||
      !description?.trim() ||
      !date ||
      !startAt ||
      !venue?.trim() ||
      !organizer_id
    ) {
      return res.status(400).json({
        success: false,
        message: "All required event fields must be provided",
      });
    }

    // Validate organizer ID.
    if (!mongoose.isValidObjectId(organizer_id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid organizer ID",
      });
    }

    // Validate staff IDs.
    if (!Array.isArray(staff)) {
      return res.status(400).json({
        success: false,
        message: "Staff must be an array of user IDs",
      });
    }

    if (
      staff.some(
        (id) =>
          typeof id !== "string" ||
          !mongoose.isValidObjectId(id)
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "One or more staff IDs are invalid",
      });
    }

    const uniqueStaffIds = [
      ...new Set(staff.map((id) => id.toString())),
    ];

    // Validate uploaded files.
    const imageFile = req.files?.image?.[0];
    const ticketFile = req.files?.ticket?.[0];

    if (!imageFile) {
      return res.status(400).json({
        success: false,
        message: "Event image is required",
      });
    }

    if (!ticketFile) {
      return res.status(400).json({
        success: false,
        message: "Ticket CSV file is required",
      });
    }

    if (!ticketFile.originalname.toLowerCase().endsWith(".csv")) {
      return res.status(400).json({
        success: false,
        message: "Only CSV files are allowed for ticket uploads",
      });
    }

    // Validate and parse the ticket CSV.
    const rows = await new Promise((resolve, reject) => {
      const results = [];

      Readable.from(ticketFile.buffer)
        .pipe(
          csvParser({
            separator: ticketFile.buffer.includes(0x09) ? "\t" : ",",
            mapHeaders: ({ header }) =>
              header
                .replace(/^\uFEFF/, "")
                .trim()
                .toLowerCase(),
          })
        )
        .on("data", (row) => results.push(row))
        .on("end", () => resolve(results))
        .on("error", reject);
    });

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "The ticket CSV file contains no records",
      });
    }

    const allowedTicketTypes = new Map([
      ["regular", "Regular"],
      ["vip", "VIP"],
      ["vvip", "VVIP"],
      ["premium", "Premium"],
    ]);
    
    const seenCodes = new Set();
    const validTickets = [];
    const invalidRows = [];

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const code = row.code?.trim();
      const rawTicketType = row.ticket_type?.trim();

      if (!code || !rawTicketType) {
        invalidRows.push({
          row: rowNumber,
          reason: !code
            ? "Missing ticket code"
            : "Missing ticket type",
        });

        continue;
      }

      if (seenCodes.has(code)) {
        invalidRows.push({
          row: rowNumber,
          code,
          reason: "Duplicate ticket code in CSV",
        });

        continue;
      }

      seenCodes.add(code);

      const ticketType = allowedTicketTypes.get(
        rawTicketType.toLowerCase()
      );

      if (!ticketType) {
        invalidRows.push({
          row: rowNumber,
          code,
          reason: `Invalid ticket type: ${rawTicketType}`,
        });

        continue;
      }

      validTickets.push({
        code_string: code,
        ticket_type: ticketType,
        source: "CSV",
      });
    }

    if (invalidRows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some ticket CSV rows contain invalid data",
        invalidRows,
      });
    }

    // Start the database transaction.
    session.startTransaction();

    // Validate organizer and staff.
    const organizer = await User.findById(organizer_id)
      .session(session);

    if (!organizer || organizer.role !== "organizer") {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message: "A valid organizer is required",
      });
    }

    const staffUsers = await User.find({
      _id: { $in: uniqueStaffIds },
      role: "staff",
    })
      .select("_id")
      .session(session);

    if (staffUsers.length !== uniqueStaffIds.length) {
      await session.abortTransaction();

      return res.status(400).json({
        success: false,
        message:
          "One or more selected users do not exist or are not staff members",
      });
    }

    // Upload the event image.
    const uploadResult = await uploadToCloudinary(
      imageFile.buffer
    );

    const imageUrl = uploadResult.secure_url;
    uploadedImagePublicId = uploadResult.public_id;

    // Check whether ticket codes already exist.
    const codes = validTickets.map(
      (ticket) => ticket.code_string
    );

    const existingTickets = await TicketCode.find({
      code_string: { $in: codes },
    })
      .select("code")
      .session(session)
      .lean();

    if (existingTickets.length > 0) {
      await session.abortTransaction();

      return res.status(409).json({
        success: false,
        message: "Some ticket codes already exist",
        existingCodes: existingTickets.map(
          (ticket) => ticket.code_string
        ),
      });
    }

    // Create the event.
    const [event] = await Event.create(
      [
        {
          name: name.trim(),
          description: description.trim(),
          date,
          startAt,
          venue: venue.trim(),
          image: imageUrl,
          status: status || "upcoming",
          organizer_id: organizer._id,
          staff: staffUsers.map((user) => user._id),
        },
      ],
      { session }
    );

    // Associate tickets with the new event.
    const ticketsToInsert = validTickets.map((ticket) => ({
      ...ticket,
      event_id: event._id,
    }));

    const createdTickets = await TicketCode.insertMany(
      ticketsToInsert,
      {
        session,
        ordered: true,
      }
    );

    // Commit the transaction.
    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Event created successfully with ticket codes",
      data: {
        event,
        ticketsUploaded: createdTickets.length,
      },
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("CREATE EVENT ERROR:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An event or ticket code already exists",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error creating event",
      error: error.message,
    });
  } finally {
    await session.endSession();
  }
}
  async getAllEvents(req, res) {
    try {
      const events = await Event.find().sort({ createdAt: -1 });

      if (!events) {
        return res.status(404).json({
          success: false,
          message: "No event found",
        });
      }

      if (events.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No event found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "All events fetched successfully",
        event: events,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async getEventsByOrganizer(req, res) {
    try {
      const events = await Event.find({
        organizer_id: req.user.id
      })
      if(!events){
        return res.status(404).json({
          error: "No event found"
        })
      }
      return res.status(200).json({
        message: "Events fetched successfully.",
        data: events
      })
    }catch(error){
      return res.status(500).json({
        error: error.message
      })
    }
  }

  async getEventById(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(404).json({
          success: false,
          message: "Invalid event Id",
        });
      }

      const event = await Event.findById(id);

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "No event found with this id",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Event found and fetched sucessfully",
        event: event,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async deleteEvent(req, res) {
    try {
      const id = req.params.id;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(404).json({
          success: false,
          message: "Invalid event Id",
        });
      }

      const event = await Event.findByIdAndDelete(id);

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "No event with this id found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Event deleted successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  async updateEvent(req, res) {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();

      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(404).json({
          success: false,
          message: "Invalid event Id",
        });
      }

      const { name, description, date, startAt, venue } = req.body;

      if (!name || !description || !date || !startAt || !venue) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "All fields are required",
          data: null,
        });
      }

      const event = await Event.findById(id);

      if (!event) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "No event found with this id",
          data: null,
        });
      }

      event.name = name;
      event.description = description;
      event.date = date;
      event.startAt = startAt;
      event.venue = venue;

      await event.save();

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Event details updated successfully",
        data: event,
      });
    } catch (error) {
      await session.abortTransaction();
      res.status(500).json({
        success: false,
        message: "Error updating event",
        error: error.message,
      });
    } finally {
      session.endSession();
    }
  }

  async batchUploadTickets(req, res) {
    const session = await mongoose.startSession();

    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid event ID",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload a CSV file using the 'ticket' field",
        });
      }

      if (!req.file.originalname.toLowerCase().endsWith(".csv")) {
        return res.status(400).json({
          success: false,
          message: "Only CSV files are allowed",
        });
      }

      const event = await Event.findById(id);

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
        });
      }

      const rows = await new Promise((resolve, reject) => {
        const results = [];

        Readable.from(req.file.buffer)
          .pipe(
            csvParser({
              separator: req.file.buffer.includes(0x09) ? "\t" : ",",

              mapHeaders: ({ header }) =>
                header
                  .replace(/^\uFEFF/, "")
                  .trim()
                  .toLowerCase(),
            }),
          )
          .on("data", (row) => {
            results.push(row);
          })
          .on("end", () => resolve(results))
          .on("error", reject);
      });

      const allowedTicketTypes = new Map([
        ["regular", "Regular"],
        ["vip", "VIP"],
        ["vvip", "VVIP"],
        ["premium", "Premium"],
      ]);

      const uniqueCodes = new Set();
      const duplicateInFile = new Set();
      const invalidRows = [];
      const invalidTicketTypes = [];
      const validTickets = [];

      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;

        const code = row.code?.trim();
        const rawTicketType = row.ticket_type?.trim();

        if (!code) {
          invalidRows.push({
            row: rowNumber,
            reason: "Missing ticket code",
          });

          continue;
        }

        if (!rawTicketType) {
          invalidRows.push({
            row: rowNumber,
            code,
            reason: "Missing ticket type",
          });

          continue;
        }

        const ticketType = allowedTicketTypes.get(rawTicketType.toLowerCase());

        if (!ticketType) {
          invalidTicketTypes.push({
            row: rowNumber,
            code,
            ticket_type: rawTicketType,
            allowedTypes: [...allowedTicketTypes.values()],
          });

          continue;
        }

        if (uniqueCodes.has(code)) {
          duplicateInFile.add(code);
          continue;
        }

        uniqueCodes.add(code);

        validTickets.push({
          code_string: code_string,
          ticket_type: ticketType,
          event_id: event._id,
          source: "CSV",
        });
      }

      if (invalidRows.length > 0 || invalidTicketTypes.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Some CSV rows contain invalid data",
          invalidRows,
          invalidTicketTypes,
        });
      }

      if (validTickets.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid ticket records found",
          duplicatesInFile: [...duplicateInFile],
        });
      }

      const codes = validTickets.map((ticket) => ticket.code_string);

      const existingTickets = await TicketCode.find({
        event_id: event._id,
        code_string: { $in: codes },
      })
        .select("code_string")
        .lean();

      const existingCodes = new Set(
        existingTickets.map((ticket) => ticket.code_string),
      );

      const newTickets = validTickets.filter(
        (ticket) => !existingCodes.has(ticket.code_string),
      );

      if (newTickets.length === 0) {
        return res.status(409).json({
          success: false,
          message: "All uploaded ticket codes already exist for this event",
          totalRows: rows.length,
          inserted: 0,
          duplicatesInFile: [...duplicateInFile],
          alreadyExists: [...existingCodes],
        });
      }

      await session.withTransaction(async () => {
        await TicketCode.insertMany(newTickets, {
          session,
          ordered: true,
        });
      });

      return res.status(201).json({
        success: true,
        message: "Ticket codes uploaded successfully",
        eventId: event._id,
        totalRows: rows.length,
        validUniqueRows: validTickets.length,
        inserted: newTickets.length,
        duplicatesInFile: [...duplicateInFile],
        alreadyExists: [...existingCodes],
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "One or more ticket codes already exist for this event",
          error: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to upload ticket codes",
        error: error.message,
      });
    } finally {
      await session.endSession();
    }
  }

  async getEventTickets(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(404).json({
          success: false,
          message: "Invalid event Id",
        });
      }

      const tickets = await TicketCode.find({
        event_id: id,
      })
        .sort({ status: 1 })
        .select("-event_id -qr_token -source");

      if (tickets.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No ticket found for this event",
        });
      }

      return res.status(200).json({
        success: true,
        count: tickets.length,
        tickets,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve event tickets",
        error: error.message,
      });
    }
  }

  async bulkDeleteTickets(req, res) {
    const session = await mongoose.startSession();
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid event ID",
        });
      }

      const event = await Event.findById(id);

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
        });
      }

      session.startTransaction();

      const bulkTicket = await TicketCode.deleteMany(
        { event_id: event._id },
        { session },
      );

      if (bulkTicket.deletedCount === 0) {
        await session.abortTransaction();

        return res.status(404).json({
          success: false,
          message: "No ticket codes found for this event",
          deleted: 0,
        });
      }

      await session.commitTransaction();

      return res.status(200).json({
        success: true,
        message: "Bulk ticket codes deleted successfully",
        eventId: event._id,
        deleted: bulkTicket.deletedCount,
      });
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      return res.status(500).json({
        success: false,
        message: "Error bulk deleting ticket codes",
        error: error.message,
      });
    } finally {
      await session.endSession();
    }
  }
}
export default new EventController();
