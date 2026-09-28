// デモ用の架空データ（日付は今日を基準に自動生成）
(function () {
  const d = (offsetDays) => {
    const x = new Date();
    x.setDate(x.getDate() + offsetDays);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  };
  window.DASHBOARD_DATA = {
    settings: {
      monthlyTarget: 60000,
      feeTiers: [{ upTo: 100000, rate: 0.2 }, { upTo: 200000, rate: 0.1 }, { upTo: null, rate: 0.05 }],
    },
    candidates: [
      { id: 'C001', title: '飲食店LPのコーディング（デザイン支給）', url: '', category: 'Web制作', budget: 30000, budgetType: '固定', estHours: 8, claudeFeasibility: 5, deadline: d(6), applicants: 24, reason: '仕様が明確、デザイン支給', risk: '', foundAt: d(-1) },
      { id: 'C002', title: 'スプレッドシート集計の自動化（GAS）', url: '', category: '業務自動化', budget: 20000, budgetType: '固定', estHours: 5, claudeFeasibility: 5, deadline: d(4), applicants: 12, reason: '既存シートあり、要件が具体的', risk: '', foundAt: d(-2) },
      { id: 'C003', title: '社内向け在庫管理ツールの改修', url: '', category: 'システム開発', budget: 2500, budgetType: '時給', estHours: 20, claudeFeasibility: 3, deadline: d(9), applicants: 40, reason: '継続案件', risk: '既存コードの把握に時間がかかる', foundAt: d(-3) },
    ],
    jobs: [
      { id: 'J001', candidateId: null, title: '企業リストの抽出・整理', status: '検収完了', contractAmount: 15000, dueDate: d(-120), notes: '' },
      { id: 'J002', candidateId: null, title: 'LPコーディング（整体院）', status: '検収完了', contractAmount: 30000, dueDate: d(-85), notes: '' },
      { id: 'J003', candidateId: null, title: '請求書PDFの自動作成ツール', status: '検収完了', contractAmount: 50000, dueDate: d(-50), notes: '' },
      { id: 'J004', candidateId: null, title: 'WordPressサイトの修正', status: '検収完了', contractAmount: 25000, dueDate: d(-20), notes: '' },
      { id: 'J005', candidateId: null, title: 'データ集計スクリプト作成', status: '納品', contractAmount: 40000, dueDate: d(-2), notes: '検収待ち' },
      { id: 'J006', candidateId: null, title: '予約フォームの作成', status: '作業中', contractAmount: 35000, dueDate: d(2), notes: '' },
      { id: 'J007', candidateId: 'C002', title: 'スプレッドシート集計の自動化（GAS）', status: '応募済', contractAmount: 20000, dueDate: '', notes: '' },
      { id: 'J008', candidateId: null, title: 'ECサイトの商品登録', status: '不採用', contractAmount: 0, dueDate: '', notes: '' },
    ],
    worklogs: [
      { id: 'W001', jobId: 'J001', date: d(-122), minutes: 150, memo: '取得・整形' },
      { id: 'W002', jobId: 'J002', date: d(-90), minutes: 300, memo: 'コーディング' },
      { id: 'W003', jobId: 'J002', date: d(-87), minutes: 90, memo: '修正対応' },
      { id: 'W004', jobId: 'J003', date: d(-55), minutes: 420, memo: '実装・テスト' },
      { id: 'W005', jobId: 'J004', date: d(-22), minutes: 180, memo: '' },
      { id: 'W006', jobId: 'J005', date: d(-4), minutes: 240, memo: '' },
      { id: 'W007', jobId: 'J006', date: d(-1), minutes: 120, memo: 'フォーム実装' },
    ],
    payments: [
      { id: 'P001', jobId: 'J001', amount: 15000, status: '入金済', date: d(-118) },
      { id: 'P002', jobId: 'J002', amount: 30000, status: '入金済', date: d(-83) },
      { id: 'P003', jobId: 'J003', amount: 50000, status: '入金済', date: d(-48) },
      { id: 'P004', jobId: 'J004', amount: 25000, status: '入金済', date: d(-18) },
      { id: 'P005', jobId: 'J005', amount: 40000, status: '予定', date: d(0) },
    ],
  };
})();
