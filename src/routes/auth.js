import express from 'express';
import { registerUser, loginUser, verifyAccountCode } from '../controllers/user.js';

const router = express.Router();

router.post('/register', registerUser);         
router.post('/verify-code', verifyAccountCode);    
router.post('/login', loginUser);               

export default router;
