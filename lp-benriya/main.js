(function () {
  'use strict';

  // ハンバーガーメニュー
  const btn = document.querySelector('.menu-btn');
  const nav = document.querySelector('.gnav');
  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  });

  // スクロールで表示
  const targets = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('shown'); io.unobserve(en.target); } });
    }, { threshold: 0.15 });
    targets.forEach((t) => io.observe(t));
  } else {
    targets.forEach((t) => t.classList.add('shown'));
  }

  // フォーム: 入力 → 確認 → 完了
  const form = document.getElementById('contact-form');
  const steps = form.querySelectorAll('.step');
  const errorBox = form.querySelector('.form-error');
  const labels = { name: 'お名前', tel: '電話番号', email: 'メール', category: 'ご依頼内容', message: '詳細' };

  function show(step) {
    steps.forEach((s) => { s.hidden = s.dataset.step !== step; });
    form.scrollIntoView({ block: 'start' });
  }
  function validate() {
    let ok = true;
    form.querySelectorAll('[data-step=input] [required]').forEach((el) => {
      const valid = el.type === 'checkbox' ? el.checked : el.value.trim() !== '' && el.checkValidity();
      el.classList.toggle('invalid', !valid);
      if (!valid) ok = false;
    });
    errorBox.hidden = ok;
    errorBox.textContent = ok ? '' : '未入力または形式が正しくない項目があります。';
    return ok;
  }

  form.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action === 'confirm' && validate()) {
      const data = new FormData(form);
      const dl = form.querySelector('.confirm-list');
      dl.innerHTML = '';
      Object.keys(labels).forEach((k) => {
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = labels[k];
        dd.textContent = data.get(k) || '—';
        dl.append(dt, dd);
      });
      show('confirm');
    }
    if (action === 'back') show('input');
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // 本番ではここでフォーム送信サービスや PHP に送信する
    show('done');
  });
})();
