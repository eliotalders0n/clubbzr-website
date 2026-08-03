**Comparison target**

- Source visual truth:
  - `/var/folders/5m/2w_f1fhd16l4x396kbx4bb4c0000gp/T/codex-clipboard-5RYicJ.png` (1340 × 198 px, admin location field)
  - `/var/folders/5m/2w_f1fhd16l4x396kbx4bb4c0000gp/T/codex-clipboard-tttMfs.png` (2752 × 1766 px, Community Map)
  - `/var/folders/5m/2w_f1fhd16l4x396kbx4bb4c0000gp/T/codex-clipboard-GYziNA.png` (2752 × 1542 px, Session Details)
- Implementation screenshot: unavailable after the final changes
- Intended viewport: authenticated desktop and mobile web application
- CSS size and density normalization: unavailable because the source screenshots include browser/device scaling and no matching implementation capture could be produced
- State: admin editing an in-person session; public Community Map with Sessions filter; published Session Details; signed-in Community post composer

**Primary interactions implemented**

- Select an existing Community Map place in Edit Session.
- Search Zambia-wide venues, landmarks, and addresses, then select a result to populate the pin and venue fields.
- Click the map or use device location to set custom session coordinates.
- Save coordinates, canonical place link, address, city, and map visibility on the session.
- Filter the Community Map to upcoming sessions and deep-link to a selected session marker.
- Open Session Details from the map and open Google Maps directions from session/map controls.
- Add an exact device location to a Community post only after checking the opt-in control.
- Display an opted-in post location as a Google Maps link.

**Full-view comparison evidence**

- The implementation reuses the existing near-black map, orange accent, rounded dark panels, Leaflet tiles, and existing session card language rather than introducing a new visual system.
- The Session Details map is placed in the available main-column space beneath the facilitator card, matching the supplied layout opportunity.
- The admin location field is replaced with a compact map-picker panel inside the existing Schedule & venue compartment.
- A browser-rendered post-change screenshot is unavailable, so responsive proportions, native focus treatment, map resize behavior, and authenticated states cannot be certified visually.

**Focused region comparison evidence**

- Admin picker: code includes saved-place suggestions, explicit external location search, result selection, map pin, device-location action, coordinate status, venue name, city, address, and Community Map visibility control.
- Community Map: code adapts published upcoming sessions into the existing map venue contract and adds a Sessions filter, marker detail actions, and deep-link focus state.
- Session Details: code includes an embedded Leaflet map, copy-address action, Community Map deep link, and Google Maps directions.
- Community composer: code includes explicit opt-in, permission/loading/error states, nearest known-place association, and post-level location display.
- These are code-backed checks and production-build evidence, not a rendered visual comparison.

**Findings**

- [P2] Browser-rendered visual evidence is missing
  Location: all four changed experiences.
  Evidence: no approved browser automation surface was available to capture the authenticated final implementation at matching desktop and mobile viewports.
  Impact: visual fidelity, map resizing, responsive wrapping, focus states, and console behavior remain unverified.
  Fix: capture the final authenticated states in the user's chosen browser at desktop and mobile widths, compare them against the supplied screenshots, and resolve any visible drift.

**Code verification**

- TypeScript project build: passed.
- Targeted ESLint checks: passed.
- Production Vite build: passed.
- Git whitespace validation: passed.
- Browser console errors checked: blocked because no browser-rendered implementation session was available.

**Implementation checklist**

- Capture Edit Session with the location picker open.
- Capture Community Map with Sessions selected and a session marker open.
- Capture Session Details with the embedded map at desktop and mobile widths.
- Capture Community post composer before and after location opt-in.
- Test denied geolocation, missing coordinates, online sessions, and sessions hidden from the map.
- Check console errors and Leaflet resize behavior in each modal/layout state.

**Comparison history**

- Iteration 1: text-only session location, no session map layer, no Session Details map, and no post-location opt-in.
- Fixes made: shared GeoPoint contract, reusable map-picker behavior, canonical place linking, upcoming session map entities, deep links, embedded session map, Google Maps directions, and opt-in post locations.
- Post-fix visual evidence: unavailable; code and production-build checks pass, but visual comparison remains blocked.

**Follow-up polish**

- Consider grouped markers when several upcoming sessions share the same venue after real session data is available.

final result: blocked
