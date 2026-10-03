import express from 'express';
import multer from "multer";
import ticketController from "../controllers/ticket.js";
const router = express.Router();
const upload = multer({ 
    dest: 'uploads/',
    storage: multer.memoryStorage(),
    limits: {
        filesize: 5 * 1024 * 1024 ,
    } 
});

// TICKET ENDPOINTS
// this is a bulk delete tickets endpoint
router.delete('/:id/codes', ticketController.bulkDeleteTickets);
router.post('/:id/codes', upload.single("file"), ticketController.batchUploadTickets);

export default router;
