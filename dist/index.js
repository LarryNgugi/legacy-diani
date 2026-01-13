// server/index.ts
import express2 from "express";
import dotenv2 from "dotenv";

// server/routes.ts
import dotenv from "dotenv";
import { createServer } from "http";

// server/storage.ts
import { randomUUID } from "crypto";
var MemStorage = class {
  users;
  bookings;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.bookings = /* @__PURE__ */ new Map();
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByUsername(username) {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }
  async createUser(insertUser) {
    const id = randomUUID();
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  async createBooking(insertBooking) {
    const id = randomUUID();
    const booking = {
      ...insertBooking,
      id,
      createdAt: /* @__PURE__ */ new Date(),
      stripePaymentId: null,
      specialRequirements: insertBooking.specialRequirements || null,
      paymentStatus: insertBooking.paymentStatus || "pending"
    };
    this.bookings.set(id, booking);
    return booking;
  }
  async updateBookingPaymentId(bookingId, stripePaymentId) {
    const booking = this.bookings.get(bookingId);
    if (booking) {
      booking.stripePaymentId = stripePaymentId;
      this.bookings.set(bookingId, booking);
    }
  }
  async updateBookingPaymentStatus(bookingId, status) {
    const booking = this.bookings.get(bookingId);
    if (booking) {
      booking.paymentStatus = status;
      this.bookings.set(bookingId, booking);
    }
  }
  async getBooking(id) {
    return this.bookings.get(id);
  }
};
var storage = new MemStorage();

// server/routes.ts
import Stripe from "stripe";
import nodemailer from "nodemailer";

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull()
});
var insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true
});
var bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  checkIn: timestamp("check_in").notNull(),
  checkOut: timestamp("check_out").notNull(),
  adults: integer("adults").notNull(),
  children: integer("children").notNull().default(0),
  specialRequirements: text("special_requirements"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paymentStatus: text("payment_status").notNull().default("pending"),
  stripePaymentId: text("stripe_payment_id"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`)
});
var insertBookingSchema = createInsertSchema(bookings, {
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
  checkIn: z.coerce.date(),
  checkOut: z.coerce.date(),
  adults: z.number().min(1, "At least 1 adult is required"),
  children: z.number().min(0).default(0),
  specialRequirements: z.string().optional(),
  totalAmount: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    return num.toString();
  }),
  paymentStatus: z.string().optional(),
  stripePaymentId: z.string().optional()
}).omit({
  id: true,
  createdAt: true
});

// server/routes.ts
import { fromZodError } from "zod-validation-error";
import axios from "axios";
dotenv.config();
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing required Stripe secret: STRIPE_SECRET_KEY");
}
var stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-11-17.clover"
});
var transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || "noreply@replit.app",
    pass: process.env.EMAIL_PASS || ""
  }
});
async function registerRoutes(app2) {
  app2.post("/api/bookings", async (req, res) => {
    try {
      const validationResult = insertBookingSchema.safeParse(req.body);
      if (!validationResult.success) {
        const validationError = fromZodError(validationResult.error);
        return res.status(400).json({
          message: "Validation failed",
          error: validationError.toString()
        });
      }
      const bookingData = validationResult.data;
      const booking = await storage.createBooking({
        ...bookingData,
        paymentStatus: "pending"
      });
      const paymentMethod = req.body.paymentMethod || "stripe";
      let paymentResponse = {};
      if (paymentMethod === "stripe") {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(parseFloat(bookingData.totalAmount) * 100),
          // Stripe expects amount in cents
          currency: "kes",
          // KSH currency code
          metadata: {
            bookingId: booking.id,
            guestName: bookingData.name,
            guestEmail: bookingData.email
          }
        });
        await storage.updateBookingPaymentId(booking.id, paymentIntent.id);
        paymentResponse = { clientSecret: paymentIntent.client_secret };
      } else if (paymentMethod === "mpesa") {
        try {
          const mpesaConfig = {
            consumerKey: process.env.MPESA_CONSUMER_KEY,
            consumerSecret: process.env.MPESA_CONSUMER_SECRET,
            shortcode: process.env.MPESA_SHORTCODE,
            passkey: process.env.MPESA_PASSKEY,
            callbackUrl: process.env.MPESA_CALLBACK_URL
          };
          if (!mpesaConfig.consumerKey || !mpesaConfig.consumerSecret || !mpesaConfig.shortcode || !mpesaConfig.passkey || !mpesaConfig.callbackUrl) {
            return res.status(500).json({
              message: "M-Pesa configuration is incomplete. Please contact support."
            });
          }
          const isProduction = process.env.MPESA_ENV === "production";
          console.log("MPESA_ENV:", process.env.MPESA_ENV);
          console.log("isProduction:", isProduction);
          const baseUrl = isProduction ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
          console.log("Using M-Pesa URL:", baseUrl);
          const auth = Buffer.from(`${mpesaConfig.consumerKey}:${mpesaConfig.consumerSecret}`).toString("base64");
          let tokenRes;
          try {
            tokenRes = await axios.get(
              `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
              {
                headers: {
                  Authorization: `Basic ${auth}`,
                  "Content-Type": "application/json"
                }
              }
            );
          } catch (tokenError) {
            console.error("M-Pesa OAuth Error:", tokenError.response?.data || tokenError.message);
            return res.status(500).json({
              message: "Failed to authenticate with M-Pesa",
              details: tokenError.response?.data || tokenError.message
            });
          }
          if (!tokenRes.data.access_token) {
            return res.status(500).json({
              message: "Failed to get M-Pesa access token"
            });
          }
          const accessToken = tokenRes.data.access_token;
          const timestamp2 = (/* @__PURE__ */ new Date()).toISOString().replace(/[-T:.Z]/g, "").slice(0, 14);
          const password = Buffer.from(`${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp2}`).toString("base64");
          let phone = bookingData.phone.trim();
          phone = phone.replace(/^\+/, "").replace(/^0/, "254");
          if (!phone.startsWith("254")) {
            phone = "254" + phone;
          }
          const amount = Math.round(parseFloat(bookingData.totalAmount));
          const stkPayload = {
            BusinessShortCode: mpesaConfig.shortcode,
            Password: password,
            Timestamp: timestamp2,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: phone,
            PartyB: mpesaConfig.shortcode,
            PhoneNumber: phone,
            CallBackURL: mpesaConfig.callbackUrl,
            AccountReference: `BK${booking.id.substring(0, 10)}`,
            TransactionDesc: `Booking for ${bookingData.name}`
          };
          console.log("M-Pesa STK Push Request:", {
            ...stkPayload,
            Password: "***HIDDEN***",
            environment: isProduction ? "production" : "sandbox"
          });
          let stkRes;
          try {
            stkRes = await axios.post(
              `${baseUrl}/mpesa/stkpush/v1/processrequest`,
              stkPayload,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "application/json"
                }
              }
            );
          } catch (stkError) {
            console.error("M-Pesa STK Push Error:", stkError.response?.data || stkError.message);
            return res.status(500).json({
              message: "Failed to initiate M-Pesa payment",
              details: stkError.response?.data || stkError.message
            });
          }
          console.log("M-Pesa STK Push Response:", stkRes.data);
          if (stkRes.data.ResponseCode === "0") {
            paymentResponse = {
              mpesaInstructions: `A payment request has been sent to ${phone}. Please enter your M-Pesa PIN on your phone to complete the payment.`,
              mpesaCheckoutRequestID: stkRes.data.CheckoutRequestID
            };
            await storage.updateBookingPaymentId(booking.id, stkRes.data.CheckoutRequestID);
          } else {
            return res.status(500).json({
              message: "Failed to initiate M-Pesa STK Push",
              details: stkRes.data
            });
          }
        } catch (mpesaError) {
          console.error("M-Pesa Integration Error:", mpesaError);
          return res.status(500).json({
            message: "M-Pesa payment processing failed",
            error: mpesaError.message
          });
        }
      } else {
        return res.status(400).json({ message: "Unsupported payment method" });
      }
      const checkInDate = new Date(bookingData.checkIn).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      const checkOutDate = new Date(bookingData.checkOut).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
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
                  <span class="detail-value">${bookingData.adults} ${bookingData.adults === 1 ? "Adult" : "Adults"}, ${bookingData.children} ${bookingData.children === 1 ? "Child" : "Children"}</span>
                </div>
                
                ${bookingData.specialRequirements ? `
                  <h2 style="color: #C96846; margin-top: 30px;">Special Requirements</h2>
                  <p style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    ${bookingData.specialRequirements}
                  </p>
                ` : ""}
                
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
          html: emailHtml
        });
        console.log("Booking notification email sent successfully");
      } catch (emailError) {
        console.error("Failed to send booking notification email:", emailError.message);
      }
      res.json({
        bookingId: booking.id,
        ...paymentResponse
      });
    } catch (error) {
      console.error("Booking error:", error);
      res.status(500).json({
        message: "Error creating booking",
        error: error.message
      });
    }
  });
  app2.post("/api/mpesa-callback", async (req, res) => {
    console.log("M-Pesa Callback received:", JSON.stringify(req.body, null, 2));
    try {
      const { Body } = req.body;
      if (Body?.stkCallback) {
        const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = Body.stkCallback;
        if (ResultCode === 0) {
          console.log("M-Pesa payment successful:", CheckoutRequestID);
          const metadata = CallbackMetadata?.Item || [];
          const mpesaReceiptNumber = metadata.find((item) => item.Name === "MpesaReceiptNumber")?.Value;
          console.log("Payment Receipt Number:", mpesaReceiptNumber);
        } else {
          console.log("M-Pesa payment failed:", ResultDesc);
        }
      }
    } catch (error) {
      console.error("M-Pesa callback error:", error);
    }
    res.json({ ResultCode: 0, ResultDesc: "Success" });
  });
  app2.post("/api/bookings/confirm-payment", async (req, res) => {
    try {
      const { bookingId, paymentIntentId } = req.body;
      if (!bookingId || !paymentIntentId) {
        return res.status(400).json({
          message: "Missing required fields: bookingId and paymentIntentId"
        });
      }
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({
          message: "Payment has not been completed",
          status: paymentIntent.status
        });
      }
      await storage.updateBookingPaymentStatus(bookingId, "paid");
      const booking = await storage.getBooking(bookingId);
      if (!booking) {
        return res.status(404).json({
          message: "Booking not found"
        });
      }
      const checkInDate = new Date(booking.checkIn).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      const checkOutDate = new Date(booking.checkOut).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
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
                  <span class="detail-value">${booking.adults} ${booking.adults === 1 ? "Adult" : "Adults"}, ${booking.children} ${booking.children === 1 ? "Child" : "Children"}</span>
                </div>
                
                ${booking.specialRequirements ? `
                  <h2 style="color: #C96846; margin-top: 30px;">Special Requirements</h2>
                  <p style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
                    ${booking.specialRequirements}
                  </p>
                ` : ""}
                
                <h2 style="color: #C96846; margin-top: 30px;">Payment Summary</h2>
                <div class="detail-row">
                  <span class="detail-label">Payment ID:</span>
                  <span class="detail-value">${paymentIntentId}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Payment Status:</span>
                  <span class="detail-value" style="color: #10B981; font-weight: bold;">PAID</span>
                </div>
                
                <div class="total">
                  Total Paid: Ksh ${booking.totalAmount}
                </div>
              </div>
              
              <p style="margin-top: 30px;">
                Joseph will be in touch soon to confirm your arrival details and answer any questions you may have.
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
      try {
        await transporter.sendMail({
          from: '"Legacy Holiday Home Diani" <noreply@replit.app>',
          to: booking.email,
          subject: `Booking Confirmed - Legacy Holiday Home Diani`,
          html: receiptHtml
        });
        console.log("Receipt email sent to guest successfully");
      } catch (emailError) {
        console.error("Failed to send receipt email to guest:", emailError.message);
      }
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
              <p>Hello Joseph,</p>
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
      try {
        await transporter.sendMail({
          from: '"Legacy Holiday Home Diani" <noreply@replit.app>',
          to: "bettirosengugi@gmail.com",
          subject: `Payment Received - ${booking.name}`,
          html: hostNotificationHtml
        });
        console.log("Payment confirmation email sent to host successfully");
      } catch (emailError) {
        console.error("Failed to send payment confirmation to host:", emailError.message);
      }
      res.json({
        success: true,
        message: "Payment confirmed and receipt sent",
        bookingId: booking.id
      });
    } catch (error) {
      console.error("Payment confirmation error:", error);
      res.status(500).json({
        message: "Error confirming payment",
        error: error.message
      });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      ),
      await import("@replit/vite-plugin-dev-banner").then(
        (m) => m.devBanner()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
dotenv2.config();
var app = express2();
app.use(express2.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "production") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "127.0.0.1", () => {
    log(`serving on port ${port}`);
  });
})();
