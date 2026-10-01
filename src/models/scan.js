import mongoose from 'mongoose';

const scanSchema = new mongoose.Schema({
    ticket_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
    event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    scanned_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scan_result: { type: String, enum: ['valid', 'duplicate', 'invalid', 'wrong-event', 'pending-sync'], required: true },
    gate_label: { type: String, default: 'Main Gate' }
}, { timestamps: true });

export default mongoose.model('Scan', scanSchema);
