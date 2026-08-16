#!/usr/bin/env bash

set -euo pipefail

# Requires:
# - ffmpeg compiled with NVENC support
# - NVIDIA drivers installed
#
# Verify NVENC support:
#   ffmpeg -encoders | grep nvenc

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
    -hwaccel cuda \
    -i "$input" \
    -c:v h264_nvenc \
    -preset p5 \
    -rc vbr \
    -cq 23 \
    -b:v 0 \
    -c:a aac \
    -b:a 192k \
    -movflags +faststart \
    "$output"

  echo "Done: '$output'"
done

echo "All conversions completed."
