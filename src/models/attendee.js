import mongoose from "mongoose";

const attendeeSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
  },
);

const Attendee = mongoose.model("Attendee", attendeeSchema);
export default Attendee;
