import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    firstName: {type: String, required: true, trim: true},
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: function() { return !this.googleId; } }, 
    role: { type: String, enum: ['organizer', 'staff'], required: true },
    verificationCode: { type: String, default: null }, 
    isVerified: { type: Boolean, default: false },
    
    // 🔑 Added for the Forgot Password 6-Digit Box loop
    resetCode: { type: String, default: null },
    resetCodeExpires: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
