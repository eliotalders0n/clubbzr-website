# Club BZR Design System

Club BZR uses a dark, editorial community interface with restrained surfaces, clear spacing, and orange as the primary action color. The design sources are `src/theme.ts` for Chakra UI 3 tokens and `src/styles/globals.css` for global CSS, fonts, and utility classes.

## Theme Sources

Use Chakra UI props and tokens first. Local CSS is reserved for app-wide primitives, typography helpers, animation utilities, and global browser styling.

- Chakra system: `src/theme.ts`.
- Global CSS and Tailwind v4 theme tokens: `src/styles/globals.css`.
- Local UI wrappers: `src/components/ui`.
- Layout primitives: `src/components/layout`.

## Color

Primary tokens:

- Background: `gray.950` / `#0A0A0A`.
- Surface: `gray.900`, `gray.800`, translucent black.
- Text: `#FAF9F6` for primary content.
- Muted text: white at 50 percent opacity or `gray.500`.
- Brand/action: `brand.500` / `#FF6B35`.

Supporting accents:

- Green for positive states, points, online indicators, and success.
- Red for destructive actions and error alerts.
- Purple/cyan/yellow for badge and creative-category accents.
- Blue remains available for focus rings and legacy utility buttons.

Avoid single-color pages. Keep orange as a focused signal for active navigation, primary CTAs, and selected filters.

## Typography

Fonts are loaded globally from Google Fonts:

- Heading/display: Space Grotesk.
- Body: Inter.
- Mono/stat detail: JetBrains Mono.

Use large display type only for landing or major feature headers. Cards, panels, admin tables, and feed modules should use tighter heading sizes that fit their container. Keep letter spacing neutral unless using the existing uppercase label style.

## Layout

The app uses a dark full-page background with cards and panels layered on top. Common patterns:

- Desktop pages use centered content with responsive max widths.
- Mobile views leave space for the fixed bottom navigation.
- Cards use dark surfaces, subtle borders, and generous internal padding.
- Filters use pill controls with `brand.500` for the selected state.
- Tables and admin lists should prefer dense but readable rows over oversized decorative cards.

Do not nest cards inside cards unless the inner card is a real repeated item, form section, or modal body.

## Navigation

Public/member navigation is split by viewport:

- Desktop: centered top navigation in `Header`.
- Mobile: compact top bar plus bottom navigation with icons.
- Authenticated avatar opens the account menu for Passport and sign out.
- Main member routes should stay consistent: Wall, Sessions, Quests, Artists, Exhibitions, Radio, Me/Passport.

Use icons from `lucide-react` for nav, actions, filters, and toolbar controls.

## Components

Buttons:

- Primary: brand orange fill, white text.
- Secondary: dark/transparent surface with subtle border.
- Destructive: red text or red surface only for irreversible actions.
- Icon buttons need accessible labels and should use Lucide icons.

Forms:

- Inputs use dark backgrounds, visible borders, and clear labels.
- Use selects for fixed option sets, checkboxes/toggles for binary choices, and segmented pills for filters.
- Never submit `undefined` to Firestore. Normalize optional numeric and string fields before create/update.

Feed cards:

- Community posts, quest completions, badge awards, and exhibition activity share the same dark card language.
- Media should have fixed aspect-ratio containers to avoid layout shift.
- Reaction and vote controls should give immediate state feedback.

Admin:

- Admin screens use the same dark theme but should be denser and more operational.
- Use `StatsCard`, `DataTable`, and admin layout components before introducing new admin primitives.
- Empty states should explain what is missing and expose the relevant create action.

## Motion and Media

Motion should support orientation, not hide basic app state. Use:

- Framer Motion for page or card transitions.
- GSAP/Lenis for higher-touch landing or scroll effects.
- Three.js/R3F only where a 3D scene is central to the experience.

Every media-heavy component needs a stable placeholder, fixed dimensions, and a fallback if the asset is missing.

## Accessibility and Responsiveness

- Keep focus states visible. Global focus uses blue outline.
- Preserve button labels or `aria-label` for icon-only actions.
- Test mobile widths around 390-430px and desktop widths above 1200px.
- Avoid horizontal overflow; wrap filters and action groups.
- Keep text inside cards/buttons readable and unclipped.
- Do not rely on hover-only interactions for core actions.
