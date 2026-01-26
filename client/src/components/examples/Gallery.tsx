import Gallery from '../Gallery';
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
import video1 from '@assets/IMG_0391.mp4'; 
import video2 from '@assets/IMG_0392.mp4';

export default function GalleryExample() {
  const images = [
    { src: pool2, alt: 'Private swimming pool with sun loungers and palm trees', title: 'Private Pool' },
    { src: pool1, alt: 'Pool area with umbrella and blue loungers', title: 'Pool Lounging Area' },
    { src: pool3, alt: 'Full view of the villa and pool with tropical garden', title: 'Villa & Pool View' },
    { src: pool4, alt: 'Another angle of the beautiful pool area', title: 'Pool Paradise' },
    { src: bedroom1, alt: 'Master bedroom with canopy bed and mosquito net', title: 'Master Bedroom' },
    { src: bedroom2, alt: 'Bedroom with canopy bed and wooden accents', title: 'Guest Bedroom' },
    { src: bedroom3, alt: 'Spacious bedroom with pool view', title: 'Bedroom with View' },
    { src: living, alt: 'Modern living room with Smart TV and built-in shelves', title: 'Living Room' },
    { src: living2, alt: 'Living area with entertainment center', title: 'Entertainment Area' },
    { src: kitchen, alt: 'Fully equipped modern kitchen', title: 'Kitchen' },
    { src: dining, alt: 'Dining area with breakfast bar', title: 'Dining Area' },
    { src: patio1, alt: 'Covered patio with comfortable seating', title: 'Covered Patio' },
    { src: patio2, alt: 'Outdoor lounge area overlooking the pool', title: 'Outdoor Lounge' },
    { src: exterior, alt: 'Villa exterior with lush tropical garden', title: 'Villa Exterior' },
    { src: bathroom1, alt: 'Modern bathroom with vanity', title: 'Bathroom' },
    { src: bathroom2, alt: 'Bathroom with shower', title: 'En-suite Bathroom' },
    
    {
      src: video1,
      alt: 'Video tour of the villa',
      title: 'Villa Tour',
      type: "video" as const,
      poster: pool1
    },
    {
      src: video2,
      alt: 'Villa features',
      title: 'Villa Features',
      type: "video" as const,
      poster: pool2
    }
  ];

  return <Gallery images={images} />;
}
