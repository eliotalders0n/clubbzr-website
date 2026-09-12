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

---

# Payments and Lenco accounts — design QA

## Source visual truth

- Current production/reference capture: `/var/folders/5m/2w_f1fhd16l4x396kbx4bb4c0000gp/T/codex-clipboard-W4LclC.png`.
- Source pixel dimensions: 2031 × 1244.
- Target route: `/admin/payments`.
- Requested change: preserve the reference information architecture and operational density while replacing its incomplete light/purple treatment with the Club BZR system black/orange theme.

## Implementation evidence

- Source files: `src/pages/admin/Payments.tsx`, `lib/adminPayments.ts`, `functions/src/index.ts`, and `firebase/firestore.rules`.
- Production frontend build passes.
- Targeted frontend ESLint passes for all changed frontend TypeScript files.
- Cloud Functions TypeScript build, ESLint, and tests pass.
- Implementation screenshot: unavailable because no browser capture surface is exposed in this session.
- Intended desktop viewport: 2031 × 1244 CSS px at device scale factor 1.
- Density normalization: not performed because an authenticated implementation screenshot could not be captured.

## Functional fidelity

- Accounts shows the authoritative current and available Lenco balance separately from cash and other external funds.
- Transactions uses live provider rows with type/status filters, search, pagination, and CSV export.
- Cash and external receipts require an explicit payment method and never mutate the Lenco balance.
- Reconciliation reports unmatched Lenco inflows and unmatched local online collections without automatically changing either ledger.
- Historical externally paid records remain unclassified unless backed by an explicit receipt.

## Fidelity surfaces

- Fonts and typography: the existing Space Grotesk/Inter/JetBrains Mono system remains intact, with the reference hierarchy and compact data labels preserved.
- Spacing and layout rhythm: the reference header, two-column account area, four-card metric grid, tab row, dense records, responsive wrapping, radii, and shadows are preserved in code.
- Colors and visual tokens: the canvas is now `#0a0a0a`, surfaces `#171717`/`#1f1f1f`, primary text `#faf9f6`, borders use translucent white, and active controls use `brand.500`/`#FF6B35`. Semantic green, red, and warning states remain distinct on dark surfaces.
- Image quality and asset fidelity: this screen contains no raster or custom image assets; Lucide remains the existing icon library.
- Copy and content: account, balance, revenue, receipts, reconciliation, withdrawal, and return labels are preserved.

## Full-view and focused comparison

- The reference screenshots were inspected and used as the visual source of truth.
- Code inspection confirms that the incomplete purple accents and light page/modal surfaces were replaced across the full screen, including tabs, actions, cards, filters, rows, status chips, and form controls.
- Post-change source-versus-rendered comparison, authenticated interaction testing, density normalization, and browser console checks are blocked because no permitted browser capture surface is available.

## Findings

- No code-level P0/P1/P2 issue remains after the theme pass.
- Visual sign-off remains blocked until the new callable functions and frontend are deployed or an authenticated local admin session can be captured.

## Comparison history

- Initial P1: the payments canvas and cards used a light palette that conflicted with the black/orange admin shell.
- Initial P1: selected tabs and primary actions used an unrelated purple accent; one primary action also had low-contrast dark text.
- Fix: applied the established Club BZR dark surfaces, borders, foregrounds, orange actions, focus-compatible controls, and dark modal/form treatments throughout the route.
- Post-fix evidence: production build, targeted frontend ESLint, Functions build/lint/tests, and whitespace checks pass; browser-rendered evidence is unavailable.

## Primary interactions and console checks

- Tab switching, search, pagination, filters, balance visibility, CSV export, refresh, modal open/close, collection, external receipt, withdrawal, reconciliation, and return handlers remain connected by code inspection.
- Browser interaction testing: blocked by unavailable authenticated browser surface.
- Browser console check: blocked by unavailable browser surface.

## Final result

final result: blocked

Blocker: a browser-rendered authenticated implementation screenshot is unavailable for the required side-by-side visual comparison.

