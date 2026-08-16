#!/usr/bin/env bash

set -euo pipefail

# Requires:
# - ffmpeg (standard build with libx264 support)
#
# Verify libx264 support:
#   ffmpeg -encoders | grep libx264

shopt -s nullglob

for input in *.webm *.mkv; do
  # Skip if no matching files exist
  [[ -e "$input" ]] || continue

  filename="${input%.*}"
  output="${filename}.mp4"

  # Skip if MP4 already exists
  if [[ -f "$output" ]]; then
    echo "Skipping: '$input'"
    continue
  fi

  echo "Converting: '$input'"

  ffmpeg -hide_banner -loglevel info \
    -i "$input" \
    -c:v libx264 \
    -preset slow \
    -crf 23 \
    -c:a aac \
    -b:a 192k \
    -movflags +faststart \
    "$output"

  echo "Done: '$output'"
done

echo "All conversions completed."
