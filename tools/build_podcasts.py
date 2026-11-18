#!/usr/bin/env python3
"""
Делает снимок подкастов NASA для BM (js/podcasts-data.js).
Материалы NASA — работы правительства США и не защищены авторским правом в США.
Приложение и само подгружает свежие выпуски из этих RSS-лент прямо в браузере;
снимок нужен, чтобы список появлялся мгновенно и работал без интернета к лентам.
Запуск: python3 tools/build_podcasts.py
"""
import json, os, re, html, urllib.request, xml.etree.ElementTree as ET

SHOWS = [
    ("houston-we-have-a-podcast", "Хьюстон, у нас подкаст", "Разговоры с астронавтами, инженерами и учёными Космического центра имени Джонсона."),
    ("curious-universe", "Любопытная Вселенная", "Истории о космосе, Земле и науке от исследователей NASA."),
    ("small-steps-giant-leaps", "Маленькие шаги, гигантские скачки", "Как NASA строит миссии: инженерия, уроки и неудачи изнутри."),
    ("gravity-assist", "Гравитационный манёвр", "Планетолог Джим Грин говорит с учёными о планетах, звёздах и поиске жизни."),
    ("nasa-in-silicon-valley", "NASA в Кремниевой долине", "Исследовательский центр Эймса: авиация, роботы, суперкомпьютеры и биология."),
]
FEED = "https://www.nasa.gov/feeds/podcasts/{}"
NS = {"itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd"}
KEEP = 40


def text(s, n=300):
    s = html.unescape(re.sub(r"<[^>]+>", " ", s or ""))
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= n else s[: n - 1].rsplit(" ", 1)[0] + "…"


def dur(s):
    if not s:
        return 0
    parts = [int(float(x)) for x in s.strip().split(":") if x.strip()]
    sec = 0
    for p in parts:
        sec = sec * 60 + p
    return sec


def main():
    shows = []
    for slug, ru, ru_desc in SHOWS:
        req = urllib.request.Request(FEED.format(slug), headers={"User-Agent": "Mozilla/5.0 (BM podcast snapshot)"})
        resp = urllib.request.urlopen(req, timeout=30)
        final_url = resp.geturl()  # после редиректа: у конечного адреса есть CORS для браузера
        ch = ET.fromstring(resp.read()).find("channel")
        img = ch.find("itunes:image", NS)
        image = img.get("href") if img is not None else ch.findtext("image/url")
        eps = []
        for it in ch.findall("item"):
            enc = it.find("enclosure")
            if enc is None or not enc.get("url"):
                continue
            eps.append({
                "title": text(it.findtext("title"), 160),
                "date": it.findtext("pubDate") or "",
                "src": enc.get("url"),
                "duration": dur(it.findtext("itunes:duration", namespaces=NS)),
                "desc": text(it.findtext("description") or it.findtext("itunes:summary", namespaces=NS)),
            })
        shows.append({
            "id": slug, "feed": final_url, "title": ch.findtext("title"), "titleRu": ru,
            "descRu": ru_desc, "image": image, "total": len(eps), "episodes": eps[:KEEP],
        })
        print(f"{slug}: {len(eps)} выпусков")
    path = os.path.join(os.path.dirname(__file__), "..", "js", "podcasts-data.js")
    with open(path, "w", encoding="utf-8") as f:
        f.write("// Сгенерировано tools/build_podcasts.py — подкасты NASA (не защищены авторским правом в США).\n")
        f.write("window.BM_PODCASTS = " + json.dumps(shows, ensure_ascii=False, indent=1) + ";\n")


if __name__ == "__main__":
    main()
