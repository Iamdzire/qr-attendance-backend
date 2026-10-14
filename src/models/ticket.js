import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema(
    {
        code_string: {
            type: String,
            required: [true, 'Ticket code is required'],
            trim: true
        },

        event_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Event',
            required: [true, 'Event ID is required']
        },

        ticket_type: {
            type: String,
            enum: {
                values: ['Regular', 'VIP', 'VVIP', 'Premium'],
                message: 'Invalid ticket type'
            },
            required: [true, 'Ticket type is required'],
            trim: true
        },

        status: {
            type: String,
            enum: ['unused', 'used'],
            default: 'unused'
        },

        source: {
            type: String,
            enum: ['CSV', 'manual'],
            default: 'manual'
        },

        qr_token: {
            type: String,
            default: null
        }
    },
<<<<<<< HEAD
    ticket_type_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TicketType',
        required: [true, "Ticket Type ID is required"]
    },
    attendee_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendee",
      default: null,
    },
    status: { type: String, enum: ['unused', 'used'], default: 'unused' },
    source: { type: String, enum: ['CSV', 'manual'], default: 'manual' },
    qr_token: { type: String, default: null } 
}, { timestamps: true });
    
=======
    {
        timestamps: true
    }
);
>>>>>>> 563c87219a99fbe4e44cd2af1462d093d63627b2

ticketSchema.index(
    { code_string: 1, event_id: 1 },
    { unique: true }
);

export default mongoose.model('Ticket', ticketSchema);

