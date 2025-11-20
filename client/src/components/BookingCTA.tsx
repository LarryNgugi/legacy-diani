import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface BookingCTAProps {
  onBookNow: () => void;
}

export default function BookingCTA({ onBookNow }: BookingCTAProps) {
  return (
    <section className="py-20 px-6 bg-primary/5">
      <div className="max-w-4xl mx-auto">
        <Card className="bg-primary text-primary-foreground border-0 shadow-xl">
          <CardContent className="p-12 text-center">
            <h2 className="font-serif text-3xl md:text-4xl font-semibold mb-4">
              Ready to Experience Paradise?
            </h2>
            <p className="text-lg mb-8 text-primary-foreground/90">
              Book your stay at Legacy Holiday Home Diani today
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                variant="secondary"
                className="text-lg px-8 py-6"
                onClick={onBookNow}
                data-testid="button-book-now-cta"
              >
                Book Now on Airbnb
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6 bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20"
                onClick={() => {
                  document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
                }}
                data-testid="button-contact-cta"
              >
                Contact Us
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
