import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import { sendVerificationEmail } from '../config/mail.js';

// 📝 1. POST: Handles the user Registeration
export const registerUser = async (req, res) => {
    try {
        const { name, email, password, confirmPassword, role } = req.body;

        if (!name || !email || !password || !confirmPassword || !role) {
            return res.status(400).json({ error: "All profile registration fields are required." });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ error: "Passwords do not match. Check confirmation parameter." });
        }

        if (role !== 'organizer' && role !== 'staff') {
            return res.status(400).json({ error: "Invalid role selection. Must match screen choices." });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "An account with this email address already exists." });
        }

        // Generate clean random digits and hash credentials
        const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Account is staged as unverified (isVerified: false)
        const newUser = new User({ 
            name, 
            email, 
            password: hashedPassword, 
            role,
            verificationCode: randomCode,
            isVerified: false 
        });
        
        await newUser.save();

        // Dispatch background verification email
        try {
            await sendVerificationEmail(newUser.email, newUser.name, randomCode);
        } catch (mailError) {
            console.log("⚠️ Background mailer transport rejected request, but profile saved safely.");
        }

        // 🔑 Mint short-lived token so backend recognizes who is typing code 
        const tempToken = jwt.sign(
            { id: newUser._id },
            process.env.JWT_SECRET,
            { expiresIn: '15m' } 
        );

        return res.status(201).json({
            message: "Account staged! Redirecting to 6-digit email verification screen...",
            tempToken 
        });

    } catch (error) {
        return res.status(500).json({ error: "Internal registration pipeline error." });
    }
};

// 🔢 2. POST: Handles typing the 6 digits code
export const verifyAccountCode = async (req, res) => {
    try {
        const { code } = req.body;
        const authHeader = req.headers.authorization;

        if (!code) {
            return res.status(400).json({ error: "Please enter the 6-digit verification code." });
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: "Verification context missing. Restart your sign-up sequence." });
        }

        const tempToken = authHeader.split(' ')[1];

        try {
            // Unpack temporary context token to reveal user profile ID
            const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
            
            const user = await User.findById(decoded.id);
            if (!user) {
                return res.status(404).json({ error: "User profile record not found." });
            }

            // Verify if digits typed in Postman match our database entry
            if (user.verificationCode !== code.trim()) {
                return res.status(400).json({ error: "Incorrect verification code. Please check your inbox details." });
            }

            // SUCCESS! Turn account status to active and erase temporary code
            user.isVerified = true;
            user.verificationCode = null; 
            await user.save();

            return res.status(200).json({
                message: "Email successfully verified! Your account is active. Redirecting to login view..."
            });

        } catch (jwtError) {
            return res.status(401).json({ error: "Verification session expired. Please register again." });
        }

    } catch (error) {
        return res.status(500).json({ error: "Internal verification processing error." });
    }
};

// 🔐 3. POST: Handles the standard "Log In" view
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password fields cannot be left blank." });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password credentials." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch === false) {
            return res.status(401).json({ error: "Invalid email or password credentials." });
        }

        // HARD LOCK ENFORCEMENT: Block login attempts if Screen 3 was bypassed!
        if (user.isVerified === false) {
            return res.status(403).json({ error: "Account unverified. Please complete your 6-digit email confirmation sequence first." });
        }

        // Issue permanent 24-hour access badge token carrying role permissions claims
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(200).json({
            message: "Welcome back! Login successful.",
            token,
            user: { id: user._id, name: user.name, role: user.role }
        });

    } catch (error) {
        return res.status(500).json({ error: "Internal server authentication error." });
    }
};


