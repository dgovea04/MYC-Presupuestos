# Landing Phase 4 Visual Consistency Design

## Context

The MYC Presupuestos landing page is already advanced and has strong section-level design work across hero, features, preview, comparison, testimonials, pricing, CTA, and footer.

The next phase should not introduce a new visual direction. It should consolidate the current direction into a more coherent system so the page feels intentionally designed end-to-end rather than individually polished section by section.

This phase is limited to landing-page marketing surfaces and should not affect dashboard architecture, business logic, or existing non-landing application workflows.

## Goal

Improve visual consistency across the landing page while preserving the current premium B2B SaaS tone inspired by Linear, Stripe, Retool, and Notion.

The page should feel:

- More systematized
- More editorial and intentional
- More rhythmically balanced while scrolling
- More cohesive between light sections, product mockups, and dark contrast blocks

## Non-Goals

- No redesign of the landing information architecture
- No copywriting rewrite beyond small consistency fixes
- No new dependencies
- No architecture changes outside landing components
- No large behavior changes or animation-first redesign

## Design Direction

The approved direction is a contrast-driven editorial system.

This means:

- Light sections remain the default reading surface
- Product-centric sections share a premium elevated treatment
- Dark sections remain contrast anchors for emphasis and conversion
- Repeated visual primitives should feel shared across the page

The landing should not flatten into one uniform look. It should keep contrast, but the contrast must feel deliberate and system-based.

## Visual System

### 1. Section Rhythm

Normalize vertical rhythm across the page so section transitions feel predictable and premium.

Requirements:

- Section outer spacing should follow a tighter shared pattern instead of each section using a slightly different cadence
- Spacing between section heading and content grid should be standardized
- Chips, intro rows, and support metadata should align to consistent top margins
- The scroll experience should avoid abrupt density jumps between adjacent sections

### 2. Surface Hierarchy

Use three surface levels only.

#### Surface Default

For standard light-background sections and neutral reading zones.

Characteristics:

- White or near-white backgrounds
- Minimal gradient tinting
- Soft border definition

#### Surface Elevated

For premium marketing cards and product mockups.

Characteristics:

- Large rounded corners
- Thin cool-toned borders
- Controlled shadows
- Subtle gradient or radial highlight where appropriate

This surface should be reused across hero mockup, feature cards, testimonials, preview panels, comparison container, and pricing cards.

#### Surface Contrast

For high-emphasis dark blocks such as benefits, highlighted pricing, and final CTA.

Characteristics:

- Deep navy base
- Restrained blue/cyan glow
- Low-noise internal contrast
- No overly glossy or noisy effects

### 3. Shape Language

Establish a consistent shape system.

Requirements:

- Large containers should share a narrow radius range
- Secondary cards inside mockups should share another narrow radius range
- Pills, badges, and chips should feel like one family across all sections
- Avoid having similar components with noticeably different corner intent unless there is a clear semantic reason

### 4. Shadow Language

Current shadows are generally premium but not fully normalized.

Requirements:

- Use a small set of shadow intensities
- Elevated light cards should feel soft and controlled, not dramatic
- Hero and product containers may carry the strongest depth, but still within the same family
- Dark surfaces should rely more on contrast and less on heavy shadows

### 5. Typography and Heading Rhythm

Section headings should feel more unified.

Requirements:

- `SectionHeading` becomes the canonical structure for badge, title, and description rhythm
- Heading widths should stay within a consistent readable range
- Title scale should stay premium but not produce uneven jumps between sections
- Description widths should be controlled to preserve readability and avoid floating lines

Hero remains the top-of-page exception in scale, but it should still visually relate to the section-heading system.

### 6. Accent and CTA Consistency

Blue accents should behave more consistently across the page.

Requirements:

- Badges should share closer visual weight
- Information chips should not compete with primary CTAs
- CTA prominence should be governed by clear hierarchy rather than section-by-section variation
- Dark sections should not invent a separate button language unless necessary

## Section-by-Section Intent

### Hero

Keep hero as the most expansive and aspirational section.

Adjustments should focus on:

- Better alignment between left editorial content and right product mockup
- Stronger continuity between hero mockup internals and preview/comparison surfaces
- More consistent chip treatment under the primary CTA row

### Features

Features should define the premium light-card language.

Adjustments should focus on:

- Consistent padding and density
- Stronger alignment with testimonials in visual grammar
- Slightly more repeatable internal hierarchy between icon, title, body, divider, and footer row

### Product Preview

Product Preview should serve as the strongest "product proof" section.

Adjustments should focus on:

- Establishing it as the primary elevated product container
- Aligning its internal cards and side panels to the same shape and surface system used elsewhere
- Keeping the table technical, compact, and premium without adding noise

### Comparison

Comparison should feel like a sibling to Product Preview, not a separate mini-system.

Adjustments should focus on:

- Matching preview-level container intent
- Harmonizing header treatment and table density
- Making the MYC highlight feel integrated rather than isolated

### Benefits

Benefits should remain a dark contrast section, but should connect more clearly to the same overall system.

Adjustments should focus on:

- Reusing spacing and radius logic from light cards
- Keeping contrast premium and restrained
- Preserving readability and avoiding over-stylization

### Testimonials

Testimonials should share the same premium-card DNA as Features.

Adjustments should focus on:

- Parallel spacing, halo treatment, and border/shadow behavior
- Consistent badge and avatar treatment with the broader landing system

### Pricing

Pricing should feel balanced with the hero and preview sections in quality and confidence.

Adjustments should focus on:

- Normalizing the non-highlighted cards with the shared elevated surface language
- Keeping the Pro card as the dark focal plan while visually linking it to Benefits and Final CTA
- Making plan hierarchy feel structural, not decorative

### Final CTA

Final CTA should act as the high-conviction close of the page.

Adjustments should focus on:

- Connecting its dark treatment to the highlighted Pro card and Benefits section
- Keeping the action row crisp and uncluttered
- Preserving strong contrast without looking detached from the rest of the system

### Footer

Footer should stay simple and quiet.

Adjustments should focus on:

- Smoother visual handoff from Final CTA
- Consistent spacing and typography rhythm
- No unnecessary decoration

## Implementation Boundaries

Work is expected in these files only unless a minor landing support change is required:

- `app/page.tsx`
- `app/globals.css`
- `components/landing/section-heading.tsx`
- `components/landing/hero-section.tsx`
- `components/landing/features-section.tsx`
- `components/landing/product-preview-section.tsx`
- `components/landing/comparison-section.tsx`
- `components/landing/benefits-section.tsx`
- `components/landing/testimonials-section.tsx`
- `components/landing/pricing-section.tsx`
- `components/landing/final-cta-section.tsx`
- `components/landing/landing-footer.tsx`
- `components/landing/landing-link-button.tsx` if needed for CTA normalization

Avoid touching unrelated application code during this phase.

## Validation Criteria

The phase is successful when:

- The landing scroll feels visually coherent from hero to footer
- Headings feel like part of one system
- Light cards and product surfaces feel related
- Dark contrast sections feel intentional and connected
- CTA emphasis is consistent
- No section feels like it belongs to a different landing page iteration
- Existing responsiveness and current content structure remain intact

## Execution Order

1. Normalize section rhythm and `SectionHeading`
2. Normalize shared surface tokens through class usage and selective global helpers if needed
3. Align Hero, Product Preview, and Comparison
4. Align Features, Testimonials, and Pricing
5. Refine Benefits, Final CTA, and Footer transitions
6. Run lint and visually verify final consistency
