import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
    name: { type: String, required: [true, "Event name is required"], trim: true },
    description: {type: String, required: [true, "Event description is required"]},
    date: { type: Date, required: [true, "Event date is required"] },
    startAt: {type: String, required: [true, "Event start time is required"]},
    venue: { type: String, required: [true, "Event venue is required"], trim: true },
    image: {type: String, required: [true, "Event image is required"]},
    status: { type: String, enum: ["upcoming", "ongoing", "completed"], default: 'upcoming' },
    organizer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, "Organizer ID is required"] }
}, { timestamps: true });

export default mongoose.model('Event', eventSchema);
