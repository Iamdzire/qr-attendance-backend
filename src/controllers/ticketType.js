import mongoose from "mongoose";
import Event from "../models/event.js";
import TicketType from "../models/ticketType.js";
import TicketCode from "../models/ticket.js";

class TicketTypeController {
  // CREATE TICKET TYPE
  async createTicketType(req, res) {
    try {
      const { id } = req.params;

      const { name, description, price, quantity, salesStart, salesEnd } =
        req.body;

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

      if (!name || price === undefined || quantity === undefined) {
        return res.status(400).json({
          success: false,
          message: "Name, price and quantity are required",
        });
      }

      if (!Number.isFinite(Number(price)) || Number(price) < 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be a non-negative number",
        });
      }

      if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be a positive integer",
        });
      }

      const existingType = await TicketType.findOne({
        event_id: id,
        name: name.trim(),
      });

      if (existingType) {
        return res.status(409).json({
          success: false,
          message: "This ticket type already exists for the event",
        });
      }

      const ticketType = await TicketType.create({
        name: name.trim(),
        description,
        event_id: id,
        price: Number(price),
        quantity: Number(quantity),
        salesStart: salesStart || null,
        salesEnd: salesEnd || null,
      });

      return res.status(201).json({
        success: true,
        message: "Ticket type created successfully",
        data: ticketType,
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "This ticket type already exists for the event",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to create ticket type",
        error: error.message,
      });
    }
  }

  // GET ALL TICKET TYPES FOR AN EVENT
  async getEventTicketTypes(req, res) {
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

      const ticketTypes = await TicketType.find({
        event_id: id,
      }).sort({ price: 1 });

      return res.status(200).json({
        success: true,
        count: ticketTypes.length,
        data: ticketTypes,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve ticket types",
        error: error.message,
      });
    }
  }

  // GET ONE TICKET TYPE
  async getTicketTypeById(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket type ID",
        });
      }

      const ticketType = await TicketType.findById(id);

      if (!ticketType) {
        return res.status(404).json({
          success: false,
          message: "Ticket type not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: ticketType,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }

  // UPDATE TICKET TYPE
  async updateTicketType(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket type ID",
        });
      }

      const ticketType = await TicketType.findById(id);

      if (!ticketType) {
        return res.status(404).json({
          success: false,
          message: "Ticket type not found",
        });
      }

      const {
        name,
        description,
        price,
        quantity,
        salesStart,
        salesEnd,
        status,
      } = req.body;

      if (
        price !== undefined &&
        (!Number.isFinite(Number(price)) || Number(price) < 0)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket price",
        });
      }

      if (
        quantity !== undefined &&
        (!Number.isInteger(Number(quantity)) || Number(quantity) < 1)
      ) {
        return res.status(400).json({
          success: false,
          message: "Quantity must be a positive integer",
        });
      }

      const newQuantity =
        quantity === undefined ? ticketType.quantity : Number(quantity);

      if (newQuantity < ticketType.sold) {
        return res.status(400).json({
          success: false,
          message: "Quantity cannot be lower than the number of tickets sold",
        });
      }

      if (name !== undefined) {
        const duplicate = await TicketType.findOne({
          event_id: ticketType.event_id,
          name: name.trim(),
          _id: { $ne: ticketType._id },
        });

        if (duplicate) {
          return res.status(409).json({
            success: false,
            message: "This ticket type name already exists for the event",
          });
        }

        ticketType.name = name.trim();
      }

      if (description !== undefined) {
        ticketType.description = description;
      }

      if (price !== undefined) {
        ticketType.price = Number(price);
      }

      if (quantity !== undefined) {
        ticketType.quantity = Number(quantity);
      }

      if (salesStart !== undefined) {
        ticketType.salesStart = salesStart || null;
      }

      if (salesEnd !== undefined) {
        ticketType.salesEnd = salesEnd || null;
      }

      if (status !== undefined) {
        if (!["active", "inactive", "sold_out"].includes(status)) {
          return res.status(400).json({
            success: false,
            message: "Invalid ticket type status",
          });
        }

        ticketType.status = status;
      }

      await ticketType.save();

      return res.status(200).json({
        success: true,
        message: "Ticket type updated successfully",
        data: ticketType,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to update ticket type",
        error: error.message,
      });
    }
  }

  // DELETE TICKET TYPE
  async deleteTicketType(req, res) {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket type ID",
        });
      }

      const ticketType = await TicketType.findById(id);

      if (!ticketType) {
        return res.status(404).json({
          success: false,
          message: "Ticket type not found",
        });
      }

      const existingTickets = await TicketCode.exists({
        ticket_type_id: id,
      });

      if (existingTickets) {
        return res.status(409).json({
          success: false,
          message:
            "Cannot delete a ticket type that has ticket codes. Deactivate it instead.",
        });
      }

      await ticketType.deleteOne();

      return res.status(200).json({
        success: true,
        message: "Ticket type deleted successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete ticket type",
        error: error.message,
      });
    }
  }
}

export default new TicketTypeController();
