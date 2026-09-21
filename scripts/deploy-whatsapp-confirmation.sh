#!/usr/bin/env bash
#
# Deploy the session-confirmation WhatsApp functions.
#
# The template in Meta and the code in this repo have to agree on how many
# body variables a confirmation sends. They flip at different moments — the
# template when Meta approves an edit, the code when you deploy — and any
# send in between fails with (#132000) number of parameters does not match.
# This refuses to deploy while they disagree.
#
# Usage:
#   scripts/deploy-whatsapp-confirmation.sh --check   # verify only
#   scripts/deploy-whatsapp-confirmation.sh           # verify, build, deploy

set -euo pipefail

PROJECT="club-bzr"
WABA_ID="2088929658724482"
GRAPH_VERSION="v25.0"
FUNCTIONS=(
  adminSendSessionConfirmationWhatsApp
  notifyOnSessionRegistrationUpdate
  notifyAdminsOnSessionRegistration
)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$REPO_ROOT/functions/src/index.ts"
CHECK_ONLY=false
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=true

# --- what the code expects -------------------------------------------------

TEMPLATE_NAME="$(sed -n 's/.*process\.env\.WHATSAPP_CONFIRMATION_TEMPLATE_NAME || "\([^"]*\)".*/\1/p' "$SOURCE")"
if [[ -z "$TEMPLATE_NAME" ]]; then
  echo "FAIL: could not read the configured template name from $SOURCE" >&2
  exit 1
fi

SHAPE="$(sed -n "s/^  ${TEMPLATE_NAME}: \"\([a-z]*\)\",$/\1/p" "$SOURCE")"
if [[ -z "$SHAPE" ]]; then
  echo "FAIL: $TEMPLATE_NAME is not declared in" \
       "WHATSAPP_CONFIRMATION_TEMPLATE_SHAPES; add it before deploying." >&2
  exit 1
fi

case "$SHAPE" in
  compact) EXPECTED_VARS=3 ;;
  detailed) EXPECTED_VARS=6 ;;
  *) echo "FAIL: unknown template shape '$SHAPE'" >&2; exit 1 ;;
esac

echo "code:     $TEMPLATE_NAME -> $SHAPE ($EXPECTED_VARS body variables)"

# --- what Meta actually has ------------------------------------------------

TOKEN="$(gcloud secrets versions access latest \
  --secret=WHATSAPP_ACCESS_TOKEN --project="$PROJECT")"

TEMPLATE_JSON="$(curl -sf \
  "https://graph.facebook.com/${GRAPH_VERSION}/${WABA_ID}/message_templates?name=${TEMPLATE_NAME}&limit=20" \
  -H "Authorization: Bearer ${TOKEN}")"
unset TOKEN

PARSE_TEMPLATE=$(cat <<'PY'
import json, os, re, sys

wanted = os.environ["TEMPLATE_NAME"]
payload = json.load(sys.stdin)
match = next(
    (t for t in payload.get("data", []) if t.get("name") == wanted), None
)

if match is None:
    print("MISSING - - 0")
    raise SystemExit

body = next(
    (c for c in match.get("components", []) if c.get("type") == "BODY"), {}
)
variables = {int(n) for n in re.findall(r"{{(\d+)}}", body.get("text") or "")}

print(
    match.get("status", "?"),
    match.get("category", "?"),
    match.get("language", "?"),
    len(variables),
)
PY
)

read -r LIVE_STATUS LIVE_CATEGORY LIVE_LANGUAGE LIVE_VARS <<<"$(
  printf '%s' "$TEMPLATE_JSON" |
    TEMPLATE_NAME="$TEMPLATE_NAME" python3 -c "$PARSE_TEMPLATE"
)"

echo "meta:     $TEMPLATE_NAME -> $LIVE_STATUS / $LIVE_CATEGORY /" \
     "$LIVE_LANGUAGE ($LIVE_VARS body variables)"

# --- gate ------------------------------------------------------------------

fail() { echo "FAIL: $1" >&2; exit 1; }

[[ "$LIVE_STATUS" == "MISSING" ]] &&
  fail "$TEMPLATE_NAME does not exist in this WABA. Sends would return (#132001)."
[[ "$LIVE_STATUS" == "APPROVED" ]] ||
  fail "$TEMPLATE_NAME is $LIVE_STATUS, not APPROVED. Wait for review to finish."
[[ "$LIVE_LANGUAGE" == "en_US" ]] ||
  fail "$TEMPLATE_NAME is $LIVE_LANGUAGE; the code sends en_US. Sends would return (#132001)."
[[ "$LIVE_VARS" == "$EXPECTED_VARS" ]] ||
  fail "the code sends $EXPECTED_VARS body variables but the template declares $LIVE_VARS. Sends would return (#132000)."

if [[ "$LIVE_CATEGORY" != "UTILITY" ]]; then
  echo "WARN:     category is $LIVE_CATEGORY, not UTILITY — frequent" \
       "recipients will be dropped with (#131049)." >&2
fi

echo "ok:       template and code agree"
if [[ "$CHECK_ONLY" == true ]]; then
  echo "check only, not deploying"
  exit 0
fi

# --- deploy ----------------------------------------------------------------

( cd "$REPO_ROOT/functions" && npm run build )

TARGETS="$(printf ",functions:%s" "${FUNCTIONS[@]}")"
firebase deploy --project "$PROJECT" --only "${TARGETS:1}"
