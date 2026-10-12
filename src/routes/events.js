// import express from "express";
// import multer from "multer";
// import eventController from "../controllers/event.js";
// const router = express.Router();
// const upload = multer({
//   dest: "uploads/",
//   storage: multer.memoryStorage(),
//   limits: {
//     filesize: 5 * 1024 * 1024,
//   },
// });

// // EVENT ENDPOINTS
// router.post("/", eventController.createEvent);
// router.get("/", eventController.getAllEvents);
// router.get("/:id", eventController.getEventById);
// router.put("/:id", eventController.updateEvent);
// router.delete("/:id", eventController.deleteEvent);

// export default router;

import express from "express";
import eventController from "../controllers/event.js";
import ticketTypeController from "../controllers/ticketType.js";
import upload from "../config/multer.js";
const router = express.Router();

// EVENT ENDPOINTS
router.post("/", upload.single("image"), eventController.createEvent);
router.get("/", eventController.getAllEvents);

router.post("/:id/ticket-types", ticketTypeController.createTicketType);

router.get("/:id/ticket-types", ticketTypeController.getEventTicketTypes);

// SINGLE EVENT ENDPOINTS
router.get("/:id", eventController.getEventById);
router.put("/:id", eventController.updateEvent);
router.delete("/:id", eventController.deleteEvent);

// EVENT TICKET ENDPOINTS
router.get("/:id/codes", eventController.getEventTickets);
router.delete("/:id/codes", eventController.bulkDeleteTickets);
router.post(
  "/:id/codes",
  upload.single("ticket"),
  eventController.batchUploadTickets,
);

export default router;
