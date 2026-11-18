#!/usr/bin/env python3
"""
Собирает каталог реальной музыки BM с Wikimedia Commons.
Берутся только записи со статусом «общественное достояние» (Public domain) или CC0.
Результат: js/catalog-data.js. Запуск: python3 tools/build_catalog.py
Сервер для работы приложения не нужен — это разовый сборочный скрипт.
"""
import json, os, re, time, urllib.error, urllib.parse, urllib.request, html

API = "https://commons.wikimedia.org/w/api.php"
UA = "BM-catalog-builder/1.0 (static music app)"
FREE = re.compile(r"^(public domain|pd|cc0)", re.I)

GENRES = [
    ("Классика", ["Beethoven", "Mozart", "Bach", "Chopin", "Tchaikovsky", "Vivaldi", "Debussy", "Satie", "Grieg", "Schubert", "Rachmaninoff", "Mussorgsky"]),
    ("Регтайм и джаз", ["Scott Joplin", "ragtime", "jazz 1920s", "jazz band 1925", "Dixieland"]),
    ("Блюз", ["blues 1920s", "blues recording"]),
    ("Народная", ["Russian folk song", "folk song recording", "balalaika"]),
    ("Оркестр и марши", ["Sousa march", "military band march", "waltz orchestra"]),
]
PER_GENRE = {"Классика": 36, "Регтайм и джаз": 22, "Блюз": 10, "Народная": 12, "Оркестр и марши": 14}


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
            wait = int(e.headers.get("Retry-After") or 0) or 5 * (attempt + 1)
            print(f"  … лимит запросов, жду {wait} с")
            time.sleep(wait)


def clean(s):
    s = re.sub(r"<[^>]+>", "", s or "")
    return html.unescape(s).strip()


# Записи, которые попадают в поиск, но музыкой для BM не являются
BLOCK = re.compile(r"shortstory|самоуправлен|^hmv-|^vocalion-|nazi|reich|lecture|speech|interview", re.I)


def tidy(t):
    t["title"] = re.sub(r"^PDP-CH - ", "", t["title"]).replace("+", " ").strip()
    a = t["artist"].split("\n")[0].strip()
    if re.match(r"^(user:|composer:)", a, re.I) or len(a) < 2:
        a = "Неизвестный исполнитель"
    t["artist"] = a
    return t


def search(query, limit=40):
    d = get({
        "action": "query", "generator": "search", "gsrnamespace": 6,
        "gsrsearch": f"filetype:audio {query}", "gsrlimit": limit,
        "prop": "imageinfo|videoinfo",
        "iiprop": "extmetadata", "iiextmetadatafilter": "LicenseShortName|Artist|ObjectName",
        "viprop": "derivatives|url|size",
    })
    out = []
    for p in d.get("query", {}).get("pages", []):
        meta = (p.get("imageinfo") or [{}])[0].get("extmetadata", {})
        vi = (p.get("videoinfo") or [{}])[0]
        lic = meta.get("LicenseShortName", {}).get("value", "")
        dur = vi.get("duration") or 0
        if not FREE.match(lic) or not (60 <= dur <= 1500) or not vi.get("url"):
            continue
        name = p["title"][5:]
        title = re.sub(r"\.(ogg|oga|opus|flac|wav|mp3|mid|webm)$", "", name, flags=re.I).replace("_", " ")
        artist = clean(meta.get("Artist", {}).get("value", ""))
        if len(artist) > 60 or not artist:
            artist = "Неизвестный исполнитель"
        ogg = next((x["src"] for x in vi.get("derivatives", []) if "vorbis" in x.get("type", "") and x["src"] != vi["url"]), None)
        out.append({
            "id": "c" + str(p["pageid"]),
            "title": title[:120],
            "artist": artist,
            "src": vi["url"].split("?")[0],
            "ogg": ogg,
            "mime": vi.get("mime", ""),
            "duration": round(dur),
            "page": "https://commons.wikimedia.org/wiki/" + urllib.parse.quote(p["title"].replace(" ", "_")),
            "license": "CC0" if lic.lower().startswith("cc0") else "Общественное достояние",
        })
    return out


def main():
    seen, catalog = set(), []
    for genre, queries in GENRES:
        picked = []
        for q in queries:
            try:
                res = search(q)
            except Exception as e:
                print("  ! ошибка", q, e)
                continue
            for t in res:
                if BLOCK.search(t["title"]):
                    continue
                t = tidy(t)
                key = t["title"].lower()
                if t["id"] in seen or key in seen:
                    continue
                seen.update([t["id"], key])
                t["genre"] = genre
                picked.append(t)
            time.sleep(2)
        # Чередуем результаты разных запросов, чтобы не было 20 треков одного композитора
        picked = picked[: PER_GENRE[genre]] if len(picked) <= PER_GENRE[genre] else picked[:: max(1, len(picked) // PER_GENRE[genre])][: PER_GENRE[genre]]
        print(f"{genre}: {len(picked)}")
        catalog += picked
    path = os.path.join(os.path.dirname(__file__), "..", "js", "catalog-data.js")
    with open(path, "w", encoding="utf-8") as f:
        f.write("// Сгенерировано tools/build_catalog.py — реальная музыка из Wikimedia Commons\n")
        f.write("// (только общественное достояние и CC0).\n")
        f.write("window.BM_CATALOG = " + json.dumps(catalog, ensure_ascii=False, indent=1) + ";\n")
    print("Всего:", len(catalog))


if __name__ == "__main__":
    main()
