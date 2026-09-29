# CSV変換ツール

ネットショップの注文CSVを、販売管理ソフトなど別システムの取り込み形式に変換するブラウザツールのサンプルです。

デモ: https://maromi0628.github.io/Portfolio/csv-tool/

## できること

- CSVをドラッグ＆ドロップで読み込み（Shift_JIS／UTF-8 を自動判定）
- 出力する列を画面で設定
  - 元の列から値を取る／固定値を入れる／連番（桁数指定・ゼロ埋め）を振る
  - 列名の変更、並べ替え、追加、削除
- 前後の空白削除、空行の除外、重複行の除外
- 変換結果をプレビューしてから保存（Shift_JIS または UTF-8 BOM付き）
- 変換ルールをブラウザに保存して、次回はワンクリックで再利用

インストール不要で、HTMLファイルを開くだけで動きます。データはブラウザの外に送信されません。

## 構成

| ファイル | 内容 |
| --- | --- |
| `index.html` / `style.css` | 画面 |
| `app.js` | 画面の操作、文字コードの判定と変換 |
| `csv.js` | CSVの読み書きと変換処理（画面に依存しない部分） |
| `test_csv.js` | `csv.js` のテスト（`node test_csv.js`） |
| `vendor/encoding.min.js` | 文字コード変換ライブラリ [encoding-japanese](https://github.com/polygonplanet/encoding.js)（MIT License） |

サンプルデータの店舗・商品・氏名・住所はすべて架空のものです。
