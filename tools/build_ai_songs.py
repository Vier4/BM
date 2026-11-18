#!/usr/bin/env python3
"""
Собирает песни с вокалом, созданные ИИ (Suno, Udio), с Wikimedia Commons.
Все они помечены там как общественное достояние: произведения, созданные ИИ,
не охраняются авторским правом в США (шаблон PD-algorithm), а стихи взяты
у авторов, умерших более 70 лет назад.
Результат: js/ai-songs-data.js. Запуск: python3 tools/build_ai_songs.py
"""
import json, os, re, time, urllib.error, urllib.parse, urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "BM-catalog-builder/1.0 (static music app)"

# (файл на Commons, название в BM, язык, стиль, оттенок обложки)
SONGS = [
    ("1904-Drtavert-Zvezdam.webm", "Звёздам (стихи Петра Драверта)", "русский", "баллада", 230),
    ("Absurdopedian Anthem.ogg", "Гимн Абсурдопедии", "русский", "гимн", 0),
    ("Two Planets.mp3", "Two Planets", "английский", "поп", 260),
    ("Chasing Dawn.mp3", "Chasing Dawn", "английский", "блюграсс", 35),
    ("Drifting Without Sound by Captain and The Daytrippers.ogg", "Drifting Without Sound", "английский", "инди-рок", 200),
    ("Sudden Light - Suno - Dante Gabriel Rossetti.wav", "Sudden Light (стихи Россетти)", "английский", "баллада", 300),
    ("Humans Behind the Knowledge.wav", "Humans Behind the Knowledge", "английский", "поп", 150),
    ("WikiWarriors (AI-generated music with Wikipedia lyrics).mp3", "WikiWarriors", "английский", "рейв", 180),
    ("The Rise of the ClueBots (AI-generated music).mp3", "The Rise of the ClueBots", "английский", "синтвейв", 320),
    ("Der Erlkönig.wav", "Der Erlkönig (стихи Гёте)", "немецкий", "баллада", 15),
    ("Sucr C3 A9 20Bonheur 20ext 20v1.1.1.mp3", "Sucré Bonheur", "французский", "квебекский фолк", 45),
    ("Terra Picasso Farfalla.oga", "Terra Picasso Farfalla", "итальянский", "поп", 120),
    ("Redaktor Wiedzy.ogg", "Redaktor Wiedzy", "польский", "хеви-метал", 350),
    ("Pulikkottum Panamthengem.ogg", "Pulikkottum Panamthengem", "малаялам", "фолк", 90),
]


def get(params):
    q = urllib.parse.urlencode({**params, "format": "json", "formatversion": 2})
    req = urllib.request.Request(API + "?" + q, headers={"User-Agent": UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 5:
                raise
            time.sleep(int(e.headers.get("Retry-After") or 0) or 5 * (attempt + 1))


def main():
    titles = ["File:" + s[0] for s in SONGS]
    pages = {}
    for i in range(0, len(titles), 20):
        d = get({
            "action": "query", "titles": "|".join(titles[i:i + 20]),
            "prop": "imageinfo|videoinfo", "iiprop": "extmetadata", "iiextmetadatafilter": "LicenseShortName",
            "viprop": "url|size|derivatives",
        })
        norm = {n["to"]: n["from"] for n in d["query"].get("normalized", [])}
        for p in d["query"]["pages"]:
            pages[norm.get(p["title"], p["title"])] = p
    out = []
    for fname, title, lang, style, hue in SONGS:
        p = pages.get("File:" + fname)
        if not p or "missing" in p:
            print("  ! нет на Commons:", fname)
            continue
        lic = ((p.get("imageinfo") or [{}])[0].get("extmetadata", {}).get("LicenseShortName", {}) or {}).get("value", "")
        if not re.match(r"(public domain|pd|cc0)", lic, re.I):
            print("  ! лицензия не подходит:", fname, lic)
            continue
        vi = (p.get("videoinfo") or [{}])[0]
        ogg = next((x["src"] for x in vi.get("derivatives", []) if "vorbis" in x.get("type", "") and x["src"] != vi["url"]), None)
        out.append({
            "id": "ai" + str(p["pageid"]), "title": title, "artist": f"ИИ-вокал · {style}", "lang": lang,
            "src": vi["url"].split("?")[0], "ogg": ogg, "duration": round(vi.get("duration") or 0), "hue": hue,
            "page": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(p["title"].replace(" ", "_")),
        })
        print(f"ok  {title} ({lang}, {out[-1]['duration']} с, {lic})")
    path = os.path.join(os.path.dirname(__file__), "..", "js", "ai-songs-data.js")
    with open(path, "w", encoding="utf-8") as f:
        f.write("// Сгенерировано tools/build_ai_songs.py — песни с ИИ-вокалом из Wikimedia Commons (общественное достояние).\n")
        f.write("window.BM_AI_SONGS = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n")
    print("Всего:", len(out))


if __name__ == "__main__":
    main()
