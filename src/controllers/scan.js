import Ticket from '../models/ticket.js';
import Scan from '../models/scan.js';

export const validateTicket = async (req, res) => {
    try {
        const { qr_token, event_id } = req.body;
        //Make sure required data was provided
        if (!qr_token || !event_id) {
            return res.status(400).json({
                status: 'invalid',
                message: 'QR token and event ID are required'
            });
        }
        //Find the ticket using the QR token
        const ticket = await Ticket.findOne({ qr_token });
        //QR token does not belong to any ticket
        if (!ticket) {
            return res.status(404).json({
                status: 'invalid',
                message: 'Invalid QR token'
            });
        }
        //Check that the ticket belongs to the event being scanned
        if (ticket.event_id.toString() !== event_id) {
            return res.status(400).json({
                status: 'wrong-event',
                message: 'Ticket does not belong to this event'
            });
        }
        //Check whether the ticket has already been used
        if (ticket.status === 'used') {
            return res.status(409).json({
                status: 'duplicate',
                message: 'Ticket has already been used'
            });
        }
        //Ticket is valid and unused
        return res.status(200).json({
            status: 'valid',
            message: 'Ticket is valid',
            ticket_id: ticket._id,
            event_id: ticket.event_id
        });
    } catch (error) {
        console.error('Ticket validation error:', error);
        return res.status(500).json({
            status: 'invalid',
            message: 'Server error while validating ticket'
        });
    }
};