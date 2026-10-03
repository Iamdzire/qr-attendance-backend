import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
    name: { type: String, required: [true, "Name is required"], trim: true },
    email: { type: String, required: [true, "Email is required"], unique: true, lowercase: true, trim: true },
    password: { type: String, required: [true, "Password is required"] },
    role: { type: String, enum: ['organizer', 'staff'], required: [true, "Role is required"] }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
