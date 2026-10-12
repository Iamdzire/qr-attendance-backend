import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    code_string: { type: String, required: true },
    event_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },

    attendee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendee",
      required: true,
    },

    ticket_type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TicketType",
      required: [true, "Ticket Type ID is required"],
    },
    status: { type: String, enum: ["unused", "used"], default: "unused" },
    source: { type: String, enum: ["CSV", "manual"], default: "manual" },
    qr_token: { type: String, default: null },
  },
  { timestamps: true },
);

// Strictly prevents identical codes being registered twice within the same event
ticketSchema.index({ code_string: 1, event_id: 1 }, { unique: true });

export default mongoose.model("Ticket", ticketSchema);
