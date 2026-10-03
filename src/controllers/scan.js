import mongoose from 'mongoose';
import Ticket from '../models/ticket.js';
import { checkInTicket } from './scanController.js';

export const validateTicket = async (req, res) => {
    try {
        const { qr_token, event_id, gate_label } = req.body;

        // Check that the required data was provided
        if (!qr_token || !event_id) {
            return res.status(400).json({
                status: 'invalid',
                message: 'QR token and event ID are required'
            });
        }

        // Find the ticket using the QR token
        const ticket = await Ticket.findOne({ qr_token });

        // QR token doesn't exist
        if (!ticket) {
            return res.status(404).json({
                status: 'invalid',
                message: 'Invalid QR token'
            });
        }

        // Make sure the ticket belongs to this event
        if (ticket.event_id.toString() !== event_id) {
            return res.status(400).json({
                status: 'wrong-event',
                message: 'Ticket does not belong to this event'
            });
        }

        // Who is scanning? Real login wins; testing fallback outside production.
        const scannedBy =
            req.user?._id ||
            req.user?.id ||
            (process.env.NODE_ENV !== 'production' ? req.body.scanned_by : undefined);

        if (!mongoose.isValidObjectId(scannedBy)) {
            return res.status(401).json({
                status: 'unauthorized',
                message: 'Staff login required'
            });
        }

        const gate =
            typeof gate_label === 'string' && gate_label.trim()
                ? gate_label.trim()
                : undefined;

        // Fraud prevention: atomically marks unused to used, or returns duplicate.
        const result = await checkInTicket({
            ticket,
            event_id,
            scannedBy,
            gate
        });

        return res.status(result.statusCode).json(result.body);

    } catch (error) {
        console.error('Ticket validation error:', error);

        return res.status(500).json({
            status: 'invalid',
            message: 'Server error while validating ticket'
        });
    }
};