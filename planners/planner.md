UI/UX & Design System Audit

Site: izanami-official.com | Type: Luxury/wellness brand site (School × Craft × Retreat) — Japan/Dubai based

*Note on methodology: I analyzed the full rendered HTML/class architecture directly. The external stylesheet (compiled/hashed filename) wasn't retrievable, so exact hex values below are estimated from the SVG fills, image/asset naming, and visual conventions the code strongly implies (white-on-imagery, editorial minimalism) rather than read verbatim from CSS. Flagged where relevant.

1. Visual Identity & Brand Feel
Overall mood: Editorial minimalism with a luxury/spiritual undertone — closer to a high-end fashion or wellness-retreat site than a typical corporate page. Think "quiet, ritualistic, cinematic."
Brand personality: Contemplative, ancestral, premium. Copy like "Remember who you are" and references to Shinto shrines, Wa (和/harmony), and ceremonial retreat signal a brand built on restraint rather than loud selling.
Emotional tone: Calm, reverent, slow-paced. The single full-bleed hero statement, generous whitespace implied by the sparse markup, and slow scroll-triggered reveals (data-text-animation, data-title-scroll-animation) all reinforce a meditative pacing rather than urgency/conversion-driven design.
2. Color System
Primary: White (fill="white" used throughout the logo/icon SVGs) against what is almost certainly a dark or deep-toned background (typical of this genre — near-black, deep charcoal, or muted indigo) based on the choice to render all logo/nav iconography in pure white.
Secondary: A muted neutral gray (
#D9D7D4-equivalent, seen literally in the WhatsApp/Instagram icon fills) — a warm off-white/stone tone, consistent with a natural, paper-like palette rather than pure black-and-white contrast.
Accent: No visible saturated accent color in the markup (no obvious brand-blue/gold class names) — this reinforces a monochrome + photography-led palette where color comes from the imagery (WebP photography of nature/clouds/architecture) rather than UI chrome.
Background layering: Multiple stacked visual layers per section — a base background image, a WebGL canvas overlay (data-webgl="canvas", data-webgl="nav-canvas"), and cloud/parallax elements (homeHeader_clouds) — creating atmospheric depth rather than flat color blocking.
Light vs dark balance: Dark-leaning UI chrome (nav, footer, buttons) with light/airy photographic sections — a common "editorial luxury" seesaw.
Gradient usage: Not explicit in class names, but the WebGL canvas + cloud imagery strongly suggests soft atmospheric gradients are handled via imagery/shader rather than CSS gradients.
Contrast quality: Likely high for text-on-dark (white text), but decorative/label text (label, small caps "philosophy", "projects") is probably lower-contrast by design — a stylistic choice common in luxury sites that intentionally under-contrasts secondary text for elegance over strict WCAG AA compliance.
3. Typography System
Font categories: At least two custom type families are loaded via class prefixes: pfd_* (likely a serif/display face — "pfd" possibly "proportional display font") for large headline moments, and cz_*/sm_* for body/label text (condensed or sans). This dual-family system (display serif + utility sans) is the classic luxury-editorial pairing.
Heading hierarchy: Aggressive scale jump — hero/section headlines use R50_H100 / R40_H100 (interpreted as ~50px/40px, 100% line-height) sizing classes vs. labels at R11_H100–R20_H100 (~11–20px). That's a wide hierarchy gap, typical of statement-led design.
Font weight usage: Class names show both M14 (Medium?) and R20/R30 (Regular) variants — light-to-medium weights dominate; no evidence of heavy/black weights, reinforcing the soft, non-shouty brand voice.
Line height: Tight for display type (H100 = 100% line-height, common for large serif headlines), looser for body copy (H180, H200, H240 = 180–240% line-height) — a deliberate airy reading rhythm for paragraphs vs. compressed impact type for headlines.
Text density: Airy overall — short paragraph blocks (2–3 sentences), lots of <br> for manual line-breaking (controlling exact line wraps, very common in premium editorial sites where line breaks are art-directed, not left to browser reflow).
4. Layout & Grid Structure
Container style: Boxed content within an .inner wrapper, but full-bleed backgrounds/imagery break out edge-to-edge — a hybrid "boxed content, full-bleed atmosphere" pattern.
Grid system: Not a classic 12-column grid — this is a sticky-scroll storytelling layout. Sections use sticky_sub (persistent label) + sticky_main (scrolling content) pairs, meaning each section is structured as a two-part composition (fixed label anchor + moving content) rather than a symmetrical grid.
Spacing rhythm: Class naming (R11, R12, R14, R16, R18, R20, R24, R26, R30, R40, R50) suggests a fairly fine-grained type/spacing scale — likely built on a 2px or 4px base unit rather than a coarse 8px system, given the density of intermediate steps (11, 14, 16, 18...).
Section segmentation: Each major section (homeHeader, homePhilosophy, homeProjects, homeCompany) is a self-contained full-viewport block with its own label, headline, description, and CTA — a repeating template pattern.
Content alignment: Primarily left-aligned text blocks with number/label prefixes ("01 School", "02 Craft", "03 Retreat") — an editorial magazine-index feel.
Visual hierarchy: Label (small caps, low emphasis) → Large serif statement → Supporting paragraph → Text-link button, repeated consistently — a very disciplined, repeatable content hierarchy across all sections.
5. Component Breakdown
Navbar: Custom hamburger-style trigger (openTrigger) rather than a traditional horizontal nav bar — full-screen overlay nav pattern (nav_canvas with its own WebGL background), common in high-end sites. Includes a language switcher (EN/JA) styled as a small circular toggle.
Hero: Full-bleed background image + WebGL cloud parallax layers + a single centered/left statement headline ("Remember who you are") — text-first, minimal-chrome hero, no visible nav bar overlapping it prominently, no big CTA button in the hero itself.
Buttons: Text-based "line buttons" — a text label with an underline (button_line) that animates on hover (data-button-hover), not filled/pill buttons. This is a deliberately understated CTA style ("View Philosophy", "View Projects") — links dressed as buttons rather than boxed UI buttons.
Cards: No traditional bordered/shadowed cards — content is presented as full sticky sections with image + text pairs (stickySection_img, stickySection_text), essentially "slide"-like compositions rather than grid cards.
Forms/inputs: None visible on this page — contact is handled via a dedicated /contact/ page and WhatsApp/Instagram links in the footer, not an inline form.
Footer: Multi-column structure — nav links, social links (WhatsApp/Instagram with custom SVG icons), dual-location address block (Dubai + Tokyo), live dual-timezone clocks (GST/JST), copyright, and "back to top" link. Notably rich for a footer — functions almost as a secondary sitemap + brand-location statement.
CTA patterns: Consistent "label + underline-hover text link" pattern reused across every section — no button-style CTAs at all, reinforcing brand restraint.
6. Depth, Effects & Visual Enhancements
Shadows: No evidence of drop-shadow classes — depth is created through layering and imagery, not box-shadows. This is consistent with a flat/editorial rather than skeuomorphic design language.
Border radius: No visible rounded-corner classes on buttons/cards — likely sharp/minimal radii throughout, matching the serif/editorial tone (rounded corners would clash with the formal aesthetic here).
Glass/neumorphism: None apparent — this is a flat, photography-and-typography-driven design, not a glassmorphic UI.
Glow/highlight: The button_line hover-line animation and nav_linkCircle dot elements act as the primary "highlight" language — subtle geometric micro-accents rather than glow effects.
Iconography: Custom-drawn SVG symbol sprite (logo, WhatsApp, Instagram, quotation mark) — bespoke, not an icon font/library. Clean, single-color (white/stone), minimal line work.
Photography style: WebP imagery of nature (clouds, sky), architecture/interiors, likely soft, muted, editorial-toned photography — reinforced by .webp naming like home_fv_img, home_projects_img01-03, home_philosophy_img01-03.
7. Interaction & Animation Style
Hover effects: Text "clone" hover animation pattern — data-clone-element="target/item" with data-link-hover="text" suggests a duplicate-text-slide hover effect (classic "text swaps upward on hover" micro-interaction used heavily in agency/portfolio sites).
Scroll animations: Heavy use of scroll-triggered reveals — data-text-animation, data-title-scroll-animation, data-clouds-scroll-animation, staggered data-pc-animation-delay/data-sp-animation-delay values (0.6s, 0.7s, 0.8s...) — sequential cascading reveal timing, a signature of high-production agency sites (likely built with GSAP or similar).
Microinteractions: Animated nav circle dots, animated underline buttons, a numeric loading counter (loader_number counting 0→100%) before page reveal.
Transition smoothness: Page transitions handled by Swup (id="swup", data-no-swup attributes) — a JS library for smooth SPA-style page transitions on a traditional multi-page site, plus a dedicated .transition overlay element.
Motion personality: Slow, deliberate, cinematic — staggered delays in the 0.6–1.8 second range across nav items indicate intentionally unhurried choreography, not snappy/instant UI feedback.
8. Responsiveness Strategy
Mobile layout: Distinct SP (smartphone) vs PC asset/class pairs throughout (data-sp-img-path vs data-pc-img-path, SP_cz_R11_H100 vs cz_R14_H100 class pairs) — this is art-directed responsive design, not just fluid reflow. Separate images and separate type scales are served per breakpoint, not just scaled versions of the same asset.
Navbar collapse: Full-screen overlay menu (already overlay-based even on desktop via the hamburger trigger) — likely near-identical behavior between mobile and desktop, just resized.
Font scaling: Explicit dual class sets per breakpoint (SP_-prefixed sizes are consistently smaller than their PC counterparts) rather than relying on clamp()/fluid typography — a controlled, fixed-breakpoint scaling approach.
Content stacking: Sticky sections likely convert to standard vertical stacking on mobile (image above/below text) rather than maintaining the sticky-scroll effect, given the separate SP image variants.
9. Technical Estimation
Frontend framework: Not React/Vue in the traditional SPA sense — this looks like a Vite-built static site (/assets/js/index.PhJuwueo.js, /assets/css/index.By0AFpwc.css hashed filenames are classic Vite output) with vanilla JS or a lightweight framework, using Swup for page transitions.
CSS methodology: BEM-like naming (homeHeader_title, stickySection_img, nav_linkLine) — a disciplined block__element convention, hand-authored rather than utility-first (no Tailwind-style atomic classes visible).
Animation libraries: Strong signals of GSAP (ScrollTrigger-style data attributes, staggered delays) plus a custom WebGL layer (likely Three.js or a lightweight WebGL wrapper, given data-webgl="canvas" and mesh-manager attributes like data-mesh-manager="common-img-mesh" — suggesting a custom shader-based image reveal/parallax system).
Performance considerations: WebP images throughout (good), but the combination of WebGL canvases + GSAP scroll animations + custom loader is inherently heavier than a typical marketing site — likely trading some performance/accessibility for cinematic effect (common tradeoff in awards-site-style builds, e.g. Awwwards-targeted agency work).
10. Rebuild Blueprint
Plain HTML/CSS approach
- Use CSS custom properties for the type/spacing scale (--fs-11 through --fs-50)
- IntersectionObserver for scroll-reveal (fade + translateY)
- position: sticky for the label/content split sections
- Separate <picture> sources for SP/PC art direction
Tailwind CSS approach
- Extend tailwind.config with the custom type scale as fontSize tokens
- Use sticky top-0 for sticky_sub, min-h-screen for each section
- group-hover: + translate utilities for the underline button hover
- aspect-ratio utilities for consistent image containers
React approach
- Framer Motion (whileInView) to replace GSAP ScrollTrigger reveals
- react-swup or a custom page-transition wrapper for the SPA-feel navigation
- react-three-fiber if you want to keep the WebGL cloud/mesh backgrounds
- A single <Section label headline description cta image /> component reused across Philosophy/Projects/Company
Minimal hero example (HTML/CSS)
html
<section class="hero">
  <div class="hero__bg">
    <img src="/img/hero.webp" alt="" />
  </div>
  <h1 class="hero__title">Remember who you are</h1>
</section>

<style>
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: flex-end;
  padding: 4rem 2rem;
}
.hero__bg {
  position: absolute;
  inset: 0;
  z-index: -1;
}
.hero__bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hero__title {
  font-family: "YourDisplaySerif", serif;
  font-weight: 400;
  font-size: clamp(1.75rem, 4vw, 3.125rem);
  line-height: 1;
  color: #fff;
  letter-spacing: 0.01em;
}
</style>