import { useState, useRef, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type GalleryMedia = {
  src: string;
  alt: string;
  title: string;
  type?: 'image' | 'video';
  poster?: string;
};


interface GalleryProps {
  images: GalleryMedia[];
}

export default function Gallery({ images }: GalleryProps) {

  const closeLightbox = () => {
    setSelectedImage(null);
  };

  const showNext = () => {
    if (selectedImage !== null) {
      setSelectedImage((selectedImage + 1) % images.length);
    }
  };

  const showPrevious = () => {
    if (selectedImage !== null) {
      setSelectedImage((selectedImage - 1 + images.length) % images.length);
    }
  };

  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [isPortrait, setIsPortrait] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const openLightbox = (index: number) => {
    setSelectedImage(index);
  };

  useEffect(() => {
    if (selectedImage !== null) {
      const media = images[selectedImage];
      if (media.type === 'image' && imgRef.current) {
        const img = imgRef.current;
        if (img.naturalWidth && img.naturalHeight) {
          setIsPortrait(img.naturalHeight > img.naturalWidth);
        }
      } else if (media.type === 'video' && videoRef.current) {
        // For video, use video dimensions
        const video = videoRef.current;
        if (video.videoWidth && video.videoHeight) {
          setIsPortrait(video.videoHeight > video.videoWidth);
        }
      }
    }
  }, [selectedImage, images]);

  return (
    <section id="gallery" className="py-20 px-6 bg-background">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-serif text-4xl md:text-5xl font-semibold text-foreground mb-4" data-testid="text-gallery-title">
            Explore the Villa
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover every corner of our luxurious property
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((media, index) => (
            <div
              key={index}
              className="group relative aspect-[4/3] overflow-hidden rounded-md cursor-pointer hover-elevate active-elevate-2"
              onClick={() => openLightbox(index)}
              data-testid={`gallery-media-${index}`}
            >
              {media.type === 'video' ? (
                <div className="relative w-full h-full">
                  <video
                    src={media.src}
                    poster={media.poster}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    muted
                    playsInline
                    preload="metadata"
                    tabIndex={-1}
                    onError={e => {
                      console.error('Gallery grid video error:', {
                        src: media.src,
                        poster: media.poster,
                        error: e
                      });
                    }}
                    onLoadedData={e => {
                      console.debug('Gallery grid video loaded:', {
                        src: media.src,
                        poster: media.poster
                      });
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <svg className="w-16 h-16 text-white opacity-80 drop-shadow-lg" fill="currentColor" viewBox="0 0 64 64">
                      <circle cx="32" cy="32" r="32" fill="black" fillOpacity="0.4" />
                      <polygon points="26,20 50,32 26,44" fill="white" />
                    </svg>
                  </div>
                </div>
              ) : (
                <img
                  src={media.src}
                  alt={media.alt}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-end">
                <div className="p-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <p className="font-medium">{media.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedImage !== null && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/10"
            onClick={closeLightbox}
            data-testid="button-close-lightbox"
          >
            <X className="w-6 h-6" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              showPrevious();
            }}
            data-testid="button-previous-image"
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              showNext();
            }}
            data-testid="button-next-image"
          >
            <ChevronRight className="w-8 h-8" />
          </Button>

          <div
            className={
              isPortrait
                ? "max-h-[80vh] max-w-[400px] w-full"
                : "max-w-2xl max-h-[70vh] w-full"
            }
            onClick={(e) => e.stopPropagation()}
          >
            {images[selectedImage].type === 'video' ? (
              <video
                ref={videoRef}
                src={images[selectedImage].src}
                poster={images[selectedImage].poster}
                className="w-full h-full object-contain rounded-md"
                controls
                data-testid="lightbox-video"
                onLoadedMetadata={e => {
                  const video = e.currentTarget;
                  setIsPortrait(video.videoHeight > video.videoWidth);
                  console.debug('Lightbox video loaded metadata:', {
                    src: images[selectedImage].src,
                    poster: images[selectedImage].poster,
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight
                  });
                }}
                onError={e => {
                  console.error('Lightbox video error:', {
                    src: images[selectedImage].src,
                    poster: images[selectedImage].poster,
                    error: e
                  });
                }}
                onLoadedData={e => {
                  console.debug('Lightbox video loaded data:', {
                    src: images[selectedImage].src,
                    poster: images[selectedImage].poster
                  });
                }}
              />
            ) : (
              <img
                ref={imgRef}
                src={images[selectedImage].src}
                alt={images[selectedImage].alt}
                className="w-full h-full object-contain rounded-md"
                data-testid="lightbox-image"
                onLoad={e => {
                  const img = e.currentTarget;
                  setIsPortrait(img.naturalHeight > img.naturalWidth);
                }}
              />
            )}
            <p className="text-white text-center mt-4 text-lg">
              {images[selectedImage].title}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
