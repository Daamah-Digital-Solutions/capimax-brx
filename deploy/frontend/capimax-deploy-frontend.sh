#!/bin/sh
# Build the Capimax BRX frontend and publish it atomically.
#  1. (root) git pull in /opt/capimax-brx — the same checkout the backend runs from.
#  2. (user capimax) export that commit into a clean /opt/capimax-frontend/app, npm ci, build.
#  3. Copy dist into /var/www/capimax-brx/releases/<time>, then switch the "current" symlink
#     nginx serves in one step. The last 5 releases are kept; roll back with:
#       ln -sfn /var/www/capimax-brx/releases/<older> /var/www/capimax-brx/current
# Usage: capimax-deploy-frontend.sh [--no-pull]
set -eu
REPO=/opt/capimax-brx
BUILD=/opt/capimax-frontend/app
WWW=/var/www/capimax-brx
STAMP=$(date -u +%Y%m%d%H%M%S)
[ "${1:-}" = "--no-pull" ] || git -C "$REPO" pull --ff-only -q
COMMIT=$(git -C "$REPO" log --oneline -1)
rm -rf "$BUILD" && install -d -o capimax -g capimax "$BUILD"
git -C "$REPO" archive HEAD | su -s /bin/sh capimax -c "tar -x -C $BUILD"
su -s /bin/sh capimax -c "
  set -e
  export PATH=/opt/node/bin:\$PATH HOME=/opt/capimax-frontend
  set -a; . /etc/capimax/frontend.env; set +a
  cd $BUILD
  npm ci --no-audit --no-fund --loglevel=error
  npx vite build --logLevel warn
"
test -f "$BUILD/dist/index.html"
mkdir -p "$WWW/releases/$STAMP"
cp -a "$BUILD/dist/." "$WWW/releases/$STAMP/"
chown -R root:root "$WWW/releases/$STAMP" && chmod -R a+rX "$WWW/releases/$STAMP"
ln -sfn "$WWW/releases/$STAMP" "$WWW/current.new" && mv -Tf "$WWW/current.new" "$WWW/current"
ls -1dt "$WWW"/releases/* | tail -n +6 | xargs -r rm -rf
echo "frontend deployed: $STAMP ($COMMIT)"
