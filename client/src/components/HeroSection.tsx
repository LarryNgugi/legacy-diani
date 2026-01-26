import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

interface HeroSectionProps {
  backgroundImage: string;
  villaName: string;
  tagline: string;
  pricePerNight: number;
  onBookNow: () => void;
}

export default function HeroSection({
  backgroundImage,
  villaName,
  tagline,
  pricePerNight,
  onBookNow,
}: HeroSectionProps) {
  return (
    <section className="relative min-h-dvh w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] flex flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
        style={{ 
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',          
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
      
      <div className="relative z-10 text-center w-full px-4 max-w-7xl mx-auto">
        <h1 
          className="font-serif text-5xl md:text-7xl font-semibold text-white mb-4"
          data-testid="text-villa-name"
        >
          {villaName}
        </h1>
        
        <div className="flex items-center justify-center gap-2 text-white/90 text-lg md:text-xl mb-8">
          <MapPin className="w-5 h-5" />
          <p data-testid="text-tagline">{tagline}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            size="lg"
            className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 text-white shadow-xl"
            onClick={onBookNow}
            data-testid="button-book-now-hero"
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
            data-testid="button-contact-hero"
          >
            Contact Us
          </Button>
        </div>
      </div>
      
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/50 rounded-full flex items-start justify-center p-2">
          <div className="w-1.5 h-3 bg-white/50 rounded-full" />
        </div>
      </div>
    </section>
  );
}
