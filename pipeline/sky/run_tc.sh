#!/bin/bash
export OMNI_KEY=sk-0af3771bac770e6d-d1c5c5-7bfad1b2
cd /home/rade/projects/runecast/pipeline/sky
for job in "tc_back /tmp/tc_back.png tc_back.txt" "tc_front /tmp/tc_front.png tc_front.txt" "tc_gatebg /tmp/tc_gatebg.png tc_gatebg.txt"; do
  set -- $job
  echo "=== START $1 $(date +%T) ==="
  python3 gpt.py "$2" "$3" 1024x1536 ref_map.png 2>&1 | tail -3
  echo "=== END $1 exit=$? $(date +%T) ==="
done
echo "ALL DONE"
