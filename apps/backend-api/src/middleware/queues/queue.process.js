

// import the queue
const queue = require("./queues");
// import the email service ...
const { EmailService } = require("../../services/emailService");
// since we'd always call the email service from here , we decide to instantiate it here
const emailService = new EmailService();
