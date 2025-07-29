const nodemailer = require("nodemailer");
const config = require("../../config/email");

const transporter = nodemailer.createTransport({
  service: config.service,
  auth: {
    user: config.user,
    pass: config.password,
  },
});

exports.sendVerificationEmail = async (user, token) => {
  const verificationUrl = `${config.baseUrl}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: '"StarkPulse" <no-reply@starkpulse.com>',
    to: user.email,
    subject: "Verify Your Email",
    html: `Click <a href="${verificationUrl}">here</a> to verify your email.`,
  });
};
