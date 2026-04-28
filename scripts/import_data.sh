#!/usr/bin/env bash
# Import menu data from an external directory into a Menu Editor location.
#
# Usage:
#   ./scripts/import_data.sh <source_path> <location_id>
#
# Examples:
#   ./scripts/import_data.sh ../GAC-Menu/data garden-grove
#   ./scripts/import_data.sh /home/danlnguyen/GAC/GAC-Menu/data garden-grove
#
# Requires: backend running on localhost:8100, curl, python3

set -euo pipefail

BACKEND_URL="${BACKEND_URL:-http://localhost:8100}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-changeme123}"

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <source_path> <location_id>"
  echo ""
  echo "  source_path   Path to data directory containing menu.json / facts.json"
  echo "  location_id   Target location slug (e.g. garden-grove)"
  exit 1
fi

SOURCE_PATH="$1"
LOCATION_ID="$2"

# Resolve relative path to absolute
if [[ ! "$SOURCE_PATH" = /* ]]; then
  SOURCE_PATH="$(cd "$SOURCE_PATH" 2>/dev/null && pwd)"
fi

echo "=== GAC Menu Editor — Data Import ==="
echo "Source:   $SOURCE_PATH"
echo "Location: $LOCATION_ID"
echo "Backend:  $BACKEND_URL"
echo ""

# Get auth token
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

# Run import
echo "Importing data..."
RESULT=$(curl -sf -X POST "$BACKEND_URL/api/v1/locations/$LOCATION_ID/import" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"source_path\": \"$SOURCE_PATH\"}")

# Pretty-print results
echo ""
echo "$RESULT" | python3 -c '
import sys, json
r = json.load(sys.stdin)
print(f"Location: {r[\"location_id\"]}")
print(f"Source:   {r[\"source\"]}")
print()
if "menu" in r:
    m = r["menu"]
    print(f"Menu:     {m.get(\"imported\", 0)} imported, {m.get(\"skipped\", 0)} skipped")
if "facts" in r:
    f = r["facts"]
    print(f"Facts:    {f.get(\"imported\", 0)} imported, {f.get(\"skipped\", 0)} skipped")
if "images" in r:
    i = r["images"]
    print(f"Images:   {i.get(\"copied\", 0)} copied")
print()
print("Done.")
'
