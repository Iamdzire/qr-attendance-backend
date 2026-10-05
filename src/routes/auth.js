import express from 'express';
import { registerUser, loginUser, verifyAccountCode, resendVerificationCode } from '../controllers/user.js';

const router = express.Router();

router.post('/register', registerUser);         
router.post('/verify-code', verifyAccountCode);
router.post('/resend-code', resendVerificationCode)   
router.post('/login', loginUser);               

export default router;
