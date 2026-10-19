#!/usr/bin/env python3
"""Regenerate shared slide measurements. Requires fonttools 4.61+.

Run from the repository root: python community-server/scripts/generate-slide-font-metrics.py
Liberation Sans is the bundled Arial-compatible fallback used by SyncShow.
"""
from pathlib import Path
import json
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
font_root = root / "public/fonts"
metrics = {}
for weight in (400, 500, 600, 700):
    instance = TTFont(font_root / ("LiberationSans-Regular.ttf" if weight < 600 else "LiberationSans-Bold.ttf"))
    units = instance["head"].unitsPerEm
    metrics[str(weight)] = {str(code): round(instance["hmtx"][glyph][0] / units, 5)
                            for code, glyph in sorted(instance.getBestCmap().items())}
output = root / "packages/service-core/node/services/project/ArialCompatibleMetrics.json"
output.write_text(json.dumps(metrics, separators=(",", ":")) + "\n")
print(output)
