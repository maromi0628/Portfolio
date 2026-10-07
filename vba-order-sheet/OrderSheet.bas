Attribute VB_Name = "OrderSheet"
Option Explicit

' 注文CSV（楽天・Yahoo など）を読み込み、商品コードごとの数量を集計して「注文書」シートを作る。
' ショップごとの文字コードと列名は「設定」シートで変更できる（コードの修正は不要）。
' 使い方: SetupSettings を一度実行 → CreateOrderSheet を実行してCSVを選ぶ（複数選択可）

Private Const SHEET_SETTINGS As String = "設定"
Private Const SHEET_ORDER As String = "注文書"
Private Const SHEET_ERRORS As String = "エラー"

' 設定シートの列
Private Const S_SHOP As Long = 1, S_CHARSET As Long = 2, S_ORDER As Long = 3
Private Const S_CODE As Long = 4, S_ITEM As Long = 5, S_QTY As Long = 6

' 設定シートを初期値で作る
Public Sub SetupSettings()
    Dim ws As Worksheet
    Set ws = GetOrAddSheet(SHEET_SETTINGS)
    ws.Cells.Clear
    ws.Range("A1:F1").Value = Array("ショップ", "文字コード", "注文番号の列", "商品コードの列", "商品名の列", "数量の列")
    ws.Range("A2:F2").Value = Array("楽天", "Shift_JIS", "受注番号", "商品管理番号", "商品名", "個数")
    ws.Range("A3:F3").Value = Array("Yahoo", "UTF-8", "Order ID", "Item ID", "Title", "Quantity")
    ws.Range("A1:F1").Font.Bold = True
    ws.Columns("A:F").AutoFit
End Sub

' CSVを選んで注文書を作る
Public Sub CreateOrderSheet()
    Dim files As Variant
    files = Application.GetOpenFilename("CSVファイル (*.csv),*.csv", , "注文CSVを選択（複数可）", , True)
    If Not IsArray(files) Then Exit Sub

    Dim settings As Variant
    settings = ReadSettings()
    If IsEmpty(settings) Then
        MsgBox "「設定」シートがありません。先に SetupSettings を実行してください。", vbExclamation
        Exit Sub
    End If

    Dim totals As Object, itemNames As Object, counts As Object, shops As Object, seen As Object
    Set totals = CreateObject("Scripting.Dictionary")     ' 商品コード → 合計数量
    Set itemNames = CreateObject("Scripting.Dictionary")  ' 商品コード → 商品名
    Set counts = CreateObject("Scripting.Dictionary")     ' 商品コード → 明細数
    Set shops = CreateObject("Scripting.Dictionary")      ' 商品コード → ショップ別の数量
    Set seen = CreateObject("Scripting.Dictionary")       ' ショップ|注文番号|商品コード → 最初に読んだファイル

    Dim errs As New Collection, f As Variant, readCount As Long
    Application.ScreenUpdating = False
    For Each f In files
        readCount = readCount + LoadFile(CStr(f), settings, totals, itemNames, counts, shops, seen, errs)
    Next f
    WriteOrderSheet totals, itemNames, counts, shops
    WriteErrors errs
    Application.ScreenUpdating = True

    MsgBox "読み込んだ明細: " & readCount & " 件" & vbLf & _
           "商品数: " & totals.Count & " 件" & vbLf & _
           "エラー・重複: " & errs.Count & " 件（「エラー」シート）", vbInformation, "注文書を作成しました"
End Sub

Private Function ReadSettings() As Variant
    Dim ws As Worksheet, lastRow As Long
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(SHEET_SETTINGS)
    On Error GoTo 0
    If ws Is Nothing Then Exit Function
    lastRow = ws.Cells(ws.Rows.Count, S_SHOP).End(xlUp).Row
    If lastRow < 2 Then Exit Function
    ReadSettings = ws.Range(ws.Cells(2, 1), ws.Cells(lastRow, S_QTY)).Value
End Function

