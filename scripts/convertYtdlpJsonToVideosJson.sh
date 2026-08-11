#!/usr/bin/env bash

set -euo pipefail

INPUT_JSON=""
REMOVE_TIMESTAMP=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        -r)
            REMOVE_TIMESTAMP=true
            shift
            ;;
        -*)
            echo "Error: Unknown option: $1"
            exit 1
            ;;
        *)
            if [[ -n "$INPUT_JSON" ]]; then
                echo "Error: Multiple input files provided"
                exit 1
            fi

            INPUT_JSON="$1"
            shift
            ;;
    esac
done

if [[ -z "$INPUT_JSON" ]]; then
  echo "Error: Missing original json file"
  exit 1
fi

if [[ "${INPUT_JSON##*.}" != "json" ]]; then
  echo "Error: Path is not a .json file"
  exit 1
fi

if [[ ! -r "$INPUT_JSON" ]]; then
  echo "Error: File doesn't exist or cannot be read"
  exit 1
fi

if [[ "$REMOVE_TIMESTAMP" == true ]]; then
  OUTPUT_JSON="$(dirname "$INPUT_JSON")/videos.json"
else
  TIMESTAMP="$(date +%s%3N 2>/dev/null || printf '%s000' "$(date +%s)")"
  OUTPUT_JSON="$(dirname "$INPUT_JSON")/videos_${TIMESTAMP}.json"
fi

if jq -e '.entries[0] | has("entries")' "$INPUT_JSON" >/dev/null 2>&1; then
  # Entire channel: multiple categories, each containing videos
  JQ_INPUT='.entries | map(.entries[])'
elif jq -e 'has("entries")' "$INPUT_JSON" >/dev/null 2>&1; then
  # Specific tab: entries are already videos
  JQ_INPUT='.entries'
else
  # Single video: the root object itself is the video
  JQ_INPUT='[.]'
fi

jq "
$JQ_INPUT
| map({
    title,
    filename: .requested_downloads[0].filename,
    description,
    webpage_url,
    availability,
    upload_date:
      (
        if (.release_date == null or .release_date == \"\") then
          \"\"
        else
          (
            .release_date[0:4]
            + \"-\"
            + .release_date[4:6]
            + \"-\"
            + .release_date[6:8]
          )
        end
      )
  })
" "$INPUT_JSON" > "$OUTPUT_JSON"

echo "Successfully generated videos json file at \"$OUTPUT_JSON\""
