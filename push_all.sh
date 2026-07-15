#!/bin/bash
find . -type f -not -path "*/\.git/*" -not -path "*/node_modules/*" | sort | while read -r file; do
  if [[ -n $(git status -s "$file") ]]; then
    echo "Processing $file..."
    git add "$file"
    git commit -m "Analyze and integrate $file into architecture"
    git push origin main
  fi
done