---

# User management operational ledger — design QA

## Source visual truth

- Selected ImageGen direction: `artifacts/user-management-audit/selected-operational-ledger.png`.
- Source pixel dimensions: 1487 × 1058.
- Target route: `/admin/users`.
- Target state: desktop users table with Mapesho Kalela's management drawer open on Access.

## Implementation evidence

- Primary UI: `src/pages/admin/ManageUsers.tsx`.
- Supporting behavior: `src/lib/rbac.ts`, `functions/src/admin/callables.ts`, `functions/src/core/accessPolicy.ts`, `src/contexts/AuthContext.tsx`, `firebase/firestore.rules`, and `storage.rules`.
- Intended CSS viewport: 1440 × 1024 at device scale factor 1.
- Local preview: running on port 4173; the route returns HTTP 200.
- Browser-rendered screenshot: unavailable because no permitted browser connector is exposed in this session.
- Density normalization: not possible without the implementation capture.

## Full-view comparison

- The selected reference was inspected at original resolution.
- The implementation follows the reference's slim summary strip, compact filter row, dense grouped table, single row overflow action, and right-edge management drawer.
- A combined source/implementation image comparison is blocked by the missing browser capture.

## Focused region comparison

- Table: the source hierarchy is represented by User, Access, Account, Last seen, Participation, Joined, and one overflow action.
- Drawer: the source identity header, five tabs, access cards, effective-permissions list, warning, danger zone, and sticky save footer are implemented.
- Responsive behavior: the desktop table switches to user rows on smaller screens and the drawer becomes full width.
- Pixel-level typography, spacing, wrapping, and focus-state comparison remains blocked.

## Fidelity surfaces

- Fonts and typography: existing Space Grotesk/Inter application typography is retained, with compact 12–16px operational text and restrained headings.
- Spacing and layout rhythm: selected summary strip, grouped table, lightweight dividers, 42px avatars, compact rows, and 52%-maximum drawer are represented in code.
- Colors and visual tokens: near-black canvas, `#101010` surfaces, warm white text, translucent separators, `brand.500` orange actions, and semantic green/amber/blue/red states match the selected direction.
- Image quality and assets: existing user avatars are used directly; missing avatars use the existing initial fallback. Lucide, already installed in the project, supplies UI icons.
- Copy and content: account state, onboarding/invitation state, last sign-in, last product activity, confirmed sessions, completed quests, submissions, permissions, and audit labels reflect the corrected data model.

## Functional verification

- Root production build passes.
- Targeted frontend ESLint passes for all files changed by this user-management work.
- Cloud Functions build and lint pass.
- All six Cloud Functions tests pass, including new access-policy coverage.
- Firestore rules compile successfully in the Firebase emulator.
- Browser interaction testing and console inspection are blocked by the unavailable authenticated browser surface.

## Findings

- No code-level P0/P1/P2 issue remains from static verification.
- Visual and interaction sign-off remains blocked until the authenticated screen can be captured in a permitted browser.

## Comparison history

- Initial P1: account state was inferred from onboarding and mapped Pending to a frozen account.
- Initial P1: last activity silently fell back to profile edits or account creation.
- Initial P1: profile, access, and status saves could partially succeed across three concurrent calls.
- Initial P1: suspend/close did not disable Firebase Authentication or revoke refresh tokens.
- Initial P1: private user documents were readable to every authenticated member.
- Fixes: separated account/invitation/onboarding state; added server-recorded activity and Auth metadata; consolidated user updates; synchronized Auth, private/public profiles, claims, wallet state, and audit logs; hardened rules; replaced private matchmaking reads with public profiles; implemented the selected table/drawer design.
- Post-fix evidence: builds, targeted lint, Functions tests, and Firestore rule compilation pass. Browser-rendered evidence remains unavailable.

## Final result

final result: blocked

Blocker: no permitted authenticated browser capture is available for the required source-versus-implementation comparison.
