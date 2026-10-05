import express from 'express';
import { validateTicket } from '../controllers/scan.js';

import { getEventAttendance } from '../controllers/scanController.js';

const router = express.Router();

// Live dashboard attendance metrics for one event
// TODO: once auth middleware is ready (see src/middleware), protect this
// route so only the event's organizer can see it.
router.get('/events/:id/attendance', getEventAttendance);
router.post('/scan', validateTicket);

export default router;