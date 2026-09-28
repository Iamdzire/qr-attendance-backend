import 'dotenv/config'; // Loads your environment variables automatically
import express from 'express';
import cors from 'cors';
import connectDB from './src/config/db.js'; // Notice the mandatory '.js' extension

// Import your feature routers
import authRouter from './src/routes/auth.js';
import eventsRouter from './src/routes/events.js';
import ticketsRouter from './src/routes/tickets.js';
import scansRouter from './src/routes/scans.js';

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json());

// Boot up MongoDB
connectDB();

// 🔗 DIRECT ROUTE PRE-LINKING
app.use('/auth', authRouter);       
app.use('/events', eventsRouter);   
app.use('/tickets', ticketsRouter); 
app.use('/scans', scansRouter);     

// Base landing check
app.get('/', (req, res) => {
    res.json({ message: "Core Server Boilerplate is Online using ES Modules!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Startup framework active on port ${PORT}`);
});
