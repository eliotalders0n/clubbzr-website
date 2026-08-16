# Shared discovery hero — design QA

## Source visual truth

- Primary reference: `/var/folders/5m/2w_f1fhd16l4x396kbx4bb4c0000gp/T/codex-clipboard-uSVJan.png`
- Source pixel dimensions: 2010 × 378.
- Target: apply the Discover Work hero's typography, left alignment, spacing, and compact density to Side Quests, Sessions, and Radio.
- Supporting before-state references:
  - Side Quests: `/var/folders/5m/2w_f1fhd16l4x396kbx4bb4c0000gp/T/codex-clipboard-9oJR9g.png`
  - Sessions: `/var/folders/5m/2w_f1fhd16l4x396kbx4bb4c0000gp/T/codex-clipboard-KGCfZT.png`
  - Radio: `/var/folders/5m/2w_f1fhd16l4x396kbx4bb4c0000gp/T/codex-clipboard-GaRJFG.png`

## Implementation evidence

- Routes: `/quests`, `/sessions`, and `/radio`.
- Source files: `src/pages/Quests.tsx`, `src/pages/Sessions.tsx`, and `src/pages/Radio.tsx`.
- Intended desktop viewport: approximately 2048 × 650 CSS px at device scale factor 1.
- Intended responsive viewport: 390 × 844 CSS px at device scale factor 1.
- Implementation screenshot: unavailable because no browser capture surface is exposed in this session.
- Density normalization: not performed because an implementation screenshot could not be captured.

## Full-view comparison

- The source and before-state screenshots were inspected.
- A browser-rendered post-change screenshot could not be captured, so the required combined visual comparison is blocked.

## Focused region comparison

- Target region: the eyebrow, H1, supporting copy, and surrounding hero whitespace.
- Code now shares the reference values: 112px desktop main offset, 1680px container, 8–10 spacing-unit horizontal inset, 0.18em eyebrow tracking, 3.5rem maximum H1, 0.98 heading line-height, and 5–6 spacing-unit bottom margin.
- Side Quests retains its interactions as compact right-side utilities rather than a tall centered CTA row.
- Visual comparison remains blocked without rendered evidence.

## Fidelity surfaces

- Fonts and typography: the existing heading family is preserved; all three pages now use the reference responsive H1 scale, weight context, line-height, eyebrow size, and supporting-copy scale.
- Spacing and layout rhythm: heroes are left aligned, use the same container/insets, and replace 12–16 spacing-unit bottom gaps with the reference 5–6 units.
- Colors and visual tokens: the existing brand orange eyebrow, white heading, and white-alpha supporting copy match the source tokens.
- Image quality and asset fidelity: the hero contains no raster imagery or custom assets; page content imagery below it is unchanged.
- Copy and content: each page keeps its existing title and supporting copy. Side Quests retains both primary actions.

## Findings

- No code-level P0/P1/P2 issue remains.
- Visual sign-off is blocked because post-change browser screenshots are unavailable.

## Comparison history

- Initial P1: Side Quests was centered, CTA-heavy, and substantially taller than the reference.
- Initial P1: Sessions and Radio used 5rem headings, wider tracking, deeper margins, and larger horizontal insets than the reference.
- Fix: standardized the hero container, alignment, type scale, line-height, eyebrow styling, and spacing across all three pages; moved Side Quests actions into a compact utility position.
- Post-fix evidence: production build, targeted ESLint, and whitespace validation pass; browser-rendered evidence is unavailable.

## Primary interactions and console checks

- Side Quests Explore and Random Prompt handlers remain connected by code inspection.
- Browser interaction testing: blocked by unavailable browser surface.
- Browser console check: blocked by unavailable browser surface.

## Final result

final result: blocked

Blocker: a browser-rendered implementation screenshot is unavailable for the required source-versus-implementation comparison.
