import mongoose from "mongoose";

const ticketTypeSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Ticket type name is required"],
            trim: true
        },

        description: {
            type: String,
            trim: true,
            default: ""
        },

        event_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Event",
            required: [true, "Event ID is required"]
        },

        price: {
            type: Number,
            required: [true, "Ticket price is required"],
            min: [0, "Ticket price cannot be negative"]
        },

        quantity: {
            type: Number,
            required: [true, "Ticket quantity is required"],
            min: [1, "Ticket quantity must be at least 1"]
        },

        sold: {
            type: Number,
            default: 0,
            min: 0
        },

        salesStart: {
            type: Date,
            default: null
        },

        salesEnd: {
            type: Date,
            default: null
        },

        status: {
            type: String,
            enum: ["active", "inactive", "sold_out"],
            default: "active"
        }
    },
    {
        timestamps: true
    }
);

ticketTypeSchema.index(
    { event_id: 1, name: 1 },
    { unique: true }
);

export default mongoose.model(
    "TicketType",
    ticketTypeSchema
);
