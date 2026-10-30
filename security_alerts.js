// IPAの緊急対策情報・注意喚起から自動取得（fetch_ipa_alerts.py）。手動で書き換えないこと。
const SECURITY_ALERTS_UPDATED = "2026/10/30";
const SECURITY_ALERTS = [
  {
    "date": "2026/10/27",
    "title": "更新：PHPの脆弱性対策について(CVE-2026-109618、CVE-2026-109619：PHP2shell)",
    "url": "https://www.ipa.go.jp/security/security-alert/2026/alert20261022.html",
    "who": "company",
    "todo": "会社やお店のシステム向けのお知らせです。あなたがやることはありません。ただ、このニュースに便乗して「対策のためパスワードの再設定を」などと誘うメールやSMSが増えます。リンクは押さないでください。"
  },
  {
    "date": "2026/10/22",
    "title": "PHPの脆弱性対策について(CVE-2026-109618、CVE-2026-109619：PHP2shell)",
    "url": "https://www.ipa.go.jp/security/security-alert/2026/alert20261022.html",
    "who": "company",
    "todo": "会社やお店のシステム向けのお知らせです。あなたがやることはありません。ただ、このニュースに便乗して「対策のためパスワードの再設定を」などと誘うメールやSMSが増えます。リンクは押さないでください。"
  },
  {
    "date": "2026/10/21",
    "title": "【事前準備のお願い】PHPのセキュリティリリース公開予定について",
    "url": "https://www.ipa.go.jp/security/security-alert/2026/pre-alert20261021.html",
    "who": "company",
    "todo": "会社やお店のシステム向けのお知らせです。あなたがやることはありません。ただ、このニュースに便乗して「対策のためパスワードの再設定を」などと誘うメールやSMSが増えます。リンクは押さないでください。"
  },
  {
    "date": "2026/10/21",
    "title": "Oracle Java の脆弱性対策について(2026年10月)",
    "url": "https://www.ipa.go.jp/security/security-alert/2026/1021-jre.html",
    "who": "some",
    "todo": "パソコンに Java を入れている人だけ、更新してください。心当たりがなければ、たいてい何もしなくてOKです。"
  },
  {
    "date": "2026/10/14",
    "title": "Microsoft 製品の脆弱性対策について(2026年10月)",
    "url": "https://www.ipa.go.jp/security/security-alert/2026/1014-ms.html",
    "who": "you",
    "todo": "Windows のパソコンを使っている人は、更新を入れてください。「スタート」→「設定」→「Windows Update」→「更新プログラムのチェック」。終わったら再起動します。"
  },
  {
    "date": "2026/10/09",
    "title": "不正アクセスによる漏えい等の事案を踏まえ、速やかに実施すべき対策等について",
    "url": "https://www.ipa.go.jp/security/security-alert/2026/alert20261009.html",
    "who": "company",
    "todo": "会社やお店のシステム向けのお知らせです。あなたがやることはありません。ただ、このニュースに便乗して「対策のためパスワードの再設定を」などと誘うメールやSMSが増えます。リンクは押さないでください。"
  },
  {
    "date": "2026/10/07",
    "title": "「Movable Type」における複数の脆弱性について（JVN#91153973）",
    "url": "https://www.ipa.go.jp/security/security-alert/2026/20261007-jvn.html",
    "who": "company",
    "todo": "会社やお店のシステム向けのお知らせです。あなたがやることはありません。ただ、このニュースに便乗して「対策のためパスワードの再設定を」などと誘うメールやSMSが増えます。リンクは押さないでください。"
  },
  {
    "date": "2026/09/28",
    "title": "NetScaler ADCおよびNetScaler Gatewayの脆弱性について(CVE-2026-88771、CVE-2026-88772等)",
    "url": "https://www.ipa.go.jp/security/security-alert/2026/alert20260928.html",
    "who": "company",
    "todo": "会社やお店のシステム向けのお知らせです。あなたがやることはありません。ただ、このニュースに便乗して「対策のためパスワードの再設定を」などと誘うメールやSMSが増えます。リンクは押さないでください。"
  },
  {
    "date": "2026/09/09",
    "title": "Microsoft 製品の脆弱性対策について(2026年9月)",
    "url": "https://www.ipa.go.jp/security/security-alert/2026/0909-ms.html",
    "who": "you",
    "todo": "Windows のパソコンを使っている人は、更新を入れてください。「スタート」→「設定」→「Windows Update」→「更新プログラムのチェック」。終わったら再起動します。"
  },
  {
    "date": "2026/09/09",
    "title": "Adobe Acrobat および Reader の脆弱性対策について(2026年9月)",
    "url": "https://www.ipa.go.jp/security/security-alert/2026/0909-adobereader.html",
    "who": "some",
    "todo": "パソコンに「Adobe Acrobat Reader」（PDFを見るソフト）を入れている人は、そのソフトを開いて「ヘルプ」→「アップデートの有無をチェック」。入れていない人は何もしなくてOK。"
  }
];
