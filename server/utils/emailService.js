const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const sendOTPEmail = async (email, otp, type) => {
  const subject = type === 'email_verify' ? 'Verify your NumberFree account' : 'New device login - NumberFree';
  const message = type === 'email_verify' ? 'Welcome to NumberFree! Your verification code is:' : 'New device login detected. Your OTP is:';

  await transporter.sendMail({
    from: '"NumberFree" <' + process.env.EMAIL_USER + '>',
    to: email,
    subject,
    html: '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#f0fdf4;padding:32px;border-radius:16px;"><h1 style="color:#16a34a;text-align:center;">NumberFree</h1><div style="background:white;border-radius:12px;padding:24px;text-align:center;"><p>' + message + '</p><div style="background:#f0fdf4;border:2px dashed #16a34a;border-radius:12px;padding:20px;margin:20px 0;"><h2 style="color:#16a34a;font-size:42px;letter-spacing:12px;margin:0;">' + otp + '</h2></div><p style="color:#9ca3af;">Expires in 10 minutes</p></div></div>'
  });
};

module.exports = { generateOTP, sendOTPEmail };
