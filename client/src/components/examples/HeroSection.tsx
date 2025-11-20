import HeroSection from '../HeroSection';
import poolImage from '@assets/IMG-20250717-WA0112_1763677460984.jpg';

export default function HeroSectionExample() {
  return (
    <HeroSection
      backgroundImage={poolImage}
      villaName="Legacy Holiday Home Diani"
      tagline="10 minutes from Diani Beach, Kenya"
      pricePerNight={200}
      onBookNow={() => console.log('Book now clicked')}
    />
  );
}
