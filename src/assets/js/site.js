/* maybejoy — một chút JavaScript, không thư viện nào */
(function () {
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- Form nhận email ---------- */
  document.querySelectorAll('form.mform').forEach(function (f) {
    var msg = f.nextElementSibling && f.nextElementSibling.classList.contains('form-msg') ? f.nextElementSibling : null;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = f.querySelector('button[type=submit]');
      if (btn) btn.disabled = true;
      var data = Object.fromEntries(new FormData(f));
      var kit = f.dataset.kit
        ? fetch('https://app.kit.com/forms/' + f.dataset.kit + '/subscriptions', {
            method: 'POST',
            headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
            body: 'email_address=' + encodeURIComponent(data.email || '')
          }).catch(function () {})
        : Promise.resolve();
      fetch('/api/dang-ky', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .then(function (r) { return kit.then(function () { return r; }); })
        .then(function (r) {
          if (!r.ok) throw new Error(r.loi || 'loi');
          f.hidden = true;
          if (msg) msg.textContent = data.loai === 'qua'
            ? (r.daGuiQua ? 'May gửi rồi đó! Bạn mở hộp thư nhé, xem cả mục Quảng cáo.' : 'May nhận được rồi! Cuốn nhỏ sẽ tới hộp thư của bạn sớm thôi.')
            : 'May nhận được rồi! Có gì mới May nhắn bạn.';
        })
        .catch(function (err) {
          if (btn) btn.disabled = false;
          if (msg) msg.textContent = err && err.message && err.message !== 'loi' && err.message !== 'Failed to fetch' ? err.message : 'Mạng hơi chập chờn. Bạn thử lại giúp May nhé.';
        });
    });
  });

  /* ---------- Phòng học: video tải khi mở tập, nhớ tập đã xem ---------- */
  var hoc = document.querySelector('.hoc-list');
  if (hoc) {
    var HK = 'mj-hoc-' + location.pathname;
    var seen = store.get(HK) || {};
    var bais = hoc.querySelectorAll('.hoc-bai');
    var tienDo = document.getElementById('hoc-tien-do');
    var capNhat = function () {
      var n = 0;
      bais.forEach(function (b) { var on = !!seen[b.dataset.so]; b.classList.toggle('da-xem', on); b.querySelector('.hoc-check input').checked = on; if (on) n++; });
      if (tienDo) tienDo.textContent = n ? 'đã xem ' + n + '/' + bais.length + ' tập' : '';
    };
    var nap = function (d) {
      var v = d.querySelector('.hoc-video');
      if (v && !v.firstChild) {
        var f = document.createElement('iframe');
        f.src = v.dataset.src; f.allow = 'autoplay; fullscreen'; f.allowFullscreen = true; f.loading = 'lazy';
        f.title = 'Video bài học';
        v.appendChild(f);
      }
    };
    bais.forEach(function (b) {
      var d = b.querySelector('details');
      if (d.open) nap(d);
      d.addEventListener('toggle', function () { if (d.open) nap(d); });
      b.querySelector('.hoc-check input').addEventListener('change', function (e) {
        seen[b.dataset.so] = e.target.checked; store.set(HK, seen); capNhat();
      });
    });
    capNhat();
  }

  /* ---------- Khoảng Dừng Cảm Xúc ---------- */
  var qs = document.querySelectorAll('.kd-q');
  if (qs.length) {
    var dem = document.getElementById('kd-dem');
    qs.forEach(function (q) {
      q.addEventListener('click', function () {
        q.setAttribute('aria-pressed', q.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
        var n = document.querySelectorAll('.kd-q[aria-pressed="true"]').length;
        if (dem) dem.textContent = n === 0 ? '' : n === 1 ? 'một dòng giống bạn. đọc tiếp nhé ↓' : n + ' dòng giống bạn. vậy thì đọc tiếp nhé ↓';
      });
    });
  }
  var steps = document.querySelectorAll('#kd-steps li');
  if (steps.length) {
    var lbl = document.getElementById('kd-breath-lbl');
    var rings = document.querySelectorAll('.kd-breath .ring');
    var cur = 0, auto = null, chay = false;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var show = function (i) {
      cur = i;
      steps.forEach(function (s, j) { s.classList.toggle('on', j === i); });
      if (!chay && lbl) lbl.textContent = steps[i].querySelector('.t').textContent.toLowerCase();
    };
    var startAuto = function () { if (!reduce) auto = setInterval(function () { show((cur + 1) % steps.length); }, 3600); };
    steps.forEach(function (s, i) {
      s.querySelector('button').addEventListener('click', function () { clearInterval(auto); show(i); });
    });
    startAuto();
    var tryBtn = document.getElementById('kd-try');
    if (tryBtn) tryBtn.addEventListener('click', function () {
      if (chay) return;
      chay = true; clearInterval(auto); show(1);
      var vong = document.querySelector('.kd-breath');
      if (vong && vong.getBoundingClientRect().top < 0) vong.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      var goc = tryBtn.textContent;
      tryBtn.classList.add('chay');
      rings.forEach(function (r) { r.style.animation = 'none'; void r.offsetWidth; r.style.animation = ''; });
      var t0 = Date.now();
      var tick = setInterval(function () {
        var s = (Date.now() - t0) / 1000;
        if (s >= 30) {
          clearInterval(tick); chay = false;
          lbl.textContent = 'xong rồi';
          tryBtn.classList.remove('chay');
          tryBtn.textContent = 'Bạn vừa có một khoảng dừng. Thử lại?';
          setTimeout(function () { show(4); }, 1200);
          return;
        }
        var p = s % 10;
        lbl.textContent = p < 4 ? 'hít vào…' : p < 5 ? 'giữ…' : 'thở ra…';
        tryBtn.textContent = 'Đang thở cùng May · còn ' + Math.ceil(30 - s) + ' giây';
      }, 200);
    });
  }
  var sticky = document.getElementById('kd-sticky');
  if (sticky) {
    var heroCta = document.querySelector('.kd-hero-cta');
    var giaBox = document.getElementById('gia');
    var dangDoi = false;
    var capNhatSticky = function () {
      dangDoi = false;
      var h = heroCta.getBoundingClientRect(), g = giaBox.getBoundingClientRect();
      var quaHero = h.bottom < 0;
      var thayGia = g.top < window.innerHeight && g.bottom > 0;
      sticky.hidden = !quaHero || thayGia;
    };
    window.addEventListener('scroll', function () { if (!dangDoi) { dangDoi = true; requestAnimationFrame(capNhatSticky); } }, { passive: true });
    capNhatSticky();
  }

  /* ---------- Thanh toán ---------- */
  var tt = document.getElementById('tt-form');
  if (tt) {
    var q = new URLSearchParams(location.search);
    var want = q.get('sp') || '';
    var opts = Array.prototype.slice.call(tt.querySelectorAll('.co-opt'));
    var exact = opts.filter(function (o) { return o.querySelector('input').value === want; })[0];
    var phong = exact ? exact.dataset.phong : (opts.some(function (o) { return o.dataset.phong === want; }) ? want : '');
    if (phong) {
      opts.forEach(function (o) { o.hidden = o.dataset.phong !== phong; });
      var first = exact || opts.filter(function (o) { return !o.hidden; })[0];
      first.querySelector('input').checked = true;
      var ten = first.querySelector('.t').textContent;
      document.getElementById('tt-meta').textContent = 'Ở xưởng May · ' + ten;
      document.title = 'Thanh toán ' + ten + ' — May Phung';
    }
    var visible = opts.filter(function (o) { return !o.hidden; });
    if (visible.length === 1) document.getElementById('tt-pick').classList.add('one');

    var KEY = 'mj-don';
    var showQr = function (d) {
      tt.hidden = true;
      document.getElementById('tt-qr').hidden = false;
      document.querySelectorAll('[data-ma]').forEach(function (x) { x.textContent = d.ma; });
      document.getElementById('tt-gia').textContent = d.giaChu;
      var img = document.getElementById('tt-qr-img');
      if (d.qr) img.src = d.qr; else img.hidden = true;
      poll(d.ma, 0);
    };
    var showDone = function (link) {
      document.getElementById('tt-qr').hidden = true;
      tt.hidden = true;
      document.getElementById('tt-xong').hidden = false;
      document.getElementById('tt-vao').href = link;
      try { sessionStorage.removeItem(KEY); } catch (e) {}
    };
    var poll = function (ma, n) {
      fetch('/api/don/' + ma, { cache: 'no-store' })
        .then(function (r) { return r.json(); })
        .then(function (r) {
          if (r.ok && r.trangThai === 'da-nhan' && r.link) return showDone(r.link);
          if (n < 450) setTimeout(function () { poll(ma, n + 1); }, 4000);
        })
        .catch(function () { if (n < 450) setTimeout(function () { poll(ma, n + 1); }, 8000); });
    };
    try {
      var saved = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (saved && saved.ma && Date.now() - saved.luc < 3 * 3600 * 1000) showQr(saved);
    } catch (e) {}

    tt.addEventListener('submit', function (e) {
      e.preventDefault();
      var m = document.getElementById('tt-msg');
      var email = document.getElementById('tt-email').value.trim();
      var sp = (tt.querySelector('input[name=sp]:checked') || {}).value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { m.textContent = 'Email chưa đúng, bạn xem lại giúp May nhé.'; return; }
      var btn = tt.querySelector('button[type=submit]');
      btn.disabled = true; m.textContent = '';
      fetch('/api/don', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email, sp: sp }) })
        .then(function (r) { return r.json(); })
        .then(function (r) {
          if (!r.ok) throw new Error(r.loi || '');
          r.luc = Date.now();
          try { sessionStorage.setItem(KEY, JSON.stringify(r)); } catch (e) {}
          showQr(r);
        })
        .catch(function (err) {
          btn.disabled = false;
          m.textContent = (err && err.message) || 'Mạng hơi chập chờn. Bạn thử lại giúp May nhé.';
        });
    });
  }

  /* ---------- Trang chủ: Việc hôm nay ---------- */
  var tasks = document.querySelector('.p-home .tasks');
  if (tasks) {
    var d = new Date();
    var days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    var dateEl = document.getElementById('hom-nay');
    if (dateEl) dateEl.textContent = days[d.getDay()] + ', ngày ' + d.getDate() + ' tháng ' + (d.getMonth() + 1) + ' năm ' + d.getFullYear();
    var key = 'mj-vo-' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    var st = store.get(key) || {};
    var items = tasks.querySelectorAll('.item[data-i]:not(.mine)');
    var mine = tasks.querySelector('.item.mine');
    var total = items.length + (mine ? 1 : 0);
    var totEl = document.getElementById('done-total');
    if (totEl) totEl.textContent = total;

    function setDone(item, on) {
      item.classList.toggle('done', on);
      var b = item.querySelector('button.box');
      if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    function count() {
      var n = tasks.querySelectorAll('.item.done').length;
      var m = 'Một việc cũng là đi.';
      if (n === 0) m = 'Chưa gạch gì? Cũng được. Mai làm tiếp.';
      else if (n >= 3 && n < total - 1) m = 'Được mấy việc rồi. Nghỉ chút đi.';
      else if (n === total - 1) m = 'Còn một việc. Hay để mai cũng được.';
      else if (n >= total) m = 'Xong hết?! Hôm nay bạn giỏi thật.';
      var nEl = document.getElementById('done-n'), mEl = document.getElementById('done-msg');
      if (nEl) nEl.textContent = n;
      if (mEl) mEl.textContent = m;
    }
    function save() {
      var s = {};
      items.forEach(function (it) { s[it.dataset.i] = it.classList.contains('done'); });
      s.mine = st.mine || '';
      s.mineDone = mine ? mine.classList.contains('done') : false;
      st = s; store.set(key, s);
    }
    items.forEach(function (it) {
      var i = it.dataset.i;
      setDone(it, i in st ? !!st[i] : it.dataset.default === '1');
      it.querySelector('button.box').addEventListener('click', function () {
        setDone(it, !it.classList.contains('done')); save(); count();
      });
      it.querySelectorAll('[data-tick]').forEach(function (a) {
        a.addEventListener('click', function () { setDone(it, true); save(); count(); });
      });
    });

    if (mine) {
      var form = document.getElementById('mine-form');
      var input = document.getElementById('viec-cua-ban');
      var doneBox = mine.querySelector('.mine-done');
      var text = document.getElementById('mine-text');
      var showMine = function (on) {
        mine.classList.toggle('done', on);
        form.hidden = on; doneBox.hidden = !on;
        if (on) text.textContent = st.mine;
      };
      showMine(!!(st.mineDone && st.mine));
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = input.value.trim();
        if (!v) { input.focus(); return; }
        st.mine = v; showMine(true); save(); count();
      });
      document.getElementById('mine-undo').addEventListener('click', function () {
        st.mine = ''; input.value = ''; showMine(false); save(); count(); input.focus();
      });
    }
    count();
  }

  /* ---------- Mẹ cũng đang học: lọc theo thẻ, hiện 5 bài mỗi lần ---------- */
  var tagBtns = document.querySelectorAll('.door-f[data-the], .chip-all[data-the]');
  if (tagBtns.length) {
    var rows = Array.prototype.slice.call(document.querySelectorAll('.me-row'));
    var tline = document.getElementById('the-line');
    var more = document.getElementById('me-more');
    var STEP = 5, curKey = 'all', shown = STEP;
    var match = function (r) { return curKey === 'all' || (' ' + r.dataset.the + ' ').indexOf(' ' + curKey + ' ') > -1; };
    var render = function () {
      var n = 0, total = 0;
      rows.forEach(function (r) {
        var ok = match(r);
        if (ok) total++;
        var show = ok && n < shown;
        if (show) n++;
        r.hidden = !show;
      });
      if (more) more.hidden = n >= total;
      if (tline) tline.textContent = curKey === 'all' ? '' : 'có ' + total + ' bài';
    };
    var pick = function (key) {
      curKey = key; shown = STEP;
      tagBtns.forEach(function (b) { var on = b.dataset.the === key; b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); });
      render();
    };
    tagBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        pick(b.getAttribute('aria-pressed') === 'true' && b.dataset.the !== 'all' ? 'all' : b.dataset.the);
      });
    });
    if (more) more.addEventListener('click', function () {
      var first = shown;
      shown += STEP; render();
      var nxt = rows.filter(function (r) { return !r.hidden; })[first];
      if (nxt) { var a = nxt; a.focus({ preventScroll: true }); }
    });
    render();
  }

  /* ---------- Từng chút một: lọc theo kiểu ngày ---------- */
  var chips = document.querySelectorAll('.chip[data-mood]');
  if (chips.length) {
    var cells = document.querySelectorAll('.mas .cell');
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var m = c.dataset.mood;
        chips.forEach(function (x) { var on = x === c; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
        cells.forEach(function (cell) {
          var show = m === 'all' || cell.dataset.mood === m;
          cell.hidden = !show;
        });
      });
    });
  }
})();
