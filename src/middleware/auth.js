import jwt from 'jsonwebtoken';

// 🛑 Enforces constraints so ONLY Logged-in/Authenticated user profiles can access the path
export const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Access denied. Token missing or malformed." });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Injects { id, role } parameter data directly into the next request stream
        next();
    } catch (error) {
        return res.status(401).json({ error: "Authentication failed. Token is invalid or expired." });
    }
};

// 🛑 Enforces constraints so ONLY organiser profiles can access the path
export const requireOrganizer = (req, res, next) => {
    if (!req.user || req.user.role !== 'organizer') {
        return res.status(403).json({ error: "Access forbidden. Organizer computational clearance status required." });
    }
    next();
};

// 🛑 Enforces constraints so ONLY Staff profiles can access the path
export const requireStaff = (req, res, next) => {
    if (!req.user || req.user.role !== 'staff') {
        return res.status(403).json({ error: "Access forbidden. Staff operational clearance required." });
    }
    next();
};

