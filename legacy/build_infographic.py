"""Rebuild the V3 infographic from the five city JSON files.
Usage: python3 build_infographic.py   (run in the folder with 01_*.json ... 05_*.json)
"""
import json, glob
data = [json.load(open(f, encoding="utf-8")) for f in sorted(glob.glob("0[1-5]_*.json"))]
payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
html = open("infographic_template.html", encoding="utf-8").read().replace("/*DATA*/[]", payload)
open("japan_2027_infographic.html", "w", encoding="utf-8").write(html)
print("built", len(html) // 1024, "KB from", len(data), "files")
