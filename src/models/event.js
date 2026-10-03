import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
    name: { type: String, required: [true, "Event name is required"], trim: true },
    date: { type: Date, required: [true, "Event date is required"] },
    venue: { type: String, required: [true, "Event venue is required"], trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    organizer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: [true, "Organizer ID is required"] }
}, { timestamps: true });

export default mongoose.model('Event', eventSchema);
