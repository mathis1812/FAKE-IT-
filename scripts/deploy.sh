#!/usr/bin/env bash
# Déploie Bluminoo Studio sur Vercel sans étape de link interactive.
# Usage : VERCEL_TOKEN=xxx bash scripts/deploy.sh [production|preview]
set -euo pipefail

# Identifiants du projet Vercel (ce ne sont pas des secrets).
export VERCEL_ORG_ID="${VERCEL_ORG_ID:-team_yNFjT6yNziiW6JOib0nMA4pk}"
export VERCEL_PROJECT_ID="${VERCEL_PROJECT_ID:-prj_GrOn3wUCgREMHByZlNgvVLQ2uvJz}"

TARGET="${1:-production}"

if [ -z "${VERCEL_TOKEN:-}" ]; then
  cat >&2 <<'MSG'
VERCEL_TOKEN manquant.

1. Créez un token sur https://vercel.com/account/tokens (scope : mathisvrg's projects)
2. Exposez-le :
   - en local        : export VERCEL_TOKEN=xxx
   - agents Cursor   : Cursor Dashboard > Cloud Agents > Secrets > VERCEL_TOKEN
   - GitHub Actions  : Settings > Secrets and variables > Actions > VERCEL_TOKEN
MSG
  exit 1
fi

case "$TARGET" in
  production)
    ENVIRONMENT="production"
    PROD_FLAG="--prod"
    ;;
  preview)
    ENVIRONMENT="preview"
    PROD_FLAG=""
    ;;
  *)
    echo "Cible inconnue : $TARGET (attendu: production ou preview)" >&2
    exit 1
    ;;
esac

VERCEL="npx --yes vercel@latest"

echo "==> Récupération de la config ($ENVIRONMENT)"
$VERCEL pull --yes --environment="$ENVIRONMENT" --token="$VERCEL_TOKEN"

echo "==> Build"
# shellcheck disable=SC2086
$VERCEL build $PROD_FLAG --token="$VERCEL_TOKEN"

echo "==> Déploiement"
# shellcheck disable=SC2086
$VERCEL deploy --prebuilt $PROD_FLAG --token="$VERCEL_TOKEN"
