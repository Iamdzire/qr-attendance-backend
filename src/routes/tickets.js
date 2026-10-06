import express from 'express';
const router = express.Router();

// TICKET ENDPOINTS
// this is a bulk delete tickets endpoint
router.get('/', (req, res) => res.send({
    message: "This is a dummy data"
}));

export default router;
