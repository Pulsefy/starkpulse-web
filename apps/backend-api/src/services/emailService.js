import * as Path from "node:path";
import mail_jet from "node-mailjet";
import * as fs from "node:fs";

// const nodemailer = require("nodemailer")
// const config = require('../config/environment')
require('dotenv').config();


class EmailService {

  constructor() {
    this.appName = "stark_plus web";
    this.appDefaultEmail = (process.env.STARK_PLUS_EMAIL).toString().trim();
    this.apiKey = (process.env.APi_KEY).toString().trim();
    this.apiSecretKey = (process.env.APi_SECRET_KEY).toString().trim();
    // this.emailSender = require('node-mailjet').apiConnect(this.apiKey, this.apiSecretKey);

    // instantiate the email
    this.emailSender = mail_jet.apiConnect(this.apiKey, this.apiSecretKey);
  }

  async sendEmail({templateName, templateBodyStructure}) {

    const htmlFile = this.templateReader(templateName, templateBodyStructure);

    return await this.emailSender.post("send", {version: 'v3.1'}).request({
      Messages: [
        {
          From: {
            Email: this.appDefaultEmail,
            Name: this.appName,
          },
          To: [
            {
              Email: templateBodyStructure.userEmail,
              Name: templateBodyStructure.firstName,
            },
          ],
          Subject: templateBodyStructure.subject,
          // TextPart: "this is the text part",
          HtmlPart: htmlFile,
        },
      ],
    });
  }

  templateReader(templateName, templateBodyStructure) {
    // locate the file
    let filePath = Path.join(__dirname, "../email_templates/", templateName );
    let htmlFile = fs.readFileSync(filePath, "utf8");

    // read the content of the file and directly insert the variables there
    for (const [key, value] of Object.entries(templateBodyStructure) ){
      // check for matches in the file and the key of templateBody
      htmlFile = htmlFile.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), value.toString());
    }

    return htmlFile;
  }
}

module.exports = EmailService;
