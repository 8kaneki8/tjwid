from html.parser import HTMLParser
from pathlib import Path
import re

class IdCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []

    def handle_starttag(self, tag, attrs):
        self.ids.extend(value for key, value in attrs if key == "id" and value)

html = Path("index.html").read_text(encoding="utf-8")
app = Path("app.js").read_text(encoding="utf-8")
worker = Path("service-worker.js").read_text(encoding="utf-8")
parser = IdCollector()
parser.feed(html)

duplicates = sorted({item for item in parser.ids if parser.ids.count(item) > 1})
assert not duplicates, f"Duplicate HTML ids: {duplicates}"
missing = sorted(set(re.findall(r'\\$\\(["\\']([^"\\']+)["\\']\\)', app)) - set(parser.ids))
assert not missing, f"JavaScript references missing DOM ids: {missing}"

required_controls = [
    "todayPages", "visitedPages", "dailyGoal", "dailyProgress",
    "dailyGoalText", "bookmarksSelect", "repeatSelect"
]
assert all(f'id="{item}"' in html for item in required_controls)
assert 'const ASR_API_URL = "";' in app, "Do not enable unconfigured audio recognition."
assert "recordPageVisit(target)" in app
assert "preserveRepeat: true" in app
assert "api.quran.com/api/v4/" in app
assert "tajweed-quran-data-v1" in worker
print("Site integrity checks passed.")
