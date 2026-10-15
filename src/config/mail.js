import { BrevoClient } from "@getbrevo/brevo";

// Initialize Brevo client
const apiKey = process.env.BREVO_API_KEY;
const fromEmail = process.env.BREVO_MAIL_FROM;

if (!apiKey) {
  throw new Error("BREVO_API_KEY is missing from your environment variables");
}

if (!fromEmail) {
  throw new Error("MAIL_FROM is missing from your environment variables");
}

const brevo = new BrevoClient({
  apiKey: apiKey,
});

export const sendVerificationEmail = async (
  userEmail,
  userName,
  sixDigitCode,
) => {
  if (!userEmail) {
    throw new Error("User email is required");
  }

  try {
    const response = await brevo.transactionalEmails.sendTransacEmail({
      sender: {
        name: "EVENTIFY",
        email: fromEmail,
      },
      to: [
        {
          email: userEmail,
          name: userName || "User",
        },
      ],
      subject: "Your 6-Digit Account Verification Code",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: auto;">
          <h2>Eventify Verification</h2>
          <p>Hello <strong>${userName || "User"}</strong>,</p>
          <p>Your verification code is:</p>
          <h1 style="color: #4F46E5; letter-spacing: 2px;">${sixDigitCode}</h1>
          <p>Thank you,<br>EVENTIFY</p>
        </div>
      `,
    });

    console.log("Verification email accepted by Brevo:", response?.messageId || response);
    return response;
  } catch (error) {
    console.error("Brevo verification email error:", error);
    throw new Error("Failed to send verification email");
  }
};

export const sendResetPasswordEmail = async (
  userEmail,
  userName,
  sixDigitCode,
) => {
  if (!userEmail) {
    throw new Error("User email is required");
  }

  try {
    const response = await brevo.transactionalEmails.sendTransacEmail({
      sender: {
        name: "EVENTIFY",
        email: fromEmail,
      },
      to: [
        {
          email: userEmail,
          name: userName || "User",
        },
      ],
      subject: "🔒 Your Password Reset Code",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 600px; margin: auto;">
          <h2>Eventify Password Reset</h2>
          <p>Hello <strong>${userName || "User"}</strong>,</p>
          <p>Your password reset code is:</p>
          <h1 style="color: #4F46E5; letter-spacing: 2px;">${sixDigitCode}</h1>
          <p>If you did not request a password reset, please ignore this email.</p>
          <p>Thank you,<br>EVENTIFY</p>
        </div>
      `,
    });

    console.log("Password reset email accepted by Brevo:", response?.messageId || response);
    return response;
  } catch (error) {
    console.error("Brevo password reset email error:", error);
    throw new Error("Failed to send password reset email");
  }
};
