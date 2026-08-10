#!/bin/bash

for file in *.webp *.png; do
    [ -e "$file" ] || continue

    output="${file%.*}.jpeg"

    ffmpeg -i "$file" "$output"
done

echo "Done"
