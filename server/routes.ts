import dotenv from "dotenv";
dotenv.config();
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import SibApiV3Sdk from "sib-api-v3-sdk";
import { insertBookingSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import axios from "axios";
import nodemailer from "nodemailer";

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Initialize Brevo (Sendinblue) API
const brevoClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = brevoClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const transactionalEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

console.log("BREVO_API_KEY:", process.env.BREVO_API_KEY);

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Create a new booking and send email
  app.post("/api/bookings", async (req, res) => {
    try {
      // Validate booking data
      const validationResult = insertBookingSchema.safeParse(req.body);
      if (!validationResult.success) {
        const validationError = fromZodError(validationResult.error);
        return res.status(400).json({ 
          message: "Validation failed",
          error: validationError.toString()
        });
      }

      const bookingData = validationResult.data;
      // --- ADD THESE DEBUG LOGS ---
      console.log("--- DEBUGGING ADMIN CHECK ---");
      console.log("1. Header from Postman:", req.headers['x-admin-secret']);
      console.log("2. Secret on Server:", process.env.ADMIN_SECRET);
      console.log("3. Do they match?", req.headers['x-admin-secret'] === process.env.ADMIN_SECRET);
      // -----------------------------

      // 2. CHECK AVAILABILITY (New Logic)
      // This prevents double booking
      const conflictingBooking = await storage.checkAvailability(
        new Date(bookingData.checkIn), 
        new Date(bookingData.checkOut)
      );

      if (conflictingBooking) {
        // Format the dates nicely (e.g., "Feb 12, 2026")
        const blockedStart = new Date(conflictingBooking.checkIn).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
        });
        const blockedEnd = new Date(conflictingBooking.checkOut).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
        });

        return res.status(409).json({ 
          message: `Dates unavailable. The property is already booked from ${blockedStart} to ${blockedEnd}.` 
        });
      }

      // 3. CHECK FOR ADMIN BLOCKING (New Logic)
      // If the request has the correct 'x-admin-secret' header, block dates immediately
      
      const isAdmin = req.headers['x-admin-secret'] === process.env.ADMIN_SECRET;
      
      // Create booking in storage
      const booking = await storage.createBooking({
        ...bookingData,
        paymentStatus: isAdmin ? "blocked" : "pending",
      });
      
      // 4. IF ADMIN, SKIP PAYMENT & RETURN SUCCESS

      if (isAdmin) {
        console.log(`Dates blocked by Admin for ${bookingData.name}`);
        return res.json({ 
          bookingId: booking.id, 
          message: "Dates blocked successfully (Offline Booking)" 
        });
      }
      

      // Determine payment method (default to Paystack if not provided)
      const paymentMethod = req.body.paymentMethod || 'paystack';
      let paymentResponse = {};
      if (paymentMethod === 'paystack') {
        // Paystack Card Payment Integration
        try {
          const paystackConfig = {
            secretKey: process.env.PAYSTACK_SECRET_KEY,
            callbackUrl: process.env.PAYSTACK_CALLBACK_URL,
          };

          if (!paystackConfig.secretKey || !paystackConfig.callbackUrl) {
            console.error("Paystack config missing:", paystackConfig);
            return res.status(500).json({ message: 'Paystack configuration is incomplete. Please contact support.' });
          }

          // 1. Initiate Paystack transaction
          const amountKobo = Math.round(parseFloat(bookingData.totalAmount) * 100); // Paystack expects amount in kobo
          const paystackPayload = {
            email: bookingData.email,
            amount: amountKobo,
            callback_url: paystackConfig.callbackUrl,
            metadata: {
              bookingId: booking.id,
              name: bookingData.name,
              phone: bookingData.phone,
            }
          };

          let paystackRes;
          try {
            console.log("Paystack Init Request:", {
              url: "https://api.paystack.co/transaction/initialize",
              body: paystackPayload
            });
            paystackRes = await axios.post(
              "https://api.paystack.co/transaction/initialize",
              paystackPayload,
              {
                headers: {
                  Authorization: `Bearer ${paystackConfig.secretKey}`,
                  'Content-Type': 'application/json'
                }
              }
            );
            console.log("Paystack Init Response:", paystackRes.data);
          } catch (paystackError: any) {
            console.error("Paystack Init Error:", paystackError.response?.data || paystackError.message);
            return res.status(500).json({ message: 'Failed to initiate Paystack payment', details: paystackError.response?.data || paystackError.message });
          }

          if (!paystackRes.data || !paystackRes.data.data || !paystackRes.data.data.authorization_url) {
            console.error("Paystack response missing authorization_url:", paystackRes.data);
            return res.status(500).json({ message: 'Failed to get Paystack payment URL', details: paystackRes.data });
          }

          paymentResponse = { paymentUrl: paystackRes.data.data.authorization_url };
          await storage.updateBookingPaymentId(booking.id, paystackRes.data.data.reference);
        } catch (paystackError: any) {
          console.error("Paystack payment processing failed:", paystackError);
          return res.status(500).json({ message: 'Paystack payment processing failed', error: paystackError.message });
        }
      } else if (paymentMethod === 'mpesa') {
        // M-Pesa STK Push Integration (Safaricom Daraja API - Production)
        try {
          const mpesaConfig = {
            consumerKey: process.env.MPESA_CONSUMER_KEY,
            consumerSecret: process.env.MPESA_CONSUMER_SECRET,
            shortcode: process.env.MPESA_SHORTCODE,
            passkey: process.env.MPESA_PASSKEY,
            callbackUrl: process.env.MPESA_CALLBACK_URL,
          };

          // Validate M-Pesa configuration
          if (!mpesaConfig.consumerKey || !mpesaConfig.consumerSecret || 
              !mpesaConfig.shortcode || !mpesaConfig.passkey || !mpesaConfig.callbackUrl) {
            console.error("M-Pesa config missing:", mpesaConfig);
            return res.status(500).json({ 
              message: 'M-Pesa configuration is incomplete. Please contact support.' 
            });
          }

          // Determine if using production or sandbox
          const isProduction = process.env.MPESA_ENV === 'production';
          console.log('MPESA_ENV:', process.env.MPESA_ENV);
          console.log('isProduction:', isProduction);
          const baseUrl = isProduction 
            ? 'https://api.safaricom.co.ke' 
            : 'https://sandbox.safaricom.co.ke';
          console.log('Using M-Pesa URL:', baseUrl);

          // 1. Get OAuth token
          const auth = Buffer.from(`${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`).toString('base64');
          
          let tokenRes;
          try {
            console.log("M-Pesa OAuth Request:", {
              url: `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
              headers: { Authorization: `Basic ${auth}` }
            });
            tokenRes = await axios.get(
              `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
              { 
                headers: { 
                  Authorization: `Basic ${auth}`,
                  'Content-Type': 'application/json'
                } 
              }
            );
            console.log("M-Pesa OAuth Response:", tokenRes.data);
          } catch (tokenError: any) {
            console.error("M-Pesa OAuth Error:", tokenError.response?.data || tokenError.message, {
              url: `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`
            });
            return res.status(500).json({ 
              message: 'Failed to authenticate with M-Pesa',
              details: tokenError.response?.data || tokenError.message
            });
          }

          if (!tokenRes.data.access_token) {
            console.error("M-Pesa OAuth response missing access_token:", tokenRes.data);
            return res.status(500).json({ 
              message: 'Failed to get M-Pesa access token' 
            });
          }

          const accessToken = tokenRes.data.access_token;

          // 2. Prepare STK Push request
          const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
          const password = Buffer.from(`${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`).toString('base64');
          
          // Format phone number to 254XXXXXXXXX
          let phone = bookingData.phone.trim();
          phone = phone.replace(/^\+/, '').replace(/^0/, '254');
          if (!phone.startsWith('254')) {
            phone = '254' + phone;
          }

          const amount = Math.round(parseFloat(bookingData.totalAmount));

          const stkPayload = {
            BusinessShortCode: mpesaConfig.shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: phone,
            PartyB: mpesaConfig.shortcode,
            PhoneNumber: phone,
            CallBackURL: mpesaConfig.callbackUrl,
            // Use the same 4-character alphanumeric booking ID as frontend
            AccountReference: String(booking.id).replace(/[^a-zA-Z0-9]/g, '').substring(0, 4),
            TransactionDesc: `Booking for ${bookingData.name}`,
          };

          console.log('M-Pesa STK Push Request:', {
            url: `${baseUrl}/mpesa/stkpush/v1/processrequest`,
            headers: { Authorization: `Bearer ${accessToken}` },
            body: { ...stkPayload, Password: '***HIDDEN***', environment: isProduction ? 'production' : 'sandbox' }
          });

          // 3. Send STK Push
          let stkRes;
          try {
            stkRes = await axios.post(
              `${baseUrl}/mpesa/stkpush/v1/processrequest`,
              stkPayload,
              { 
                headers: { 
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                } 
              }
            );
            console.log('M-Pesa STK Push Response:', stkRes.data);
          } catch (stkError: any) {
            console.error("M-Pesa STK Push Error:", stkError.response?.data || stkError.message, {
              url: `${baseUrl}/mpesa/stkpush/v1/processrequest`,
              body: { ...stkPayload, Password: '***HIDDEN***' }
            });
            return res.status(500).json({ 
              message: 'Failed to initiate M-Pesa payment',
              details: stkError.response?.data || stkError.message
            });
          }

          // 4. Handle response
          if (stkRes.data.ResponseCode === "0") {
            paymentResponse = {
              mpesaInstructions: `A payment request has been sent to ${phone}. Please enter your M-Pesa PIN on your phone to complete the payment.`,
              mpesaCheckoutRequestID: stkRes.data.CheckoutRequestID,
            };
            await storage.updateBookingPaymentId(booking.id, stkRes.data.CheckoutRequestID);
          } else {
            console.error("M-Pesa STK Push failed:", stkRes.data);
            return res.status(500).json({ 
              message: 'Failed to initiate M-Pesa STK Push', 
              details: stkRes.data 
            });
          }
        } catch (mpesaError: any) {
          console.error("M-Pesa Integration Error:", mpesaError);
          return res.status(500).json({ 
            message: 'M-Pesa payment processing failed',
            error: mpesaError.message 
          });
        }
      } else {
        return res.status(400).json({ message: 'Unsupported payment method' });
      }

      // Send email notification to host
      const checkInDate = new Date(bookingData.checkIn).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const checkOutDate = new Date(bookingData.checkOut).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #C96846; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
            .booking-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
            .detail-label { font-weight: bold; color: #666; }
            .detail-value { color: #333; }
            .total { font-size: 24px; color: #C96846; font-weight: bold; text-align: right; margin-top: 15px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Booking Request</h1>
              <p>Legacy Holiday Home Diani</p>
            </div>
            <div class="content">
              <p>Hello Larry,</p>
              <p>You have received a new booking request for your villa!</p>
              
              <div class="booking-details">
                <h2 style="color: #C96846; margin-top: 0;">Guest Information</h2>
                <div class="detail-row">
                  <span class="detail-label">Name:</span>
                  <span class="detail-value"> ${bookingData.name}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Email:</span>
                  <span class="detail-value"> ${bookingData.email}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value"> ${bookingData.phone}</span>
                </div>
                
                <h2 style="color: #C96846; margin-top: 30px;">Stay Details</h2>
                <div class="detail-row">
                  <span class="detail-label">Check-in:</span>
                  <span class="detail-value"> ${checkInDate}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Check-out:</span>
                  <span class="detail-value"> ${checkOutDate}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Guests:</span>
                  <span class="detail-value"> ${bookingData.adults} ${bookingData.adults === 1 ? 'Adult' : 'Adults'}, ${bookingData.children} ${bookingData.children === 1 ? 'Child' : 'Children'}</span>
                </div>
                
                ${bookingData.specialRequirements ? `
                  <h2 style="color: #C96846; margin-top: 30px;">Special Requirements</h2>
                  <p style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    ${bookingData.specialRequirements}
                  </p>
                ` : ''}
                
                <div class="total">
                  Total: Ksh ${bookingData.totalAmount}
                </div>
              </div>
              
              <p style="margin-top: 30px;">
                <strong>Payment Status:</strong> Pending - Guest will complete payment shortly.
              </p>
              
              <p>Please reach out to the guest to confirm availability and discuss any special requirements.</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from Legacy Holiday Home Diani.</p>
            </div>
          </div>
        </body>
        </html>
      `;


      try {
        await transactionalEmailApi.sendTransacEmail({
          sender: { name: "Legacy Holiday Home Diani", email: "info@legacyholidayhome.co.ke" },
          to: [{ email: "larry.josephgithaka@gmail.com", name: "Larry" }],
          cc: [{ email: "bettirosengugi@gmail.com", name: "Bettirose" }],
          subject: `New Booking Request from ${bookingData.name}`,
          htmlContent: emailHtml,
        });
        console.log("Booking notification email sent successfully via Brevo");
      } catch (emailError: any) {
        console.error("Failed to send booking notification email via Brevo:", emailError.message);
        // Don't fail the booking if email fails, but log the error
      }

      res.json({
        bookingId: booking.id,
        ...paymentResponse,
      });
    } catch (error: any) {
      console.error("Booking error:", error);
      res.status(500).json({ 
        message: "Error creating booking",
        error: error.message 
      });
    }
  });

  // M-Pesa callback endpoint
  app.post("/api/mpesa-callback", async (req, res) => {
    console.log("M-Pesa Callback received:", JSON.stringify(req.body, null, 2));
    try {
      const { Body } = req.body;
      if (Body?.stkCallback) {
        const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = Body.stkCallback;
        if (ResultCode === 0) {
          // Payment successful
          console.log("M-Pesa payment successful:", CheckoutRequestID);
          const metadata = CallbackMetadata?.Item || [];
          const mpesaReceiptNumber = metadata.find((item: any) => item.Name === "MpesaReceiptNumber")?.Value;
          // Update booking payment status to paid
          const booking = await storage.getBookingByCheckoutId(CheckoutRequestID);
          if (booking) {
            await storage.updateBookingPaymentStatus(booking.id, "paid");
            // Prepare email HTML for receipt
            const checkInDate = new Date(booking.checkIn).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
            const checkOutDate = new Date(booking.checkOut).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });

            const receiptHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background-color: #C96846; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                  .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
                  .booking-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                  .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                  .detail-label { font-weight: bold; color: #666; }
                  .detail-value { color: #333; }
                  .total { font-size: 24px; color: #C96846; font-weight: bold; text-align: right; margin-top: 15px; }
                  .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
                  .success-badge { background-color: #10B981; color: white; padding: 10px 20px; border-radius: 5px; display: inline-block; margin: 20px 0; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Booking Confirmation & Receipt</h1>
                    <p>Legacy Holiday Home Diani</p>
                  </div>
                  <div class="content">
                    <div class="success-badge">Payment Confirmed</div>
                    
                    <p>Dear ${booking.name},</p>
                    <p>Thank you for your payment! Your booking at Legacy Holiday Home Diani has been confirmed.</p>
                    
                    <div class="booking-details">
                      <h2 style="color: #C96846; margin-top: 0;">Booking Details</h2>
                      <div class="detail-row">
                        <span class="detail-label">Booking ID:</span>
                        <span class="detail-value">${booking.id}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Guest Name:</span>
                        <span class="detail-value">${booking.name}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value">${booking.email}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Phone:</span>
                        <span class="detail-value">${booking.phone}</span>
                      </div>
                      
                      <h2 style="color: #C96846; margin-top: 30px;">Stay Details</h2>
                      <div class="detail-row">
                        <span class="detail-label">Check-in:</span>
                        <span class="detail-value">${checkInDate}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Check-out:</span>
                        <span class="detail-value">${checkOutDate}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Guests:</span>
                        <span class="detail-value">${booking.adults} ${booking.adults === 1 ? 'Adult' : 'Adults'}, ${booking.children} ${booking.children === 1 ? 'Child' : 'Children'}</span>
                      </div>
                      
                      ${booking.specialRequirements ? `
                        <h2 style="color: #C96846; margin-top: 30px;">Special Requirements</h2>
                        <p style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                          ${booking.specialRequirements}
                        </p>
                      ` : ''}
                      
                      <h2 style="color: #C96846; margin-top: 30px;">Payment Summary</h2>
                      <div class="detail-row">
                        <span class="detail-label">Payment Status:</span>
                        <span class="detail-value" style="color: #10B981; font-weight: bold;">PAID</span>
                      </div>
                      <div class="total">
                        Total Paid: Ksh ${booking.totalAmount}
                      </div>
                    </div>
                    
                    <p style="margin-top: 30px;">
                      Larry will be in touch soon to confirm your arrival details and answer any questions you may have.
                    </p>
                    
                    <p>
                      For any immediate questions, please contact:<br>
                      <strong>Phone:</strong> +254 714 389500<br>
                      <strong>Location:</strong> Diani Coast, Kenya
                    </p>
                    
                    <p>We look forward to welcoming you to Legacy Holiday Home Diani!</p>
                  </div>
                  <div class="footer">
                    <p>This is your official booking confirmation and payment receipt.</p>
                    <p>Legacy Holiday Home Diani - Your Luxury Escape Awaits</p>
                  </div>
                </div>
              </body>
              </html>
            `;

            // Host notification HTML
            const hostNotificationHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                  .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
                  .booking-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                  .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                  .detail-label { font-weight: bold; color: #666; }
                  .detail-value { color: #333; }
                  .total { font-size: 24px; color: #10B981; font-weight: bold; text-align: right; margin-top: 15px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>Payment Received</h1>
                    <p>Booking #${booking.id.substring(0, 8)}</p>
                  </div>
                  <div class="content">
                    <p>Hi Larry,</p>
                    <p>Great news! Payment has been received for the booking from ${booking.name}.</p>
                    <div class="booking-details">
                      <div class="detail-row">
                        <span class="detail-label">Guest:</span>
                        <span class="detail-value">${booking.name}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Check-in:</span>
                        <span class="detail-value">${checkInDate}</span>
                      </div>
                      <div class="detail-row">
                        <span class="detail-label">Check-out:</span>
                        <span class="detail-value">${checkOutDate}</span>
                      </div>
                      <div class="total">
                        Amount Received: Ksh ${booking.totalAmount}
                      </div>
                    </div>
                    <p>The guest has been sent a confirmation email with their receipt. Please reach out to confirm their arrival arrangements.</p>
                  </div>
                </div>
              </body>
              </html>
            `;

            // Send confirmation email to client
            try {
              const guestEmailPayload = {
                sender: { name: "Legacy Holiday Home Diani", email: "info@legacyholidayhome.co.ke" },
                to: [{ email: booking.email, name: booking.name }],
                subject: "Booking Confirmed - Legacy Holiday Home Diani",
                htmlContent: receiptHtml
              };
              await transactionalEmailApi.sendTransacEmail(guestEmailPayload);
              console.log("Receipt email sent to guest successfully via Brevo");
            } catch (emailError: any) {
              console.error("Failed to send receipt email:", emailError.response ? emailError.response.text : emailError.message);
            }
            // Send payment confirmation to host
            try {
              const hostEmailPayload = {
                sender: { name: "Legacy Holiday Home Diani", email: "info@legacyholidayhome.co.ke" },
                to: [{ email: "larry.josephgithaka@gmail.com", name: "Larry" }],
                cc: [{ email: "bettirosengugi@gmail.com", name: "Bettirose" }],
                subject: `Payment Received - ${booking.name}`,
                htmlContent: hostNotificationHtml
              };
              await transactionalEmailApi.sendTransacEmail(hostEmailPayload);
              console.log("Payment confirmation email sent to host successfully via Brevo");
            } catch (emailError: any) {
              console.error("Failed to send receipt email:", emailError.response ? emailError.response.text : emailError.message);
            }
          }
        } else {
          console.log("M-Pesa payment failed:", ResultDesc);
        }
      }
    } catch (error: any) {
      console.error("M-Pesa callback error:", error);
    }
    res.json({ ResultCode: 0, ResultDesc: "Success" });
  });

  // Paystack callback endpoint
  app.get("/payment/callback", async (req, res) => {
    console.log("Paystack callback received:", req.query);
    const { reference } = req.query;
    if (!reference) {
      return res.status(400).send("Missing payment reference.");
    }
    try {
      const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
      const verifyUrl = `https://api.paystack.co/transaction/verify/${reference}`;
      const paystackRes = await axios.get(verifyUrl, {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json'
        }
      });
      console.log("Paystack verification response:", paystackRes.data);
      const status = paystackRes.data?.data?.status;
      const bookingId = paystackRes.data?.data?.metadata?.bookingId;
      if (status === "success" && bookingId) {
        await storage.updateBookingPaymentStatus(bookingId, "paid");
        const booking = await storage.getBooking(bookingId);
        if (booking) {
          // Prepare email HTML for receipt
          const checkInDate = new Date(booking.checkIn).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
          const checkOutDate = new Date(booking.checkOut).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

          const receiptHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #C96846; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
                .booking-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                .detail-label { font-weight: bold; color: #666; }
                .detail-value { color: #333; }
                .total { font-size: 24px; color: #C96846; font-weight: bold; text-align: right; margin-top: 15px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
                .success-badge { background-color: #10B981; color: white; padding: 10px 20px; border-radius: 5px; display: inline-block; margin: 20px 0; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Booking Confirmation & Receipt</h1>
                  <p>Legacy Holiday Home Diani</p>
                </div>
                <div class="content">
                  <div class="success-badge">Payment Confirmed</div>
                  
                  <p>Dear ${booking.name},</p>
                  <p>Thank you for your payment! Your booking at Legacy Holiday Home Diani has been confirmed.</p>
                  
                  <div class="booking-details">
                    <h2 style="color: #C96846; margin-top: 0;">Booking Details</h2>
                    <div class="detail-row">
                      <span class="detail-label">Booking ID:</span>
                      <span class="detail-value">${booking.id}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Guest Name:</span>
                      <span class="detail-value">${booking.name}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Email:</span>
                      <span class="detail-value">${booking.email}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Phone:</span>
                      <span class="detail-value">${booking.phone}</span>
                    </div>
                    
                    <h2 style="color: #C96846; margin-top: 30px;">Stay Details</h2>
                    <div class="detail-row">
                      <span class="detail-label">Check-in:</span>
                      <span class="detail-value">${checkInDate}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Check-out:</span>
                      <span class="detail-value">${checkOutDate}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Guests:</span>
                      <span class="detail-value">${booking.adults} ${booking.adults === 1 ? 'Adult' : 'Adults'}, ${booking.children} ${booking.children === 1 ? 'Child' : 'Children'}</span>
                    </div>
                    
                    ${booking.specialRequirements ? `
                      <h2 style="color: #C96846; margin-top: 30px;">Special Requirements</h2>
                      <p style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                        ${booking.specialRequirements}
                      </p>
                    ` : ''}
                    
                    <h2 style="color: #C96846; margin-top: 30px;">Payment Summary</h2>
                    <div class="detail-row">
                      <span class="detail-label">Payment Status:</span>
                      <span class="detail-value" style="color: #10B981; font-weight: bold;">PAID</span>
                    </div>
                    <div class="total">
                      Total Paid: Ksh ${booking.totalAmount}
                    </div>
                  </div>
                  
                  <p style="margin-top: 30px;">
                    Larry will be in touch soon to confirm your arrival details and answer any questions you may have.
                  </p>
                  
                  <p>
                    For any immediate questions, please contact:<br>
                    <strong>Phone:</strong> +254 714 389500<br>
                    <strong>Location:</strong> Diani Coast, Kenya
                  </p>
                  
                  <p>We look forward to welcoming you to Legacy Holiday Home Diani!</p>
                </div>
                <div class="footer">
                  <p>This is your official booking confirmation and payment receipt.</p>
                  <p>Legacy Holiday Home Diani - Your Luxury Escape Awaits</p>
                </div>
              </div>
            </body>
            </html>
          `;

          // Host notification HTML
          const hostNotificationHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #10B981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-radius: 0 0 8px 8px; }
                .booking-details { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                .detail-label { font-weight: bold; color: #666; }
                .detail-value { color: #333; }
                .total { font-size: 24px; color: #10B981; font-weight: bold; text-align: right; margin-top: 15px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Payment Received</h1>
                  <p>Booking #${booking.id.substring(0, 8)}</p>
                </div>
                <div class="content">
                  <p>Hello Larry,</p>
                  <p>Great news! Payment has been received for the booking from ${booking.name}.</p>
                  <div class="booking-details">
                    <div class="detail-row">
                      <span class="detail-label">Guest:</span>
                      <span class="detail-value">${booking.name}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Check-in:</span>
                      <span class="detail-value">${checkInDate}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label">Check-out:</span>
                      <span class="detail-value">${checkOutDate}</span>
                    </div>
                    <div class="total">
                      Amount Received: Ksh ${booking.totalAmount}
                    </div>
                  </div>
                  <p>The guest has been sent a confirmation email with their receipt. Please reach out to confirm their arrival arrangements.</p>
                </div>
              </div>
            </body>
            </html>
          `;

          // Send confirmation email to client
          try {
            const guestEmailPayload = {
              sender: { name: "Legacy Holiday Home Diani", email: "info@legacyholidayhome.co.ke" },
              to: [{ email: booking.email, name: booking.name }],
              subject: "Booking Confirmed - Legacy Holiday Home Diani",
              htmlContent: receiptHtml
            };
            await transactionalEmailApi.sendTransacEmail(guestEmailPayload);
            console.log("Receipt email sent to guest successfully via Brevo");
          } catch (emailError: any) {
            console.error("Failed to send receipt email:", emailError.response ? emailError.response.text : emailError.message);
          }
          // Send payment confirmation to host
          try {
            const hostEmailPayload = {
              sender: { name: "Legacy Holiday Home Diani", email: "info@legacyholidayhome.co.ke" },
              to: [{ email: "larry.josephgithaka@gmail.com", name: "Larry" }],
              cc: [{ email: "bettirosengugi@gmail.com", name: "Bettirose" }],
              subject: `Payment Received - ${booking.name}`,
              htmlContent: hostNotificationHtml
            };
            await transactionalEmailApi.sendTransacEmail(hostEmailPayload);
            console.log("Payment confirmation email sent to host successfully via Brevo");

          } catch (emailError: any) {
            console.error("Failed to send host email:", emailError.response ? emailError.response.text : emailError.message);
          }
        }
        return res.send("Payment successful! Your booking is confirmed.");
      } else {
        return res.send("Payment verification failed or booking not found.");
      }
    } catch (err: any) {
      console.error("Paystack verification error:", err.response?.data || err.message);
      return res.status(500).send("Error verifying payment.");
    }
  });

  // =========================================================
  // DELETE BOOKING ROUTE (Admin Only)
  // =========================================================
  app.delete("/api/bookings/:id", async (req, res) => {
    // 1. Security Check: Verify the Admin Secret
    const clientSecret = req.headers['x-admin-secret'];
    const serverSecret = process.env.ADMIN_SECRET;

    if (!clientSecret || clientSecret !== serverSecret) {
      console.log("Unauthorized delete attempt");
      return res.status(401).json({ message: "Unauthorized: Invalid Admin Secret" });
    }

    const bookingId = req.params.id;

    // 2. Check if the booking exists
    const booking = await storage.getBooking(bookingId);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    // 3. Delete it
    await storage.deleteBooking(bookingId);
    console.log(`Booking ${bookingId} (${booking.name}) was deleted by Admin.`);
    
    return res.json({ 
      message: `Booking for ${booking.name} deleted successfully. Dates are now free.` 
    });
  });

  // GET ALL BOOKINGS (Admin Only)
  app.get("/api/bookings", async (req, res) => {
    const isAdmin = req.headers['x-admin-secret'] === process.env.ADMIN_SECRET;
    if (!isAdmin) return res.status(401).json({ message: "Unauthorized" });

    const bookings = await storage.getAllBookings();
    res.json(bookings);
  });

  // (The line below should already exist in your file)

  const httpServer = createServer(app);

  return httpServer;
}