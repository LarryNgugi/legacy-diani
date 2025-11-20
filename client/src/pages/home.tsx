import HeroSection from "@/components/HeroSection";
import Gallery from "@/components/Gallery";
import Amenities from "@/components/Amenities";
import BookingCTA from "@/components/BookingCTA";
import ContactSection from "@/components/ContactSection";
import VillaFooter from "@/components/VillaFooter";

import poolHero from '@assets/IMG-20250717-WA0112_1763677460984.jpg';
import pool1 from '@assets/IMG-20250717-WA0111_1763677460983.jpg';
import pool2 from '@assets/IMG-20250717-WA0112_1763677460984.jpg';
import pool3 from '@assets/IMG-20250717-WA0113_1763677460984.jpg';
import pool4 from '@assets/IMG-20250717-WA0108_1763677606537.jpg';
import bedroom1 from '@assets/IMG-20250717-WA0131_1763677460986.jpg';
import bedroom2 from '@assets/IMG-20250717-WA0121_1763677498355.jpg';
import bedroom3 from '@assets/IMG-20250717-WA0128_1763677606540.jpg';
import kitchen from '@assets/Kitchen_1763677460987.jpg';
import dining from '@assets/IMG-20250717-WA0105_1763677498351.jpg';
import living from '@assets/IMG-20250717-WA0103_1763677460981.jpg';
import living2 from '@assets/IMG-20250717-WA0132_1763677606541.jpg';
import patio1 from '@assets/IMG-20250717-WA0106_1763677606534.jpg';
import patio2 from '@assets/IMG-20250717-WA0107_1763677606536.jpg';
import exterior from '@assets/IMG-20250717-WA0109_1763677498352.jpg';
import bathroom1 from '@assets/IMG-20250717-WA0116_1763677498353.jpg';
import bathroom2 from '@assets/IMG-20250717-WA0126_1763677606539.jpg';

const AIRBNB_URL = "https://www.airbnb.com"; // TODO: Replace with actual Airbnb listing URL

const galleryImages = [
  { src: pool2, alt: 'Private swimming pool with sun loungers and palm trees at Legacy Holiday Home Diani', title: 'Private Pool' },
  { src: pool1, alt: 'Pool area with umbrella and blue loungers surrounded by tropical garden', title: 'Pool Lounging Area' },
  { src: pool3, alt: 'Full view of the villa and pool with lush tropical landscaping', title: 'Villa & Pool View' },
  { src: pool4, alt: 'Pristine swimming pool with palm trees and clear blue sky', title: 'Pool Paradise' },
  { src: bedroom1, alt: 'Master bedroom with elegant canopy bed and mosquito net', title: 'Master Bedroom' },
  { src: bedroom2, alt: 'Spacious bedroom with canopy bed and wooden accents', title: 'Guest Bedroom' },
  { src: bedroom3, alt: 'Comfortable bedroom with garden views', title: 'Bedroom with View' },
  { src: living, alt: 'Modern living room with Smart TV and built-in decorative shelves', title: 'Living Room' },
  { src: living2, alt: 'Living area with entertainment center and comfortable seating', title: 'Entertainment Area' },
  { src: kitchen, alt: 'Fully equipped modern kitchen with granite countertops', title: 'Kitchen' },
  { src: dining, alt: 'Dining area with breakfast bar and wooden chairs', title: 'Dining Area' },
  { src: patio1, alt: 'Covered patio with comfortable seating overlooking the garden', title: 'Covered Patio' },
  { src: patio2, alt: 'Outdoor lounge area with pool views', title: 'Outdoor Lounge' },
  { src: exterior, alt: 'Villa exterior showcasing modern architecture and lush tropical garden', title: 'Villa Exterior' },
  { src: bathroom1, alt: 'Modern bathroom with stylish vanity and mirror', title: 'Bathroom' },
  { src: bathroom2, alt: 'Clean bathroom with walk-in shower', title: 'En-suite Bathroom' },
];

export default function Home() {
  const handleBookNow = () => {
    window.open(AIRBNB_URL, '_blank');
  };

  return (
    <div className="min-h-screen">
      <HeroSection
        backgroundImage={poolHero}
        villaName="Legacy Holiday Home Diani"
        tagline="10 minutes from Diani Beach, Kenya"
        pricePerNight={200}
        onBookNow={handleBookNow}
      />
      
      <Gallery images={galleryImages} />
      
      <Amenities />
      
      <BookingCTA onBookNow={handleBookNow} />
      
      <ContactSection
        hostName="Joseph"
        phoneNumber="+254 714 389500"
        location="Diani Coast, Kenya"
        mapEmbedUrl="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d63777.99251145753!2d39.52831827910156!3d-4.321044999999997!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x18401f8f9f9f9f9f%3A0x1f9f9f9f9f9f9f9f!2sDiani%20Beach!5e0!3m2!1sen!2ske!4v1234567890123!5m2!1sen!2ske"
      />
      
      <VillaFooter
        villaName="Legacy Holiday Home Diani"
        phoneNumber="+254 714 389500"
        location="Diani Coast, Kenya"
        airbnbUrl={AIRBNB_URL}
      />
    </div>
  );
}
