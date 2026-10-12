import express from "express";

import ticketTypeController from "../controllers/ticketType.js";

const router = express.Router();

// Get one ticket type
router.post("/:id", ticketTypeController.createTicketType);

router.get("/:id", ticketTypeController.getTicketTypeById);
router.get("/event/:id", ticketTypeController.getEventTicketTypes);

// Update ticket type
router.put("/:id", ticketTypeController.updateTicketType);

// Delete ticket type
router.delete("/:id", ticketTypeController.deleteTicketType);

export default router;
