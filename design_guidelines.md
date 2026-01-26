# Design Guidelines: Legacy Holiday Home Diani

## Design Approach
**Reference-Based**: Drawing inspiration from Airbnb's property showcase philosophy and luxury vacation rental platforms (Vrbo, Booking.com). Focus on immersive imagery, emotional connection to the space, and frictionless booking journey.

## Core Design Principles
1. **Image-First Experience**: Property photos are the hero - let stunning visuals sell the villa
2. **Tropical Luxury**: Reflect the beachside Kenyan setting with airy, sophisticated aesthetics
3. **Conversion-Focused**: Every section guides toward booking action
4. **Trust & Transparency**: Clear pricing, amenities, and contact information build confidence

---

## Typography

**Primary Font**: Playfair Display (Google Fonts) - for headings and villa name
- Hero Title: 48px (mobile) / 72px (desktop), weight 600
- Section Headings: 32px (mobile) / 48px (desktop), weight 600

**Secondary Font**: Inter (Google Fonts) - for body text and UI
- Body Text: 16px / 18px, weight 400
- Labels/Captions: 14px, weight 500
- Buttons: 16px, weight 600

---

## Layout System

**Spacing Units**: Tailwind classes using 4, 6, 8, 12, 16, 20, 24 (e.g., p-4, gap-6, my-12)

**Container Strategy**:
- Full-width hero and gallery sections (w-full)
- Content sections: max-w-7xl mx-auto with px-6 lg:px-8
- Text content: max-w-3xl for optimal readability

**Grid Patterns**:
- Gallery: 1 column (mobile) / 2 columns (tablet) / 3 columns (desktop)
- Amenities: 2 columns (mobile) / 3-4 columns (desktop)
- Contact Section: 1 column stack (mobile) / 2 column split (desktop)

---

## Component Library

### Hero Section
- Full-viewport height (min-h-screen) with actual pool/villa image background
- Dark gradient overlay (bottom to top) for text legibility
- Centered content: Villa name, tagline ("10 minutes from Diani Beach"), price badge ($200/night), primary CTA
- Blurred-background "Book Now" button prominent at hero
- Subtle parallax scroll effect on background image

### Gallery Section
- Masonry-style grid with lightbox functionality
- Images: Pool (multiple angles), 3 bedrooms, kitchen, living room, bathrooms, covered patio, tropical garden
- Hover effect: Subtle zoom (scale 1.05) with smooth transition
- Caption overlays on hover with room names

### Amenities Section
- Icon-driven feature cards in responsive grid
- Icons from Heroicons: bed, wifi, tv, swimming pool, leaf (garden), user (caretaker), baby carriage (cot), map-pin (beach)
- Each card: Icon (40px), title (18px bold), brief description (14px)
- Clean white cards with subtle shadow on hover

### Contact Section
- Two-column layout (form left, info right on desktop)
- Left: Contact form with name, email, phone, dates, message fields
- Right: Contact card with Joseph's clickable phone (+254 714 389500), embedded Google Maps (Diani Coast), quick info bullets
- Form styling: Soft rounded inputs, ocean-blue focus states

### Booking CTAs
- Primary button: Solid ocean-blue background, white text, rounded-lg
- Secondary button: White with ocean-blue border and text
- Hover states: Subtle lift (translate-y-1) and shadow increase
- Placed strategically: Hero, after gallery, after amenities, before footer

### Footer
- Dark background (navy or charcoal)
- Three columns: Contact info (Joseph, phone), Quick links (Book on Airbnb, Location), Property highlights (beach proximity, pool, amenities)
- Social-proof element: Small trust badge or review snippet

---

## Color Palette Notes
(Colors specified later - focus on structure and hierarchy only in guidelines)

**Structural Roles**:
- Hero overlay: Dark gradient for contrast
- Section backgrounds: Alternating light/white for visual rhythm
- Buttons: Primary action color vs. secondary outline
- Footer: Darker contrast to main content

---

## Animations & Interactions

**On Scroll**:
- Fade-in + translate-y animations for section content (stagger elements slightly)
- Trigger when section enters 20% into viewport

**Gallery**:
- Smooth zoom on hover (transform: scale(1.05), duration 300ms)
- Lightbox: Fade-in overlay, slide-in image with smooth easing

**Buttons**:
- Hover: Subtle lift (-2px translate-y) + shadow increase
- Active: Press down effect
- Blurred backgrounds on buttons over images

**Performance**: Use CSS transforms and opacity only (GPU-accelerated)

---

## Images Section

**Hero Image**: 
Use the stunning pool photo with palm trees and sun loungers (primary hero background) - full-width, full-height with gradient overlay

**Gallery Images** (in order of prominence):
1. Pool area (multiple angles) - showcase the beautiful blue water, lounge chairs
2. Covered patio/outdoor lounge - elegant seating with blue cushions
3. Master bedroom - canopy bed with garden views
4. Additional bedrooms - showing queen beds and decor
5. Modern kitchen - breakfast bar and appliances
6. Living room - Smart TV entertainment wall
7. Bathrooms - modern showers and vanities
8. Tropical garden - lush greenery surrounding property

**Image Treatment**: 
- All images optimized for web (compressed but high quality)
- Consistent aspect ratios in gallery (3:2 or 4:3)
- Alt text describing each room/area for SEO

---

## Responsive Behavior

**Breakpoints**: Mobile-first approach using Tailwind's sm/md/lg/xl
- Mobile (<640px): Single column, stacked sections, touch-optimized buttons (min 44px)
- Tablet (640-1024px): 2-column grids, balanced spacing
- Desktop (>1024px): Full multi-column layouts, expanded hero

**Mobile Priorities**:
- Hero CTA immediately visible without scroll
- Gallery as swipeable carousel option
- Click-to-call phone number prominent
- Simplified navigation (hamburger menu)

---

## SEO & Accessibility

**Meta Tags**: "Luxury 3-bedroom villa Diani Beach Kenya | $200/night | Private pool"
**Alt Texts**: Descriptive for each image ("Modern bedroom with canopy bed and garden view at Legacy Holiday Home")
**Heading Hierarchy**: H1 (villa name), H2 (section titles), H3 (subsections)
**ARIA Labels**: Form inputs, buttons, navigation elements
**Color Contrast**: Ensure WCAG AA compliance for all text

---

## Conversion Optimization

- Multiple "Book Now" CTAs throughout journey
- Price transparency ($200/night) visible in hero
- Trust signals: Actual photos, contact info, Airbnb verification
- Urgency/scarcity: Optional availability calendar widget
- Social proof: Space for guest review snippets if available