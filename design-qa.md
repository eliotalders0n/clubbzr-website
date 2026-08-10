# Desktop artist creation action — design QA

## Source visual truth

- Reference: `/var/folders/5m/2w_f1fhd16l4x396kbx4bb4c0000gp/T/codex-clipboard-ZGeYyv.png`
- Target: retain the orange pill-shaped `Add Subversion` action, plus icon, spacing, and header placement while making it available on desktop for artists.

## Implemented state

- Removed the responsive rule that hid the action at desktop breakpoints.
- The action now renders at every viewport size when the signed-in member has an artist profile.
- Non-artist accounts do not receive the artist-only creation action.
- Existing mobile styling is preserved, with modest desktop sizing adjustments and a non-wrapping label.

## Automated QA

- Header ESLint: passed.
- TypeScript project build: passed.
- Production build: passed.
- Diff whitespace validation: passed.

## Visual QA

- The supplied reference was opened and inspected.
- A matching post-change screenshot could not be captured because the artist-only state requires an authenticated browser session unavailable in this environment.

## Final result

Blocked for visual sign-off. Static design review and automated verification pass, but authenticated rendered comparison is unavailable.
