#!/usr/bin/env bash
# Rebuild one MariaDB client bundle under assets/tools/ from the vendor's
# official package repository.
#
#   tools/refresh-mariadb-bundle.sh <bundle> <arch>
#     <bundle>  10.6 | 12.3 | 13.0
#     <arch>    amd64 | arm64
#
# The package version is pinned per bundle below rather than resolved as "the
# newest patch of this line", so two architectures refreshed a week apart get
# the same build. Bundles differ in three dimensions — repository, suite and
# package naming — which is why the table exists instead of one URL template.
#
# Packages are unpacked, never installed: no emulation is needed to build the
# arm64 tree on an amd64 host, and the result does not depend on what the
# build host already has installed.
set -euo pipefail

BUNDLE="${1:-}"
ARCH="${2:-}"

case "$BUNDLE" in
  10.6)
    # MariaDB 10.6 predates the mariadb-* binary names, so the real programs are
    # still mysql and mysqldump; the package splits the client per release line.
    REPO="10.6/ubuntu"; POOL="mariadb-10.6"; PKG_VERSION="10.6.28+maria~ubu2204"
    PACKAGES=("mariadb-client-10.6" "mariadb-client-core-10.6")
    SRC_CLIENT="usr/bin/mysql"; SRC_DUMP="usr/bin/mysqldump"
    ;;
  12.3)
    REPO="12.3/debian"; POOL="mariadb"; PKG_VERSION="12.3.3+maria~deb12"
    PACKAGES=("mariadb-client" "mariadb-client-core")
    SRC_CLIENT="usr/bin/mariadb"; SRC_DUMP="usr/bin/mariadb-dump"
    ;;
  13.0)
    REPO="13.0/ubuntu"; POOL="mariadb"; PKG_VERSION="13.0.2+maria~ubu2204"
    PACKAGES=("mariadb-client" "mariadb-client-core")
    SRC_CLIENT="usr/bin/mariadb"; SRC_DUMP="usr/bin/mariadb-dump"
    ;;
  *)
    echo "usage: $0 <10.6|12.3|13.0> <amd64|arm64>" >&2
    exit 2
    ;;
esac

case "$ARCH" in
  amd64) ARCH_KEY="x64" ;;
  arm64) ARCH_KEY="arm" ;;
  *) echo "usage: $0 <10.6|12.3|13.0> <amd64|arm64>" >&2; exit 2 ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$REPO_ROOT/assets/tools/$ARCH_KEY/mariadb/mariadb-$BUNDLE/bin"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# dpkg-deb is the documented way to unpack a .deb; ar plus tar is the same
# archive read by hand, for hosts that do not ship dpkg.
extract_deb() {
  local deb="$1" root="$2"
  if command -v dpkg-deb >/dev/null; then
    dpkg-deb -x "$deb" "$root"
    return
  fi
  local member
  member="$(ar t "$deb" | grep '^data\.tar')"
  case "$member" in
    *.zst) ar p "$deb" "$member" | zstd -dc | tar -x -C "$root" ;;
    *.xz)  ar p "$deb" "$member" | xz  -dc  | tar -x -C "$root" ;;
    *.gz)  ar p "$deb" "$member" | gzip -dc | tar -x -C "$root" ;;
    *) echo "unhandled data member: $member" >&2; return 1 ;;
  esac
}

mkdir -p "$WORK/root"
for package in "${PACKAGES[@]}"; do
  url="https://mirror.mariadb.org/repo/$REPO/pool/main/m/$POOL/${package}_${PKG_VERSION}_${ARCH}.deb"
  echo "==> $url"
  curl -fsSL -o "$WORK/$package.deb" "$url"
  sha256sum "$WORK/$package.deb"
  extract_deb "$WORK/$package.deb" "$WORK/root"
done

mkdir -p "$DEST"
install -m 0755 "$WORK/root/$SRC_CLIENT" "$DEST/mariadb"
install -m 0755 "$WORK/root/$SRC_DUMP"   "$DEST/mariadb-dump"

echo
echo "Installed into $DEST"
sha256sum "$DEST/mariadb" "$DEST/mariadb-dump"
