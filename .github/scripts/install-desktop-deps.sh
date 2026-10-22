#!/usr/bin/env bash
# Install the Linux desktop runtime packages, reusing and refreshing the .deb cache directory given as $1.
set -euo pipefail
cache=$1
packages=(dbus-x11 x11-utils xvfb libgtk-3-0 libwebkit2gtk-4.1-0 libayatana-appindicator3-1 librsvg2-2)
mkdir -p "$cache/partial"
sudo apt-get update
sudo apt-get install -y --no-install-recommends -o Dir::Cache::Archives="$cache" "${packages[@]}"
sudo chown -R "$(id -u):$(id -g)" "$cache"
