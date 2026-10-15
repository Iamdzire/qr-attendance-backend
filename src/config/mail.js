import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationEmail = async (
  userEmail,
  userName,
  sixDigitCode,
) => {
  await resend.emails.send({
    from: process.env.MAIL_FROM,
    to: userEmail,
    subject: "Your 6-Digit Account Verification Code",
    html: `
      <h2>Eventify Verification</h2>
      <p>Hello <strong>${userName}</strong>,</p>
      <p>Your verification code is:</p>
      <h1>${sixDigitCode}</h1>
    `,
  });
};

export const sendResetPasswordEmail = async (
  userEmail,
  userName,
  sixDigitCode,
) => {
  await resend.emails.send({
    from: process.env.MAIL_FROM,
    to: userEmail,
    subject: "🔒 Your Password Reset Code",
    html: `
      <h2>Eventify Verification</h2>
      <p>Hello <strong>${userName}</strong>,</p>
      <p>Your verification code is:</p>
      <h1>${sixDigitCode}</h1>
    `,
  });
};
