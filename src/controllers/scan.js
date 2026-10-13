import mongoose from 'mongoose';
import Ticket from '../models/ticket.js';
import Scan from '../models/scan.js';
import { checkInTicket } from './scanController.js';

export const validateTicket = async (req, res) => {
    try {
        const { qr_token, event_id, gate_label } = req.body;

        // 1. Check that the required data was provided
        if (!qr_token || !event_id) {
            return res.status(400).json({
                status: 'invalid',
                message: 'QR token and event ID are required'
            });
        }

        // 2. Identify who is scanning
        const scannedBy =
            req.user?._id ||
            req.user?.id ||
            (process.env.NODE_ENV !== 'production'
                ? req.body.scanned_by
                : undefined);

        if (!mongoose.isValidObjectId(scannedBy)) {
            return res.status(401).json({
                status: 'unauthorized',
                message: 'Staff login required'
            });
        }

        // 3. Get the gate name
        const gate =
            typeof gate_label === 'string' && gate_label.trim()
                ? gate_label.trim()
                : 'Main Gate';

        // 4. Find the ticket using the QR token
        const ticket = await Ticket.findOne({ qr_token });

        // 5. QR token doesn't exist
        if (!ticket) {
            await Scan.create({
                ticket_id: null,
                event_id,
                scanned_by: scannedBy,
                scan_result: 'invalid',
                gate_label: gate
            });

            return res.status(404).json({
                status: 'invalid',
                message: 'Invalid QR token'
            });
        }

        // 6. Ticket exists, but belongs to another event
        if (ticket.event_id.toString() !== event_id) {
            await Scan.create({
                ticket_id: ticket._id,
                event_id,
                scanned_by: scannedBy,
                scan_result: 'wrong-event',
                gate_label: gate
            });

            return res.status(400).json({
                status: 'wrong-event',
                message: 'Ticket does not belong to this event'
            });
        }

        // Valid ticket
        // checkInTicket handles check-in,
        // marking the ticket as used, and duplicate scans.
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