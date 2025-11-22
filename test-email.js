const nodemailer = require('nodemailer');

// Load environment variables
require('dotenv').config();

async function testEmail() {
  console.log('Testing email configuration...');

  // Create a transporter using Outlook/Outlook365 SMTP
  const transporter = nodemailer.createTransport({
    service: 'outlook',
    auth: {
      user: process.env.EMAIL_USER || 'info@baytech-uae.com',
      pass: process.env.EMAIL_PASS || 'Info2025@',
    }
  });

  // Email content
  const mailOptions = {
    from: process.env.EMAIL_USER || 'info@baytech-uae.com',
    to: 'shahnawazpathan556@gmail.com',
    subject: 'Test Email - Baytech ERP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; padding: 20px 0;">
          <h2 style="color: #333;">Baytech ERP Test Email</h2>
        </div>
        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p>Hello,</p>
          <p>This is a test email to verify that the email functionality is working properly.</p>
          <p>If you received this email, your Outlook SMTP configuration is working correctly!</p>
        </div>
        <div style="text-align: center; padding: 20px 0; color: #777; font-size: 14px;">
          <p>&copy; 2025 Baytech UAE. All rights reserved.</p>
        </div>
      </div>
    `
  };

  try {
    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
  } catch (error) {
    console.error('Error sending email:', error);
    
    // More specific error handling
    if (error.code === 'EAUTH') {
      console.error('Authentication failed. Please check your email and password/App Password.');
      console.error('For Outlook accounts with 2FA enabled, you need to use an App Password.');
    } else if (error.code === 'EENVELOPE') {
      console.error('Envelope rejected. Check your sender and recipient addresses.');
    } else if (error.code === 'EDNS') {
      console.error('DNS lookup failed. Check your network connection.');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('Connection timed out. Check your network and firewall settings.');
    } else {
      console.error('Other error:', error.message);
    }
  }
}

// Run the test
testEmail();