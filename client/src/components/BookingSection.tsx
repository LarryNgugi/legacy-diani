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
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY 
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

interface BookingSectionProps {
  hostName: string;
  phoneNumber: string;
  location: string;
  mapEmbedUrl?: string;
  pricePerNight: number;
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
}

function PaymentForm({ bookingId, totalAmount, onSuccess }: { bookingId: string; totalAmount: number; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + "?payment=success",
        },
        redirect: "if_required",
      });

      if (error) {
        setIsProcessing(false);
        toast({
          title: "Payment Failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (paymentIntent && paymentIntent.status === "succeeded") {
        // Confirm payment with backend
        const response = await apiRequest("POST", "/api/bookings/confirm-payment", {
          bookingId,
          paymentIntentId: paymentIntent.id,
        });

        const data = await response.json();

        setIsProcessing(false);

        if (!response.ok) {
          toast({
            title: "Payment Confirmation Failed",
            description: data.message || "Please contact us to verify your booking.",
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Payment Successful!",
          description: "Your booking is confirmed. Check your email for the receipt. We'll be in touch soon!",
        });
        onSuccess();
      } else {
        setIsProcessing(false);
        toast({
          title: "Payment Processing",
          description: "Payment is being processed. We'll send you an email confirmation.",
        });
      }
    } catch (err: any) {
      setIsProcessing(false);
      toast({
        title: "Error",
        description: err.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full"
        size="lg"
        data-testid="button-confirm-payment"
      >
        {isProcessing ? "Processing..." : `Pay $${totalAmount.toFixed(2)}`}
      </Button>
    </form>
  );
}

export default function BookingSection({
  hostName,
  phoneNumber,
  location,
  mapEmbedUrl,
  pricePerNight,
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
  });

  const [showPayment, setShowPayment] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const { toast } = useToast();

  const calculateTotalAmount = () => {
    if (!formData.checkIn || !formData.checkOut) return 0;
    const nights = differenceInDays(formData.checkOut, formData.checkIn);
    return nights > 0 ? nights * pricePerNight : 0;
  };

  const bookingMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      const totalAmount = calculateTotalAmount();
      const response = await apiRequest("POST", "/api/bookings", {
        ...data,
        totalAmount,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Booking Details Received!",
        description: "Please proceed with payment to confirm your reservation.",
      });
      setClientSecret(data.clientSecret);
      setBookingId(data.bookingId);
      setShowPayment(true);
    },
    onError: (error: any) => {
      toast({
        title: "Booking Failed",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

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

                  {nights > 0 && (
                    <div className="bg-primary/10 rounded-md p-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          {nights} {nights === 1 ? "night" : "nights"} × ${pricePerNight}
                        </span>
                        <span className="font-semibold" data-testid="text-subtotal">
                          ${totalAmount}
                        </span>
                      </div>
                      <div className="border-t pt-2 flex justify-between items-center">
                        <span className="font-semibold">Total</span>
                        <span className="text-2xl font-bold text-primary" data-testid="text-total">
                          ${totalAmount}
                        </span>
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
                  Secure payment powered by Stripe
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

                {!stripePromise ? (
                  <div className="text-center p-6 bg-destructive/10 rounded-md">
                    <p className="text-destructive font-semibold">Payment system is not configured.</p>
                    <p className="text-sm text-muted-foreground mt-2">Please contact us directly to complete your booking.</p>
                  </div>
                ) : clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <PaymentForm
                      bookingId={bookingId!}
                      totalAmount={totalAmount}
                      onSuccess={handlePaymentSuccess}
                    />
                  </Elements>
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

                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-3 rounded-md">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Pricing</h3>
                    <p className="text-muted-foreground">${pricePerNight} per night</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Final price shown after date selection
                    </p>
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
