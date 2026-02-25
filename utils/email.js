import nodemailer from 'nodemailer';
import pug from 'pug';
import { convert } from 'html-to-text';

// import { fileURLToPath } from 'node:url';
import path from 'node:path';

// const __dirname = path.dirname(fileURLToPath(import.meta.url));

class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `DasaJayaMotor <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      return nodemailer.createTransport({
        host: process.env.BREVO_HOST,
        port: process.env.BREVO_PORT,
        auth: {
          user: process.env.BREVO_LOGIN,
          pass: process.env.BREVO_PASSWORD,
        },
      });
    }
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  async send(template, subject) {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6;">

  <p>Hi ${this.firstName},</p>

  <p>
    Kami menerima permintaan anda untuk lupa password,
    klik tombol berikut untuk me-reset password anda:
  </p>

  <table role="presentation" border="0" cellpadding="0" cellspacing="0">
    <tbody>
      <tr>
        <td align="left">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tbody>
              <tr>
                <td style="background-color: #007bff; padding: 10px 18px; border-radius: 4px;">
                  <a href="${this.url}"
                     target="_blank"
                     style="color: #ffffff; text-decoration: none; font-weight: bold;">
                    Reset Password Anda
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tbody>
  </table>

  <p>
    Jika anda tidak melakukan lupa password,
    tolong abaikan email ini!
  </p>

</body>
</html>
`;

    const mailOptions = {
      from: this.from,
      to: this.to,
      subject: subject,
      html,
      text: convert(html, {
        wordwrap: false,
      }),
    };

    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to the Natours family!');
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      'Link token lupa password anda (valid hanya 10 menit)'
    );
  }
}

export default Email;
