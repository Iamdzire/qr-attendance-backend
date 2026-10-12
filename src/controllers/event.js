import Event from "../models/event.js";
import mongoose from "mongoose";
import TicketCode from "../models/ticket.js";
import csvParser from "csv-parser";
import { Readable } from "stream";
import uploadToCloudinary from "../utils/uploadToCloudinary.js";
import TicketType from "../models/ticketType.js";
class EventController {
  async createEvent(req, res) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      const { name, description, date, startAt, venue, status, organizer_id } =
        req.body;

      if (
        !name ||
        !description ||
        !date ||
        !startAt ||
        !venue ||
        !organizer_id
      ) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "All fields are required",
          data: null,
        });
      }

      if (!req.file) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "Image is required, please upload an image",
        });
      }

      const uploadResult = await uploadToCloudinary(req.file.buffer);

      const imageUrl = uploadResult.secure_url;

      const event = await Event.create(
        [
          {
            name: name.trim(),
            description: description.trim(),
            date,
            startAt,
            venue: venue.trim(),
            image: imageUrl,
            status,
            organizer_id,
          },
        ],
        { session },
      );

      await session.commitTransaction();

      return res.status(201).json({
        success: true,
        message: "Event created successfully",
        data: event[0],
      });
    } catch (error) {
      await session.abortTransaction();

      console.error("CREATE EVENT ERROR:", error);

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
      const { ticketTypeId } = req.body;

      // 1. Validate event ID
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid event ID",
        });
      }

      // 2. Validate ticket type ID
      if (!ticketTypeId) {
        return res.status(400).json({
          success: false,
          message: "Ticket type ID is required",
        });
      }

      if (!mongoose.isValidObjectId(ticketTypeId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket type ID",
        });
      }

      // 3. Confirm a file was uploaded
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please upload a CSV file using the 'ticket' field",
        });
      }

      // 4. Validate file extension
      if (!req.file.originalname.toLowerCase().endsWith(".csv")) {
        return res.status(400).json({
          success: false,
          message: "Only CSV files are allowed",
        });
      }

      // 5. Find the event
      const event = await Event.findById(id);

      if (!event) {
        return res.status(404).json({
          success: false,
          message: "Event not found",
        });
      }

      // 6. Find the ticket type and verify it belongs to this event
      const ticketType = await TicketType.findOne({
        _id: ticketTypeId,
        event_id: event._id,
      });

      if (!ticketType) {
        return res.status(404).json({
          success: false,
          message: "Ticket type not found for this event",
        });
      }

      // 7. Parse the CSV
      const rows = await new Promise((resolve, reject) => {
        const results = [];

        Readable.from(req.file.buffer)
          .pipe(
            csvParser({
              mapHeaders: ({ header }) => header.trim().toLowerCase(),
            }),
          )
          .on("data", (row) => results.push(row))
          .on("end", () => resolve(results))
          .on("error", reject);
      });

      if (rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "The CSV file is empty",
        });
      }

      // 8. Extract and validate ticket codes
      const uniqueCodes = new Set();
      const duplicateInFile = new Set();
      const invalidRows = [];

      for (const [index, row] of rows.entries()) {
        const code = row.code?.trim();

        if (!code) {
          invalidRows.push(index + 2);
          continue;
        }

        if (uniqueCodes.has(code)) {
          duplicateInFile.add(code);
          continue;
        }

        uniqueCodes.add(code);
      }

      if (invalidRows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Some CSV rows are missing a ticket code",
          invalidRows,
        });
      }

      const codes = [...uniqueCodes];

      if (codes.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No valid ticket codes found",
        });
      }

      // 9. Find codes already registered for this event
      const existingTickets = await TicketCode.find({
        event_id: event._id,
        code_string: { $in: codes },
      })
        .select("code_string")
        .lean();

      const existingCodes = new Set(
        existingTickets.map((ticket) => ticket.code_string),
      );

      const newCodes = codes.filter((code) => !existingCodes.has(code));

      if (newCodes.length === 0) {
        return res.status(409).json({
          success: false,
          message: "All uploaded ticket codes already exist for this event",
          uploaded: codes.length,
          inserted: 0,
          duplicatesInFile: [...duplicateInFile],
          alreadyExists: [...existingCodes],
        });
      }

      // 10. Prepare documents
      const ticketDocuments = newCodes.map((code) => ({
        code_string: code,
        event_id: event._id,
        ticket_type_id: ticketType._id,
        source: "CSV",
      }));

      // 11. Insert using a transaction
      session.startTransaction();

      await TicketCode.insertMany(ticketDocuments, {
        session,
        ordered: true,
      });

      await session.commitTransaction();

      // 12. Return result
      return res.status(201).json({
        success: true,
        message: "Ticket codes uploaded successfully",
        eventId: event._id,
        ticketTypeId: ticketType._id,
        ticketType: ticketType.name,
        totalRows: rows.length,
        inserted: newCodes.length,
        duplicatesInFile: [...duplicateInFile],
        alreadyExists: [...existingCodes],
      });
    } catch (error) {
      if (session.inTransaction()) {
        await session.abortTransaction();
      }

      console.error("Bulk ticket upload error:", error);

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
      session.startTransaction();
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(404).json({
          success: false,
          message: "Invalid event Id",
        });
      }

      const event = await Event.findById(id).session(session);

      if (!event) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          message: "Event not found",
        });
      }
      const bulkTicket = await TicketCode.deleteMany(
        { event_id: id },
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

      return res.status(201).json({
        success: true,
        message: "Bulk ticket codes deleted successfully",
        deleted: bulkTicket.deletedCount,
      });
    } catch (error) {
      await session.abortTransaction();
      res.status(500).json({
        success: false,
        message: "Error bulk deleting ticket codes",
        error: error.message,
      });
    } finally {
      session.endSession();
    }
  }
}
export default new EventController();
