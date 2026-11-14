#!/usr/bin/env bash
# Safe staged deployment of ArcaneBook's isolated universal image-first mode.
# Must run as root on the existing Oracle VM. Does not touch previous jobs or YCT/ArcaneDrive.
set -Eeuo pipefail
if [ "$(id -u)" -ne 0 ]; then echo "Run as root: sudo bash $0"; exit 1; fi

SRC=/home/ubuntu/arcanebook-smart-preview
PROD=/home/ubuntu/arcanebook
CONVERTER=/opt/arcane-pdf2mock
SITE=/var/www/arcanebook
PY="$CONVERTER/.venv/bin/python"
BRANCH=feature/smart-pdf-to-mock
BACK=/home/ubuntu/arcane-universal-backups/$(date +%Y%m%d-%H%M%S)
STAGED=0

echo "=== VALIDATE CHECKOUT & TOOLS ==="
test -f "$SRC/package.json" && test -f "$SRC/oracle/universal_image_engine.py"
test -f "$PROD/server/oracle-api.js"
test -f "$CONVERTER/server.py"
test -x "$PY"
test -d "$SITE"
test "$(runuser -u ubuntu -- git -C "$SRC" branch --show-current)" = "$BRANCH" || {
  echo "Preview checkout must be on $BRANCH. No deployment performed."; exit 1;
}
if [ -n "$(runuser -u ubuntu -- git -C "$SRC" status --porcelain)" ]; then
  echo "Preview checkout has uncommitted changes; refusing to overwrite them."; exit 1;
fi

echo "=== UPDATE DEVELOPMENT CHECKOUT ==="
runuser -u ubuntu -- git -C "$SRC" fetch origin "$BRANCH"
runuser -u ubuntu -- git -C "$SRC" merge --ff-only "origin/$BRANCH"

echo "=== BUILD FRONTEND BEFORE TOUCHING PRODUCTION ==="
(
  cd "$SRC"
  runuser -u ubuntu -- npm ci --no-audit --no-fund
  runuser -u ubuntu -- npm run build
)
test -s "$SRC/dist/index.html"

echo "=== CHECK PYTHON SYNTAX AND IMPORTS ==="
"$PY" -m py_compile "$SRC/oracle/universal_image_engine.py" \
   "$SRC/oracle/universal_api.py" "$SRC/oracle/install_universal_api.py" \
   "$SRC/oracle/smart_pdf_analyzer.py"
"$PY" -c 'import fastapi, pymupdf; print("FastAPI and PyMuPDF available")'
"$PY" "$SRC/oracle/test_universal_image_engine.py" -v
runuser -u ubuntu -- node --check "$SRC/server/oracle-api.js"

echo "=== BACK UP LIVE FILES ==="
mkdir -p "$BACK"
cp -a "$CONVERTER/server.py" "$BACK/server.py"
cp -a "$PROD/server/oracle-api.js" "$BACK/oracle-api.js"
[ ! -f "$CONVERTER/smart_pdf_analyzer.py" ] || cp -a "$CONVERTER/smart_pdf_analyzer.py" "$BACK/smart_pdf_analyzer.py"
for f in universal_image_engine.py universal_api.py; do
  [ ! -f "$CONVERTER/$f" ] || cp -a "$CONVERTER/$f" "$BACK/$f"
done
cp -a "$SITE" "$BACK/site"
echo "Backup: $BACK"

rollback() {
  status=$?
  trap - ERR
  if [ "$STAGED" -eq 1 ]; then
    echo "ERROR during deployment; restoring backed-up API and frontend."
    cp -a "$BACK/server.py" "$CONVERTER/server.py"
    cp -a "$BACK/oracle-api.js" "$PROD/server/oracle-api.js"
    [ ! -f "$BACK/smart_pdf_analyzer.py" ] || cp -a "$BACK/smart_pdf_analyzer.py" "$CONVERTER/smart_pdf_analyzer.py"
    for f in universal_image_engine.py universal_api.py; do
      if [ -f "$BACK/$f" ]; then cp -a "$BACK/$f" "$CONVERTER/$f"; else rm -f "$CONVERTER/$f"; fi
    done
    cp -a "$BACK/site/." "$SITE/"
    systemctl restart arcane-pdf2mock || true
    systemctl restart arcanebook-api || true
  fi
  echo "Deployment stopped. Backup remains at $BACK"
  exit "$status"
}
trap rollback ERR

STAGED=1
echo "=== STAGE ISOLATED FASTAPI ROUTES ==="
install -m 0644 "$SRC/oracle/universal_image_engine.py" "$CONVERTER/universal_image_engine.py"
install -m 0644 "$SRC/oracle/universal_api.py" "$CONVERTER/universal_api.py"
install -m 0644 "$SRC/oracle/smart_pdf_analyzer.py" "$CONVERTER/smart_pdf_analyzer.py"
"$PY" "$SRC/oracle/install_universal_api.py" --server "$CONVERTER/server.py" --apply
"$PY" -m py_compile "$CONVERTER/server.py" "$CONVERTER/universal_api.py" "$CONVERTER/universal_image_engine.py"

echo "=== RESTART & VERIFY CONVERTER ==="
systemctl restart arcane-pdf2mock
sleep 3
systemctl is-active --quiet arcane-pdf2mock
curl --fail --silent --show-error --max-time 12 http://127.0.0.1:8765/healthz > /dev/null
"$PY" - <<'PY'
import json, urllib.request
spec=json.load(urllib.request.urlopen("http://127.0.0.1:8765/openapi.json",timeout=12))
for route in ("/api/jobs", "/api/analyze", "/api/universal/jobs",
              "/api/universal/jobs/{jobid}/html",
              "/api/universal/jobs/{jobid}/zip"):
    assert route in spec.get("paths", {}), f"Missing API route: {route}"
print("Verified: legacy routes preserved and universal routes registered.")
PY

echo "=== RESTART & VERIFY NODE PROXY ==="
install -m 0644 "$SRC/server/oracle-api.js" "$PROD/server/oracle-api.js"
systemctl restart arcanebook-api
sleep 2
systemctl is-active --quiet arcanebook-api
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8787/api/converter-settings > /dev/null
code="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 http://127.0.0.1:8787/api/universal/jobs/0123456789abcdef)"
[ "$code" = 403 ] || { echo "Expected admin-only HTTP 403, got $code"; false; }
echo "Verified: Node API healthy, universal mode admin-only."

echo "=== DEPLOY FRONTEND (NO DESTRUCTIVE --delete) ==="
cp -a "$SRC/dist/." "$SITE/"
test -s "$SITE/index.html"
echo "DEPLOYMENT_SUCCESS"
echo "Backup location: $BACK"
echo "Website: https://arcanebook.duckdns.org"
echo "Other Oracle services and previous conversion jobs were not changed."
