import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
  {
    code_string: { type: String, required: true },
    event_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    ticket_type_id: {
<<<<<<< HEAD
      type: mongoose.Schema.Types.ObjectId,
      ref: "TicketType",
      required: true,
    },
=======
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TicketType',
        required: [true, "Ticket Type ID is required"]
    },
    status: { type: String, enum: ['unused', 'used'], default: 'unused' },
    source: { type: String, enum: ['CSV', 'manual'], default: 'manual' },
    qr_token: { type: String, default: null } 
}, { timestamps: true });
>>>>>>> b911b38580b4ea065d134256caf6e6af94b4526e
    attendee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendee",
      default: null,
    },
    status: { type: String, enum: ["unused", "used"], default: "unused" },
    source: { type: String, enum: ["CSV", "manual"], default: "manual" },
    qr_token: { type: String, default: null },
  },
  { timestamps: true },
);

// prevents duplicate ticket codes within the same event
ticketSchema.index({ code_string: 1, event_id: 1 }, { unique: true });

// help mongoDB find available codes for a selected category
ticketSchema.index({
  event_id: 1,
  ticket_type_id: 1,
  status: 1,
  attendee_id: 1,
});
export default mongoose.model("Ticket", ticketSchema);
