import { type User, type InsertUser, type Booking, type InsertBooking } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBookingPaymentId(bookingId: string, stripePaymentId: string): Promise<void>;
  updateBookingPaymentStatus(bookingId: string, status: string): Promise<void>;
  getBooking(id: string): Promise<Booking | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private bookings: Map<string, Booking>;

  constructor() {
    this.users = new Map();
    this.bookings = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const id = randomUUID();
    const booking: Booking = {
      ...insertBooking,
      id,
      createdAt: new Date(),
      stripePaymentId: null,
      specialRequirements: insertBooking.specialRequirements || null,
      paymentStatus: insertBooking.paymentStatus || "pending",
    };
    this.bookings.set(id, booking);
    return booking;
  }

  async updateBookingPaymentId(bookingId: string, stripePaymentId: string): Promise<void> {
    const booking = this.bookings.get(bookingId);
    if (booking) {
      booking.stripePaymentId = stripePaymentId;
      this.bookings.set(bookingId, booking);
    }
  }

  async updateBookingPaymentStatus(bookingId: string, status: string): Promise<void> {
    const booking = this.bookings.get(bookingId);
    if (booking) {
      booking.paymentStatus = status;
      this.bookings.set(bookingId, booking);
    }
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }
}

export const storage = new MemStorage();
