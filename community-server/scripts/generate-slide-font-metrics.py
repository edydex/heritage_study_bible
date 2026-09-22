#!/usr/bin/env python3
"""Regenerate shared slide measurements. Requires fonttools 4.61+.

Run from the repository root: python community-server/scripts/generate-slide-font-metrics.py
The included OFL Noto Sans font is the same font used by SyncShow's native renderer.
"""
from pathlib import Path
import json
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parents[1]
font = root / "public/fonts/NotoSans-Variable.ttf"
metrics = {}
for weight in (400, 500, 600, 700):
    instance = instantiateVariableFont(TTFont(font), {"wght": weight})
    units = instance["head"].unitsPerEm
    metrics[str(weight)] = {str(code): round(instance["hmtx"][glyph][0] / units, 5)
                            for code, glyph in sorted(instance.getBestCmap().items())}
output = root / "packages/service-core/node/services/project/NotoSansMetrics.json"
output.write_text(json.dumps(metrics, separators=(",", ":")) + "\n")
print(output)