' 1ファイルを読み込み、見出しからどのショップの形式かを判定して集計する。戻り値は集計した明細数。
Private Function LoadFile(path As String, settings As Variant, totals As Object, itemNames As Object, _
        counts As Object, shops As Object, seen As Object, errs As Collection) As Long
    Dim fileName As String
    fileName = Mid$(path, InStrRev(path, "\") + 1)

    Dim s As Long, records As Collection, header As Variant, cols(1 To 4) As Long, found As Boolean
    For s = LBound(settings, 1) To UBound(settings, 1)
        If Len(Trim$(settings(s, S_SHOP))) > 0 And Len(Trim$(settings(s, S_CHARSET))) > 0 Then
            Set records = ParseCsv(ReadText(path, Trim$(settings(s, S_CHARSET))))
            If records.Count > 0 Then
                header = records(1)
                cols(1) = FindColumn(header, settings(s, S_ORDER))
                cols(2) = FindColumn(header, settings(s, S_CODE))
                cols(3) = FindColumn(header, settings(s, S_ITEM))
                cols(4) = FindColumn(header, settings(s, S_QTY))
                If cols(1) > 0 And cols(2) > 0 And cols(3) > 0 And cols(4) > 0 Then
                    found = True
                    Exit For
                End If
            End If
        End If
    Next s
    If Not found Then
        AddError errs, fileName, 1, "設定シートのどのショップの列名とも一致しません（文字コード・列名を確認してください）"
        Exit Function
    End If

    Dim shop As String, r As Long, rec As Variant, code As String, qtyText As String, key As String
    shop = Trim$(settings(s, S_SHOP))
    For r = 2 To records.Count
        rec = records(r)
        If Not IsBlankRecord(rec) Then
            code = Trim$(FieldAt(rec, cols(2)))
            qtyText = Trim$(FieldAt(rec, cols(4)))
            key = shop & "|" & Trim$(FieldAt(rec, cols(1))) & "|" & code
            If code = "" Then
                AddError errs, fileName, r, "商品コードが空です"
            ElseIf Not IsWholeNumber(qtyText) Then
                AddError errs, fileName, r, "数量が数値ではありません（" & qtyText & "）"
            ElseIf IsDuplicate(seen, key, fileName) Then
                AddError errs, fileName, r, "「" & seen(key) & "」と同じ注文のため除外しました"
            Else
                AddUp code, Trim$(FieldAt(rec, cols(3))), CLng(qtyText), shop, totals, itemNames, counts, shops
                LoadFile = LoadFile + 1
            End If
        End If
    Next r
End Function

' 期間が重なったCSVを両方選んだときの二重計上を防ぐ（同じファイル内の同じ注文・商品は別明細として数える）
Private Function IsDuplicate(seen As Object, key As String, fileName As String) As Boolean
    If seen.Exists(key) Then
        IsDuplicate = (seen(key) <> fileName)
    Else
        seen.Add key, fileName
    End If
End Function

Private Sub AddUp(code As String, itemName As String, qty As Long, shop As String, _
        totals As Object, itemNames As Object, counts As Object, shops As Object)
    If Not totals.Exists(code) Then
        totals.Add code, 0
        itemNames.Add code, itemName
        counts.Add code, 0
        shops.Add code, CreateObject("Scripting.Dictionary")
    End If
    totals(code) = totals(code) + qty
    counts(code) = counts(code) + 1

    Dim byShop As Object
    Set byShop = shops(code)
    byShop(shop) = byShop(shop) + qty
End Sub

Private Sub WriteOrderSheet(totals As Object, itemNames As Object, counts As Object, shops As Object)
    Dim ws As Worksheet
    Set ws = GetOrAddSheet(SHEET_ORDER)
    ws.Cells.Clear
    ws.Range("A1").Value = "注文書"
    ws.Range("A1").Font.Size = 16
    ws.Range("A1").Font.Bold = True
    ws.Range("A2").Value = "作成日: " & Format$(Date, "yyyy/mm/dd")
    With ws.Range("A4:E4")
        .Value = Array("商品コード", "商品名", "合計数量", "明細数", "ショップ別")
        .Font.Bold = True
        .Interior.Color = RGB(232, 238, 248)
    End With
    If totals.Count = 0 Then Exit Sub

    Dim data() As Variant, codes As Variant, i As Long, n As Long
    n = totals.Count
    codes = totals.Keys
    ReDim data(1 To n, 1 To 5)
    For i = 0 To n - 1
        data(i + 1, 1) = codes(i)
        data(i + 1, 2) = itemNames(codes(i))
        data(i + 1, 3) = totals(codes(i))
        data(i + 1, 4) = counts(codes(i))
        data(i + 1, 5) = ShopBreakdown(shops(codes(i)))
    Next i
    With ws.Range("A5").Resize(n, 5)
        .Columns(1).NumberFormat = "@"   ' 先頭の0を消さない
        .Value = data
        .Sort Key1:=.Columns(1), Order1:=xlAscending, Header:=xlNo
        .Borders.LineStyle = xlContinuous
    End With
    ws.Cells(5 + n, 2).Value = "合計"
    ws.Cells(5 + n, 3).Formula = "=SUM(C5:C" & (4 + n) & ")"
    ws.Cells(5 + n, 2).Resize(1, 2).Font.Bold = True
    ws.Columns("A:E").AutoFit
    ws.PageSetup.PrintArea = ws.Range("A1").Resize(5 + n, 5).Address
    ws.Activate
End Sub

Private Function ShopBreakdown(byShop As Object) As String
    Dim k As Variant, text As String
    For Each k In byShop.Keys
        If Len(text) > 0 Then text = text & " / "
        text = text & k & " " & byShop(k)
    Next k
    ShopBreakdown = text
End Function

Private Sub WriteErrors(errs As Collection)
    Dim ws As Worksheet, i As Long
    Set ws = GetOrAddSheet(SHEET_ERRORS)
    ws.Cells.Clear
    ws.Range("A1:C1").Value = Array("ファイル", "行", "内容")
    ws.Range("A1:C1").Font.Bold = True
    For i = 1 To errs.Count
        ws.Cells(i + 1, 1).Resize(1, 3).Value = errs(i)
    Next i
    ws.Columns("A:C").AutoFit
End Sub

Private Sub AddError(errs As Collection, fileName As String, rowNo As Long, message As String)
    errs.Add Array(fileName, rowNo, message)
End Sub

' 指定の文字コードでファイル全体を読む（Shift_JIS・UTF-8 など）
Private Function ReadText(path As String, charset As String) As String
    Dim text As String
    With CreateObject("ADODB.Stream")
        .Type = 2          ' adTypeText
        .Charset = charset
        .Open
        .LoadFromFile path
        text = .ReadText(-1)  ' adReadAll
        .Close
    End With
    If Left$(text, 1) = ChrW(&HFEFF) Then text = Mid$(text, 2)  ' BOM を除く
    ReadText = text
End Function

' CSVを1文字ずつ読み、ダブルクォート内のカンマ・改行・"" に対応して分割する。各行は 1 始まりの配列。
Private Function ParseCsv(text As String) As Collection
    Dim records As New Collection, fields As New Collection, field As String
    Dim i As Long, n As Long, c As String, inQuotes As Boolean
    n = Len(text)
    i = 1
    Do While i <= n
        c = Mid$(text, i, 1)
        If inQuotes Then
            If c = """" Then
                If Mid$(text, i + 1, 1) = """" Then
                    field = field & """"
                    i = i + 1
                Else
                    inQuotes = False
                End If
            Else
                field = field & c
            End If
        Else
            Select Case c
                Case """"
                    inQuotes = True
                Case ","
                    fields.Add field
                    field = ""
                Case vbCr, vbLf
                    fields.Add field
                    field = ""
                    records.Add ToArray(fields)
                    Set fields = New Collection
                    If c = vbCr And Mid$(text, i + 1, 1) = vbLf Then i = i + 1
                Case Else
                    field = field & c
            End Select
        End If
        i = i + 1
    Loop
    If fields.Count > 0 Or Len(field) > 0 Then
        fields.Add field
        records.Add ToArray(fields)
    End If
    Set ParseCsv = records
End Function

Private Function ToArray(items As Collection) As Variant
    Dim arr() As String, i As Long
    ReDim arr(1 To items.Count)
    For i = 1 To items.Count
        arr(i) = items(i)
    Next i
    ToArray = arr
End Function

Private Function FindColumn(header As Variant, columnName As Variant) As Long
    Dim i As Long
    For i = LBound(header) To UBound(header)
        If Trim$(header(i)) = Trim$(CStr(columnName)) Then
            FindColumn = i
            Exit Function
        End If
    Next i
End Function

Private Function FieldAt(rec As Variant, col As Long) As String
    If col <= UBound(rec) Then FieldAt = rec(col)
End Function

Private Function IsBlankRecord(rec As Variant) As Boolean
    Dim i As Long
    For i = LBound(rec) To UBound(rec)
        If Len(Trim$(rec(i))) > 0 Then Exit Function
    Next i
    IsBlankRecord = True
End Function

Private Function IsWholeNumber(text As String) As Boolean
    Dim i As Long, code As Long
    If Len(text) = 0 Or Len(text) > 9 Then Exit Function
    For i = 1 To Len(text)
        code = AscW(Mid$(text, i, 1))
        If code < 48 Or code > 57 Then Exit Function  ' 半角の 0-9 以外
    Next i
    IsWholeNumber = True
End Function

Private Function GetOrAddSheet(sheetName As String) As Worksheet
    On Error Resume Next
    Set GetOrAddSheet = ThisWorkbook.Worksheets(sheetName)
    On Error GoTo 0
    If GetOrAddSheet Is Nothing Then
        Set GetOrAddSheet = ThisWorkbook.Worksheets.Add(After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        GetOrAddSheet.Name = sheetName
    End If
End Function
