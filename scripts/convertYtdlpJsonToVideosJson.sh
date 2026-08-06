#!/usr/bin/env bash

set -euo pipefail

INPUT_JSON="${1:-}"

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

TIMESTAMP="$(date +%s%3N 2>/dev/null || printf '%s000' "$(date +%s)")"
OUTPUT_JSON="$(dirname "$INPUT_JSON")/videos_${TIMESTAMP}.json"

if jq -e '.entries[0] | has("entries")' "$INPUT_JSON" >/dev/null 2>&1; then
    JQ_INPUT='.entries | map(.entries[])'
else
    JQ_INPUT='.entries'
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
        if (.upload_date == null or .upload_date == \"\") then
          \"\"
        else
          (
            .upload_date[0:4]
            + \"-\"
            + .upload_date[4:6]
            + \"-\"
            + .upload_date[6:8]
          )
        end
      )
  })
" "$INPUT_JSON" > "$OUTPUT_JSON"

echo "Successfully generated videos json file at \"$OUTPUT_JSON\""
