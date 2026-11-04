#!/bin/bash
# Runs on PreToolUse for Bash, gated to git commit commands in settings.json.
# This is a hard backstop: it runs regardless of what Claude decides.
#
# HONEST LIMITATION: the regex fallback below only catches obvious,
# well-known secret formats (AWS keys, PEM headers, simple key=value
# patterns). It will miss anything obfuscated, base64-wrapped, or in
# a format it doesn't recognize. Treat it as a tripwire, not a
# security control.
#
# If gitleaks is installed, we use that instead — it's an actual
# maintained secret scanner with hundreds of provider-specific rules.
# Install: https://github.com/gitleaks/gitleaks

if command -v gitleaks >/dev/null 2>&1; then
  if ! gitleaks protect --staged --no-banner; then
    echo "🔴 BLOCKED: gitleaks found a likely secret in staged changes."
    echo "Remove it (use .env / a secrets manager) before committing."
    exit 1
  fi
  exit 0
fi

echo "⚠️  gitleaks not found — falling back to basic pattern match."
echo "   This fallback WILL miss non-obvious secrets. Consider"
echo "   installing gitleaks: https://github.com/gitleaks/gitleaks"

PATTERNS='(AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|api[_-]?key["\s:=]+["\047][A-Za-z0-9]{16,}|secret["\s:=]+["\047][A-Za-z0-9]{16,}|password["\s:=]+["\047][^"\047]{8,})'

MATCHES=$(git diff --cached | grep -inE "$PATTERNS")

if [ -n "$MATCHES" ]; then
  echo "🔴 BLOCKED: possible secret found in staged changes:"
  echo "$MATCHES"
  echo "Remove the secret (use .env / a secrets manager) before committing."
  exit 1
fi

exit 0
