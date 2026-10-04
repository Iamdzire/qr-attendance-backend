import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: Number(process.env.MAIL_PORT) === 465, 
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD
    }
});

export const sendVerificationEmail = async (userEmail, userName, sixDigitCode) => {
    const mailOptions = {
        from: '"Group 13 Event System" <no-reply@group13events.com>',
        to: userEmail,
        subject: '🔢 Your 6-Digit Account Verification Code',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 25px; border: 1px solid #e2e8f0; max-width: 550px; border-radius: 8px; text-align: center; margin: 0 auto;">
                <h2 style="color: #2b6cb0; margin-bottom: 5px;">Eventify Verification Code</h2>
                <p style="color: #4a5568;">Hello <strong>${userName}</strong>,</p>
                <p style="color: #4a5568;">Use the code below inside your screen interface boxes to verify your profile:</p>
                
                <div style="background: #edf2f7; letter-spacing: 10px; font-size: 36px; font-weight: bold; color: #2b6cb0; padding: 15px; margin: 25px auto; max-width: 220px; border-radius: 8px; border: 2px dashed #cbd5e0; text-indent: 10px;">
                    ${sixDigitCode}
                </div>
                
                <p style="font-size: 11px; color: #718096; margin-top: 25px;">This registration security code is single-use and valid for 15 minutes.</p>
            </div>
        `
    };

    return transporter.sendMail(mailOptions);
};
