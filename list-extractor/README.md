# 企業リスト抽出ツール

Web 上の企業一覧ページから **会社名・代表者名・住所・電話番号・HP URL** を取得し、
Excel で納品できる状態まで一括で整えるツールです。

## できること

| 工程 | 内容 |
| --- | --- |
| 取得 | 一覧ページを順にたどって取得（「次へ」リンクを自動追跡） |
| マナー | robots.txt の確認、アクセス間隔（既定 3 秒）の確保 |
| 正規化 | 全角/半角・空白の統一、`(株)`→`株式会社`、電話番号の書式統一 |
| 重複削除 | 法人格や表記ゆれを除いた会社名、または電話番号が一致するものを1社に統合（欠けている項目は補完） |
| 除外 | 指定リストの企業を表記ゆれ込みで除外 |
| 出力 | Excel（見出し固定・フィルタ付き）＋「処理結果」シートに件数の内訳 |

## 動作例（同梱の架空データ）

```
$ python extractor.py --from-dir sample --exclude sample/exclude.txt -o result.xlsx
取得中...
  page1.html: 8件
  page2.html: 8件
  page3.html: 8件

処理結果
  取得件数: 24
  重複削除: 10
  除外リスト該当: 4
  会社名なし: 0
  納品件数: 10
```

`sample/` のデータは動作確認用に生成した **架空の企業** です。

## 使い方

```bash
pip install -r requirements.txt
python extractor.py --from-dir sample --exclude sample/exclude.txt -o result.xlsx
python -m pytest   # テスト
```

実サイトに使う場合は、サイトの HTML 構造に合わせて `extractor.py` の `SELECTORS` を変更し、
`--start-url` で開始ページを指定します。**利用規約や robots.txt で自動取得が認められているサイトに限って使用してください。**

## 技術

Python 3 / requests / BeautifulSoup / openpyxl / pytest　— Claude Code を活用して開発
