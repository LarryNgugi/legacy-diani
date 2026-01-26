import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Phone, MapPin, Calendar as CalendarIcon, Users, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


interface BookingSectionProps {
  hostName: string;
  phoneNumber: string;
  location: string;
  mapEmbedUrl?: string;
  seasonalPricing: {
    low: number;
    mid: number;
    peak: number;
    christmas?: number;
  };
}

interface BookingFormData {
  name: string;
  email: string;
  phone: string;
  checkIn: Date | undefined;
  checkOut: Date | undefined;
  adults: number;
  children: number;
  specialRequirements: string;
  paymentMethod: 'mpesa' | 'paystack';
}


export default function BookingSection({
  hostName,
  phoneNumber,
  location,
  mapEmbedUrl,
  seasonalPricing,
}: BookingSectionProps) {
  const [formData, setFormData] = useState<BookingFormData>({
    name: "",
    email: "",
    phone: "",
    checkIn: undefined,
    checkOut: undefined,
    adults: 1,
    children: 0,
    specialRequirements: "",
    paymentMethod: 'mpesa',
  });
  const [paystackPaymentUrl, setPaystackPaymentUrl] = useState<string | null>(null);

  const [showPayment, setShowPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const { toast } = useToast();

  // Determine season based on check-in date
  // Season Dates:
  // Low: Mar 1 – May 31, Oct 1 – Nov 30
  // Mid: Feb, Jun, Sep, Jul 1–14, Dec 1–14
  // Peak: Jul 15 – Aug 31, Dec 15 – Jan 5, Easter
  function isEaster(date: Date) {
    // Anonymous Gregorian algorithm for Easter Sunday
    const y = date.getFullYear();
    const a = y % 19;
    const b = Math.floor(y / 100);
    const c = y % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    // Easter Friday to Monday
    const easter = new Date(y, month - 1, day);
    const goodFriday = new Date(easter);
    goodFriday.setDate(easter.getDate() - 2);
    const easterMonday = new Date(easter);
    easterMonday.setDate(easter.getDate() + 1);
    return date >= goodFriday && date <= easterMonday;
  }

  const getSeason = (date: Date | undefined) => {
    if (!date) return 'low';
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Christmas pricing: Dec 20 – Jan 5
    if ((month === 12 && day >= 20) || (month === 1 && day <= 5)) return 'christmas';

    // Peak: Jul 15 – Aug 31
    if ((month === 7 && day >= 15) || (month === 8)) return 'peak';
    // Peak: Dec 15 – Dec 19
    if (month === 12 && day >= 15 && day <= 19) return 'peak';
    // Peak: Easter (Good Friday to Easter Monday)
    if (isEaster(date)) return 'peak';

    // Low: Mar 1 – May 31
    if ((month === 3) || (month === 4) || (month === 5)) return 'low';
    // Low: Oct 1 – Nov 30
    if ((month === 10) || (month === 11)) return 'low';

    // Mid: Feb
    if (month === 2) return 'mid';
    // Mid: Jun
    if (month === 6) return 'mid';
    // Mid: Sep
    if (month === 9) return 'mid';
    // Mid: Jul 1–14
    if (month === 7 && day <= 14) return 'mid';
    // Mid: Dec 1–14
    if (month === 12 && day <= 14) return 'mid';

    // Default to low
    return 'low';
  };

  // Calculate total amount based on season for each night
  const getNightsArray = (start: Date, end: Date) => {
    const nights = [];
    let current = new Date(start);
    while (current < end) {
      nights.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return nights;
  };

  const calculateTotalAmount = () => {
    if (!formData.checkIn || !formData.checkOut) return 0;
    const nightsArr = getNightsArray(formData.checkIn, formData.checkOut);
    let total = 0;
    for (const night of nightsArr) {
      const season = getSeason(night);
      total += seasonalPricing[season] ?? seasonalPricing.low;
    }
    return total;
  };

  // For display: show the season and price for the first night
  const displaySeason = getSeason(formData.checkIn);
  const displayPricePerNight = seasonalPricing[displaySeason] ?? seasonalPricing.low;

  const bookingMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      const totalAmount = calculateTotalAmount();
      
      // SWITCH TO STANDARD FETCH (Gives us control over errors)
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          totalAmount,
          paymentMethod: data.paymentMethod,
        }),
      });

      // 1. Check if the response is successful
      if (!response.ok) {
        // 2. Parse the error JSON to get the clean message
        const errorData = await response.json();
        // 3. Throw the CLEAN message (e.g., "Dates unavailable...")
        throw new Error(errorData.message || "Booking failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Booking Details Received!",
        description: "Please proceed with payment to confirm your reservation.",
      });
      setClientSecret(data.clientSecret || null);
      setBookingId(data.bookingId);
      setShowPayment(true);
      setMpesaInstructions(data.mpesaInstructions || null);
      if (formData.paymentMethod === 'paystack' && data.paymentUrl) {
        setPaystackPaymentUrl(data.paymentUrl);
        window.location.href = data.paymentUrl;
      }
    },
    onError: (error: any) => {
      // This log helps debug if it still fails
      console.log("Booking Error:", error.message);
      
      toast({
        title: "Booking Failed",
        // Now this will be just the clean text
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const [mpesaInstructions, setMpesaInstructions] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.checkIn || !formData.checkOut) {
      toast({
        title: "Missing Dates",
        description: "Please select check-in and check-out dates.",
        variant: "destructive",
      });
      return;
    }

    const nights = differenceInDays(formData.checkOut, formData.checkIn);
    if (nights <= 0) {
      toast({
        title: "Invalid Dates",
        description: "Check-out date must be after check-in date.",
        variant: "destructive",
      });
      return;
    }

    bookingMutation.mutate(formData);
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    setClientSecret(null);
    setFormData({
      name: "",
      email: "",
      phone: "",  
      checkIn: undefined,
      checkOut: undefined,
      adults: 1,
      children: 0,
      specialRequirements: "",
      paymentMethod: 'mpesa',
    });
  };

  const totalAmount = calculateTotalAmount();
  const nights = formData.checkIn && formData.checkOut
    ? differenceInDays(formData.checkOut, formData.checkIn)
    : 0;

  return (
    <section id="booking" className="py-20 px-6 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-foreground mb-4" data-testid="text-booking-title">
            Book Your Stay
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Fill in your details to reserve your luxury villa getaway
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {!showPayment ? (
            <Card>
              <CardHeader>
                <CardTitle>Reservation Details</CardTitle>
                <CardDescription>
                  Complete the form below to check availability and pricing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      type="text"
                      name="name"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      data-testid="input-name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      name="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      data-testid="input-email"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      name="phone"
                      placeholder="+254 712 345 678"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                      data-testid="input-phone"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Check-In Date *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.checkIn && "text-muted-foreground"
                            )}
                            data-testid="button-check-in-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.checkIn ? format(formData.checkIn, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.checkIn}
                            onSelect={(date) => setFormData({ ...formData, checkIn: date })}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label>Check-Out Date *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !formData.checkOut && "text-muted-foreground"
                            )}
                            data-testid="button-check-out-date"
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.checkOut ? format(formData.checkOut, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.checkOut}
                            onSelect={(date) => setFormData({ ...formData, checkOut: date })}
                            disabled={(date) => !formData.checkIn || date <= formData.checkIn}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="adults">Adults *</Label>
                      <Select
                        value={formData.adults.toString()}
                        onValueChange={(value) => setFormData({ ...formData, adults: parseInt(value) })}
                      >
                        <SelectTrigger id="adults" data-testid="select-adults">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6].map((num) => (
                            <SelectItem key={num} value={num.toString()}>
                              {num} {num === 1 ? "Adult" : "Adults"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="children">Children</Label>
                      <Select
                        value={formData.children.toString()}
                        onValueChange={(value) => setFormData({ ...formData, children: parseInt(value) })}
                      >
                        <SelectTrigger id="children" data-testid="select-children">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[0, 1, 2, 3, 4].map((num) => (
                            <SelectItem key={num} value={num.toString()}>
                              {num} {num === 1 ? "Child" : "Children"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="specialRequirements">Special Requirements</Label>
                    <Textarea
                      id="specialRequirements"
                      name="specialRequirements"
                      placeholder="Dietary needs, accessibility requirements, special occasions, etc."
                      value={formData.specialRequirements}
                      onChange={(e) => setFormData({ ...formData, specialRequirements: e.target.value })}
                      rows={4}
                      data-testid="input-special-requirements"
                    />
                  </div>

                  <div>
                    <Label htmlFor="paymentMethod">Payment Method *</Label>
                    <Select
                      value={formData.paymentMethod}
                      onValueChange={(value) => setFormData({ ...formData, paymentMethod: value as 'mpesa' | 'paystack' })}
                      required
                    >
                      <SelectTrigger id="paymentMethod" data-testid="select-payment-method">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mpesa">M-Pesa</SelectItem>
                        <SelectItem value="paystack">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {nights > 0 && (
                    <div className="bg-primary/10 rounded-md p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {nights} {nights === 1 ? "night" : "nights"} (seasonal rates applied)
                        </span>
                        <span className="font-semibold" data-testid="text-subtotal">
                          Ksh {totalAmount}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex flex-col gap-1">
                        <span className="font-semibold">Breakdown:</span>
                        {formData.checkIn && formData.checkOut && (() => {
                          // Group nights by season
                          const nightsArr = getNightsArray(formData.checkIn, formData.checkOut);
                          const seasonGroups: { [season: string]: { count: number, price: number } } = {};
                          for (const night of nightsArr) {
                            const s = getSeason(night);
                            let p = seasonalPricing[s] ?? seasonalPricing.low;
                            if (s === 'christmas' && seasonalPricing.christmas) {
                              p = seasonalPricing.christmas;
                            }
                            if (!seasonGroups[s]) {
                              seasonGroups[s] = { count: 1, price: p };
                            } else {
                              seasonGroups[s].count += 1;
                            }
                          }
                          return Object.entries(seasonGroups).map(([season, { count, price }]) => (
                            <span key={season} className="text-xs text-muted-foreground">
                              {count} {count === 1 ? 'night' : 'nights'} × Ksh {price} ({season.charAt(0).toUpperCase() + season.slice(1)} Season)
                            </span>
                          ));
                        })()}
                        <div className="flex justify-between items-center mt-2">
                          <span className="font-semibold">Total</span>
                          <span className="text-2xl font-bold text-primary" data-testid="text-total">
                            Ksh {totalAmount}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={bookingMutation.isPending}
                    data-testid="button-submit-booking"
                  >
                    {bookingMutation.isPending ? "Processing..." : "Continue to Payment"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Complete Payment</CardTitle>
                <CardDescription>
                  {formData.paymentMethod === 'mpesa' ? 'Pay securely with M-Pesa' : 'Pay securely with Paystack'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-6 bg-primary/10 rounded-md p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Booking Summary</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Guest:</span>
                      <span className="font-medium">{formData.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Check-in:</span>
                      <span className="font-medium">{formData.checkIn && format(formData.checkIn, "PPP")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Check-out:</span>
                      <span className="font-medium">{formData.checkOut && format(formData.checkOut, "PPP")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Guests:</span>
                      <span className="font-medium">{formData.adults} adults, {formData.children} children</span>
                    </div>
                  </div>
                  <div className="border-t mt-3 pt-3 flex justify-between items-center">
                    <span className="font-semibold">Total Amount</span>
                    <span className="text-2xl font-bold text-primary">${totalAmount}</span>
                  </div>
                </div>

                {formData.paymentMethod === 'mpesa' && mpesaInstructions ? (
                  <div className="text-center p-6 bg-primary/10 rounded-md">
                    <p className="font-semibold">M-Pesa Payment Instructions</p>
                    <p className="mt-2">{mpesaInstructions}</p>
                    <div className="mt-4 text-muted-foreground text-sm">
                      <p>If you did not receive the STK push, you can pay manually:</p>
                      <div className="mt-2">
                        <div>
                          <span className="font-semibold">Paybill:</span> <span className="font-mono">4161475</span><br />
                          <span className="font-semibold">Account:</span> <span className="font-mono">{bookingId ? String(bookingId).replace(/[^a-zA-Z0-9]/g, '').substring(0, 4) : 'Booking ID'}</span><br />
                          <span>Blueprime Venture</span>
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 text-muted-foreground text-sm">After payment, you will receive a confirmation email.</p>
                    <Button className="mt-4" onClick={handlePaymentSuccess}>Done</Button>
                  </div>
                ) : formData.paymentMethod === 'paystack' && paystackPaymentUrl ? (
                  <div className="text-center p-6 bg-primary/10 rounded-md">
                    <p className="font-semibold">Redirecting to Paystack...</p>
                    <p className="mt-2">If you are not redirected, <a href={paystackPaymentUrl} className="text-primary underline">click here</a> to pay securely via Paystack.</p>
                  </div>
                ) : null}

                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => {
                    setShowPayment(false);
                    setClientSecret(null);
                  }}
                  data-testid="button-back-to-booking"
                >
                  Back to Booking Form
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-6">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-md">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Call Us</h3>
                    <a
                      href={`tel:${phoneNumber}`}
                      className="text-primary hover:underline"
                      data-testid="link-phone"
                    >
                      {phoneNumber}
                    </a>
                    <p className="text-sm text-muted-foreground mt-1">
                      Contact {hostName}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-md">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Location</h3>
                    <p className="text-muted-foreground">{location}</p>
                  </div>
                </div>

                
               
              </CardContent>
            </Card>

            {mapEmbedUrl && (
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <iframe
                    src={mapEmbedUrl}
                    width="100%"
                    height="300"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Villa Location"
                    data-testid="map-embed"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
