import express from 'express';
import multer from "multer";
import eventController from "../controllers/event.js";
const router = express.Router();
const upload = multer({ 
    dest: 'uploads/',
    storage: multer.memoryStorage(),
    limits: {
        filesize: 5 * 1024 * 1024 ,
    } 
});

// EVENT ENDPOINTS
router.post('/', eventController.createEvent);
router.get('/', eventController.getAllEvents);
router.get('/:id', eventController.getEventById);
router.put('/:id', eventController.updateEvent);
router.delete('/:id', eventController.deleteEvent);

export default router;
