/* maybejoy — một chút JavaScript, không thư viện nào */
(function () {
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- Form nhận email (MailerLite) ---------- */
  document.querySelectorAll('form.mform').forEach(function (f) {
    var msg = f.nextElementSibling && f.nextElementSibling.classList.contains('form-msg') ? f.nextElementSibling : null;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (f.hasAttribute('data-pending')) {
        if (msg) msg.textContent = 'Phần nhận email May đang nối nốt. Mấy hôm nữa bạn ghé lại nhé.';
        return;
      }
      var btn = f.querySelector('button[type=submit]');
      if (btn) btn.disabled = true;
      fetch(f.action, { method: 'POST', body: new FormData(f), mode: 'no-cors' })
        .then(function () {
          f.hidden = true;
          if (msg) msg.textContent = 'May nhận được rồi! Bạn nhớ xem hộp thư nhé, cả mục Quảng cáo.';
        })
        .catch(function () {
          if (btn) btn.disabled = false;
          if (msg) msg.textContent = 'Mạng hơi chập chờn. Bạn thử lại giúp May nhé.';
        });
    });
  });

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
    document.getElementById('done-total').textContent = total;

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
      document.getElementById('done-n').textContent = n;
      document.getElementById('done-msg').textContent = m;
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

  /* ---------- Mẹ cũng đang học: lọc theo điều mẹ đang cần ---------- */
  var tagBtns = document.querySelectorAll('.door-f[data-the], .chip-all[data-the]');
  if (tagBtns.length) {
    var rows = document.querySelectorAll('.me-row');
    var tline = document.getElementById('the-line');
    var pick = function (key) {
      var n = 0;
      tagBtns.forEach(function (b) { var on = b.dataset.the === key; b.setAttribute('aria-pressed', on); b.classList.toggle('on', on); });
      rows.forEach(function (r) { var show = key === 'all' || (' ' + r.dataset.the + ' ').indexOf(' ' + key + ' ') > -1; r.hidden = !show; if (show) n++; });
      if (tline) tline.textContent = key === 'all' ? '' : 'đang xem ' + n + ' bài';
    };
    tagBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.getAttribute('aria-pressed') === 'true' && b.dataset.the !== 'all' ? 'all' : b.dataset.the;
        pick(key);
      });
    });
  }

  /* ---------- Từng chút một: lọc theo kiểu ngày ---------- */
  var chips = document.querySelectorAll('.chip[data-mood]');
  if (chips.length) {
    var cells = document.querySelectorAll('.mas .cell');
    var line = document.getElementById('count-line');
    var lines = { all: 'Còn nhiều trang nữa. Đi từ từ.', bo: 'Ngày muốn bỏ cũng được ghi lại. Vì có những ngày như thế thật.' };
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var m = c.dataset.mood, n = 0;
        chips.forEach(function (x) { var on = x === c; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
        cells.forEach(function (cell) {
          var show = m === 'all' || cell.dataset.mood === m;
          cell.hidden = !show; if (show) n++;
        });
        if (line) line.textContent = lines[m] || ('Đang xem ' + n + ' trang.');
      });
    });
  }
})();
