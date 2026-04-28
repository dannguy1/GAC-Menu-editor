#!/usr/bin/env bash
# Clear all data (menu, facts, images) for a Menu Editor location.
#
# Usage:
#   ./scripts/clear_location.sh <location_id> [--menu-only | --facts-only | --images-only]
#
# Examples:
#   ./scripts/clear_location.sh garden-grove          # Clear everything
#   ./scripts/clear_location.sh garden-grove --menu-only
#   ./scripts/clear_location.sh garden-grove --images-only
#
# Requires: backend running on localhost:8100, curl, python3

set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8100}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-changeme123}"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <location_id> [--menu-only | --facts-only | --images-only]"
  echo ""
  echo "  location_id   Location slug to clear (e.g. garden-grove)"
  echo ""
  echo "Options:"
  echo "  --menu-only    Clear only menu items"
  echo "  --facts-only   Clear only facts"
  echo "  --images-only  Clear only images"
  echo "  (default)      Clear everything"
  exit 1
fi

LOCATION_ID="$1"
shift

# Default: clear everything
CLEAR_MENU=true
CLEAR_FACTS=true
CLEAR_IMAGES=true

# Parse optional flags
if [[ $# -gt 0 ]]; then
  CLEAR_MENU=false
  CLEAR_FACTS=false
  CLEAR_IMAGES=false
  for arg in "$@"; do
    case "$arg" in
      --menu-only)   CLEAR_MENU=true ;;
      --facts-only)  CLEAR_FACTS=true ;;
      --images-only) CLEAR_IMAGES=true ;;
      *) echo "Unknown option: $arg"; exit 1 ;;
    esac
  done
fi

echo "=== GAC Menu Editor — Clear Location Data ==="
echo "Location: $LOCATION_ID"
echo "Backend:  $BACKEND_URL"
echo "Clear:    menu=$CLEAR_MENU  facts=$CLEAR_FACTS  images=$CLEAR_IMAGES"
echo ""

# Confirmation prompt
read -rp "This will permanently delete data. Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Get auth token
echo ""
echo "Authenticating..."
TOKEN=$(curl -sf "$BACKEND_URL/api/v1/auth/token" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

if [[ -z "$TOKEN" ]]; then
  echo "ERROR: Failed to authenticate. Check credentials and backend."
  exit 1
fi
echo "Authenticated."

# Call clear endpoint
echo "Clearing data..."
RESULT=$(curl -sf -X POST "$BACKEND_URL/api/v1/locations/$LOCATION_ID/clear" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"clear_menu\": $CLEAR_MENU, \"clear_facts\": $CLEAR_FACTS, \"clear_images\": $CLEAR_IMAGES, \"confirm\": true}")

# Pretty-print results
echo ""
echo "=== Results ==="
echo "$RESULT" | python3 -m json.tool
echo ""
echo "Done."
