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

router.post('/', eventController.createEvent);

router.post('/:id/codes', upload.single("file"), eventController.uploadCodes);

export default router;
