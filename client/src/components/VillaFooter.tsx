import { MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VillaFooterProps {
  villaName: string;
  phoneNumber: string;
  location: string;
  airbnbUrl: string;
  googleMapsUrl?: string;
}

export default function VillaFooter({
  villaName,
  phoneNumber,
  location,
  airbnbUrl,
  googleMapsUrl,
}: VillaFooterProps) {
  return (
    <footer className="bg-card border-t py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-serif text-2xl font-semibold mb-4 text-foreground">
              {villaName}
            </h3>
            <p className="text-muted-foreground">
              Your perfect tropical getaway in Diani Beach, Kenya
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-foreground">Contact</h4>
            <div className="space-y-2">
              <a
                href={`tel:${phoneNumber}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                data-testid="link-footer-phone"
              >
                <Phone className="w-4 h-4" />
                {phoneNumber}
              </a>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {location}
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-foreground">Quick Links</h4>
            <div className="space-y-2">
              <button
                className="text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                onClick={() => window.open(airbnbUrl, '_blank')}
                data-testid="link-footer-airbnb"
              >
                Book on Airbnb
              </button>
              {googleMapsUrl && (
                <button
                  className="text-muted-foreground hover:text-primary transition-colors cursor-pointer block"
                  onClick={() => window.open(googleMapsUrl, '_blank')}
                  data-testid="link-footer-maps"
                >
                  Location on Maps
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="border-t pt-8 text-center text-muted-foreground text-sm">
          <p>© {new Date().getFullYear()} {villaName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
