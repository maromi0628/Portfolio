from extractor import Company, cleanse, name_key, normalize_name, normalize_tel


def test_normalize_name():
    assert normalize_name("（株）サンプル商事") == "株式会社サンプル商事"
    assert normalize_name("株式会社　サンプル商事") == "株式会社サンプル商事"
    assert normalize_name("サンプル商事(株)") == "サンプル商事株式会社"


def test_name_key_ignores_corp_type_and_width():
    assert name_key("株式会社サンプル商事") == name_key("サンプル商事（株）") == name_key("ｻﾝﾌﾟﾙ商事")


def test_normalize_tel():
    assert normalize_tel("０３ー１２３４ー５６７８") == "03-1234-5678"
    assert normalize_tel("123") == ""


def test_cleanse_dedupes_and_excludes():
    raw = [
        Company("株式会社サンプル商事", tel="03-1111-2222"),
        Company("（株）サンプル商事", tel="", url="https://example.com"),
        Company("有限会社ミライ", tel="０６ー３３３３ー４４４４"),
        Company("ミライ有限会社", tel="06-3333-4444"),
        Company("テスト工業株式会社", tel="052-000-0000"),
        Company("", tel="03-0000-0000"),
    ]
    rows, stats = cleanse(raw, ["（株）テスト工業"])
    assert [r.name for r in rows] == ["株式会社サンプル商事", "有限会社ミライ"]
    assert rows[0].url == "https://example.com"  # 重複側の情報を補完
    assert stats == {"取得件数": 6, "重複削除": 2, "除外リスト該当": 1, "会社名なし": 1, "納品件数": 2}
