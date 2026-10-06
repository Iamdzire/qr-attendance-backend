import express from 'express';
import eventController from "../controllers/event.js";

import upload from '../config/multer.js'
const router = express.Router();


// EVENT ENDPOINTS
router.post('/', upload.single("image"), eventController.createEvent);
router.get('/', eventController.getAllEvents);
router.get('/:id', eventController.getEventById);
router.put('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

// EVENT TICKET ENDPOINTS
router.get('/:id/codes', eventController.getEventTickets);
router.delete('/:id/codes', eventController.bulkDeleteTickets);
router.post('/:id/codes', upload.single("ticket"), eventController.batchUploadTickets);

export default router;
