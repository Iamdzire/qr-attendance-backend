import express from 'express';
import { 
    registerUser, verifyAccountCode, resendVerificationCode, loginUser,
    forgotPassword, resendResetCode, verifyResetCode, confirmResetPassword, logoutUser 
} from '../controllers/user.js';

const router = express.Router();

// Signup & Authentication Routes
router.post('/register', registerUser);
router.post('/verify-code', verifyAccountCode);
router.post('/resend-code', resendVerificationCode);
router.post('/login', loginUser);

// Refactored Password Recovery Multi-Screen Routes
router.post('/forgot-password', forgotPassword);
router.post('/resend-reset-code', resendResetCode);
router.post('/verify-reset-code', verifyResetCode);         // Screen A: Checks digits only
router.post('/confirm-reset-password', confirmResetPassword); // Screen B: Sets new text password

// Session Closures
router.post('/logout', logoutUser);

export default router;
