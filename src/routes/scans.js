import express from 'express';
import { validateTicket } from '../controllers/scan.js';

const router = express.Router();

router.post('/scan', validateTicket);

export default router;