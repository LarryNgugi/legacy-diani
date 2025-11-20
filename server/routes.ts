import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import { insertBookingSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

// Initialize Stripe
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-11-17.clover",
});

// Initialize email transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || "noreply@replit.app",
    pass: process.env.EMAIL_PASS || "",
  },
});

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
      
      // Create booking in storage
      const booking = await storage.createBooking({
        ...bookingData,
        paymentStatus: "pending",
      });

      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(bookingData.totalAmount) * 100), // Convert to cents
        currency: "usd",
        metadata: {
          bookingId: booking.id,
          guestName: bookingData.name,
          guestEmail: bookingData.email,
        },
      });

      // Update booking with Stripe payment ID
      await storage.updateBookingPaymentId(booking.id, paymentIntent.id);

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
              <h1>🏝️ New Booking Request</h1>
              <p>Legacy Holiday Home Diani</p>
            </div>
            <div class="content">
              <p>Hello Joseph,</p>
              <p>You have received a new booking request for your villa!</p>
              
              <div class="booking-details">
                <h2 style="color: #C96846; margin-top: 0;">Guest Information</h2>
                <div class="detail-row">
                  <span class="detail-label">Name:</span>
                  <span class="detail-value">${bookingData.name}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Email:</span>
                  <span class="detail-value">${bookingData.email}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Phone:</span>
                  <span class="detail-value">${bookingData.phone}</span>
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
                  <span class="detail-value">${bookingData.adults} ${bookingData.adults === 1 ? 'Adult' : 'Adults'}, ${bookingData.children} ${bookingData.children === 1 ? 'Child' : 'Children'}</span>
                </div>
                
                ${bookingData.specialRequirements ? `
                  <h2 style="color: #C96846; margin-top: 30px;">Special Requirements</h2>
                  <p style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    ${bookingData.specialRequirements}
                  </p>
                ` : ''}
                
                <div class="total">
                  Total: $${bookingData.totalAmount}
                </div>
              </div>
              
              <p style="margin-top: 30px;">
                <strong>Payment Status:</strong> Pending - Guest will complete payment shortly.
              </p>
              
              <p>Please reach out to the guest to confirm availability and discuss any special requirements.</p>
            </div>
            <div class="footer">
              <p>This is an automated notification from your villa booking system.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        await transporter.sendMail({
          from: '"Legacy Holiday Home Diani" <noreply@replit.app>',
          to: "bettirosengugi@gmail.com",
          subject: `New Booking Request from ${bookingData.name}`,
          html: emailHtml,
        });
      } catch (emailError) {
        console.error("Failed to send email:", emailError);
        // Don't fail the booking if email fails
      }

      res.json({
        bookingId: booking.id,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      console.error("Booking error:", error);
      res.status(500).json({ 
        message: "Error creating booking",
        error: error.message 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
