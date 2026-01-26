import { Bed, Wifi, Tv, Waves, Trees, User, Baby, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Amenity {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const amenities: Amenity[] = [
  {
    icon: <Bed className="w-10 h-10 text-primary" />,
    title: "3 Queen Bedrooms",
    description: "Spacious rooms with comfortable queen-size beds"
  },
  {
    icon: <Waves className="w-10 h-10 text-primary" />,
    title: "Private Pool",
    description: "Beautiful swimming pool with sun loungers"
  },
  {
    icon: <Trees className="w-10 h-10 text-primary" />,
    title: "Tropical Garden",
    description: "Lush greenery and palm trees throughout"
  },
  {
    icon: <Wifi className="w-10 h-10 text-primary" />,
    title: "High-Speed WiFi",
    description: "Stay connected with fast internet access"
  },
  {
    icon: <Tv className="w-10 h-10 text-primary" />,
    title: "Smart TV",
    description: "Entertainment center in the living room"
  },
  {
    icon: <User className="w-10 h-10 text-primary" />,
    title: "Onsite Caretaker",
    description: "24/7 assistance for your comfort"
  },
  {
    icon: <Baby className="w-10 h-10 text-primary" />,
    title: "Baby Cot Available",
    description: "Perfect for families with young children"
  },
  {
    icon: <MapPin className="w-10 h-10 text-primary" />,
    title: "Beach Access",
    description: "Just 10 minutes walk to Diani Beach"
  }
];

export default function Amenities() {
  return (
    <section id="amenities" className="py-20 px-6 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-foreground mb-4" data-testid="text-amenities-title">
            Premium Amenities
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need for a perfect tropical getaway
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {amenities.map((amenity, index) => (
            <Card 
              key={index} 
              className="hover-elevate transition-all duration-300"
              data-testid={`amenity-card-${index}`}
            >
              <CardContent className="p-6 text-center">
                <div className="flex justify-center mb-4">
                  {amenity.icon}
                </div>
                <h3 className="font-semibold text-lg mb-2 text-foreground">
                  {amenity.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {amenity.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
