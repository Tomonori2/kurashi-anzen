# IPA（情報処理推進機構）の「緊急対策情報・注意喚起」を取得して、
# ふつうの利用者に関係あるかどうかを題名から判定し、security_alerts.js に保存する。
#
# このファイルは GitHub Actions（.github/workflows/update-news.yml）から毎朝動く。
# 手元で試すときは、このフォルダで  python fetch_ipa_alerts.py  と打つ。
#
# IPAのお知らせは、ほとんどが会社・お店のシステム向け（Oracle、NetScaler など）。
# そのまま並べると利用者には意味が分からないので、題名の言葉で
#   you     … スマホ・パソコンを使う人みんなが対象
#   some    … そのソフトを入れている人だけ
#   company … 会社・お店向け（利用者は何もしなくてよい）
# に分け、「あなたがやること」を添える。判定は完ぺきではないので、画面には必ず元の記事へのリンクも出す。
#
# 安全弁：うまく取れなかったとき（少なすぎる）は security_alerts.js を書き換えず、
# エラーとして終わる。IPAのページの作りが変わった日に、お知らせが空っぽになるのを防ぐ。
import sys
import json
import datetime
import urllib.request
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding="utf-8")

URL = "https://www.ipa.go.jp/security/alert-rss.rdf"
OUT_FILE = "security_alerts.js"
MAX_ITEMS = 10
MIN_ITEMS = 5  # これより少ないときは「取得に失敗した」とみなして書き換えない
LINK_PREFIX = "https://www.ipa.go.jp/"  # これ以外のリンクは載せない（よそのサイトへ飛ばさない）

NS = {
    "rss": "http://purl.org/rss/1.0/",
    "dc": "http://purl.org/dc/elements/1.1/",
}

COMPANY_TODO = ("会社やお店のシステム向けのお知らせです。あなたがやることはありません。"
                "ただ、このニュースに便乗して「対策のためパスワードの再設定を」などと誘うメールやSMSが増えます。リンクは押さないでください。")

# 上から順に調べ、最初に当てはまったものを使う。
# 「Windows 10」は「Microsoft」より先に置く（中身がちがうため）。
RULES = [
    (["Windows 10"], "you",
     "Windows 10 のパソコンは、安全のための更新がもう届きません。Windows 11 にするか、買い替えを考えてください。"
     "古いパソコンでネットバンキングやカードの入力はしないのが安心です。"),
    (["Microsoft", "Windows"], "you",
     "Windows のパソコンを使っている人は、更新を入れてください。"
     "「スタート」→「設定」→「Windows Update」→「更新プログラムのチェック」。終わったら再起動します。"),
    (["iPhone", "iPad", "iOS", "macOS", "Safari", "Apple"], "you",
     "iPhone・iPad・Mac を使っている人は、更新を入れてください。"
     "「設定」→「一般」→「ソフトウェアアップデート」。"),
    (["Android", "Pixel", "Galaxy", "Xperia", "AQUOS"], "you",
     "Android のスマホを使っている人は、更新を入れてください。"
     "「設定」→「システム」（または「ソフトウェア更新」）→「システム アップデート」。"),
    (["Chrome", "Edge", "Firefox", "ブラウザ"], "you",
     "インターネットを見るアプリ（ブラウザ）を最新にしてください。"
     "Chrome なら右上の「︙」→「ヘルプ」→「Google Chrome について」を開くと、自動で更新されます。"),
    (["LINE"], "you",
     "LINE を使っている人は、Google Play / App Store で LINE を最新にしてください。"),
    (["Adobe Acrobat", "Adobe Reader", "Acrobat Reader", "Reader"], "some",
     "パソコンに「Adobe Acrobat Reader」（PDFを見るソフト）を入れている人は、"
     "そのソフトを開いて「ヘルプ」→「アップデートの有無をチェック」。入れていない人は何もしなくてOK。"),
    (["Java"], "some",
     "パソコンに Java を入れている人だけ、更新してください。心当たりがなければ、たいてい何もしなくてOKです。"),
    (["ルーター", "ルータ", "無線LAN", "Wi-Fi"], "some",
     "その機種の Wi-Fi 親機を使っている人は、メーカーの案内に沿って更新してください。"
     "このアプリの「サイバーセキュリティ対策」→「Wi-Fi親機」に手順があります。"),
]


def classify(title):
    for words, who, todo in RULES:
        if any(w in title for w in words):
            return who, todo
    return "company", COMPANY_TODO


def fetch_alerts():
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as res:
        root = ET.fromstring(res.read())

    items = []
    for it in root.findall("rss:item", NS):
        title = (it.findtext("rss:title", "", NS) or "").strip()
        link = (it.findtext("rss:link", "", NS) or "").strip()
        date = (it.findtext("dc:date", "", NS) or "").strip()[:10]  # 2026-10-21
        if not title or not link.startswith(LINK_PREFIX):
            continue
        who, todo = classify(title)
        items.append({
            "date": date.replace("-", "/"),
            "title": title,
            "url": link,
            "who": who,
            "todo": todo,
        })

    items.sort(key=lambda x: x["date"], reverse=True)
    return items[:MAX_ITEMS]


def save(items):
    # 日本時間の日付。画面に「最終確認」として出し、自動更新が止まったら気づけるようにする。
    today = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).strftime("%Y/%m/%d")
    js = "// IPAの緊急対策情報・注意喚起から自動取得（fetch_ipa_alerts.py）。手動で書き換えないこと。\n"
    js += 'const SECURITY_ALERTS_UPDATED = "' + today + '";\n'
    js += "const SECURITY_ALERTS = " + json.dumps(items, ensure_ascii=False, indent=2) + ";\n"
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        f.write(js)
    return today


if __name__ == "__main__":
    print("IPAの緊急対策情報を取得中...")
    items = fetch_alerts()
    if len(items) < MIN_ITEMS:
        print(f"⚠️ {len(items)}件しか取れませんでした（{MIN_ITEMS}件未満）。")
        print("   IPAのページの作りが変わった可能性があります。security_alerts.js は書き換えません。")
        sys.exit(1)  # 失敗として終わる（GitHub Actionsが赤くなり、メールで気づける）
    today = save(items)
    print(f"💾 {len(items)}件を {OUT_FILE} に保存しました（最終確認 {today}）")
    for it in items:
        print(f"  ・{it['date']} [{it['who']}] {it['title']}")
