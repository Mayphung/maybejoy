/* Bài kiểm tra: từng câu một, chấm ngay trên máy người làm, rồi gửi kết quả (ẩn danh) về máy chủ */
(function () {
  var nguon = document.getElementById('kt-data');
  if (!nguon) return;
  var D = JSON.parse(nguon.textContent);
  var B = D.bai, K = D.chu;
  var KHOA = 'mj-kt-' + B.ma;
  var luu = {
    lay: function () { try { return JSON.parse(localStorage.getItem(KHOA)); } catch (e) { return null; } },
    dat: function (v) { try { localStorage.setItem(KHOA, JSON.stringify(v)); } catch (e) {} },
    xoa: function () { try { localStorage.removeItem(KHOA); } catch (e) {} }
  };
  var thang = B.kieu === 'thang';
  var cau = thang ? B.cauThang : B.cau;
  var PHIEN = B.kieu + ':' + cau.length + ':' + B.ketQua.map(function (r) { return r.ma; }).join(',');
  var $ = function (id) { return document.getElementById(id); };
  var moS = $('kt-mo'), lamS = $('kt-lam'), kqS = $('kt-kq');
  var hoi = $('kt-hoi'), chonEl = $('kt-chon'), lui = $('kt-lui'), soN = $('kt-n'), thanh = $('kt-thanh');
  var CHU_CAI = 'ABCDEFGH';
  var VONG = '<svg viewBox="0 0 42 42" aria-hidden="true"><path d="M21 4c-9 0-17 6-17 17s8 17 18 17 16-8 16-17C38 11 30 3 19 5" fill="none" stroke="#A8522B" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="120" stroke-dashoffset="0"/></svg>';

  var tl = [], i = 0, khoa = false, ketQua = null;
  var thuTu = cau.map(function (c) {
    if (thang) return null;
    var a = c.chon.map(function (_, j) { return j; });
    for (var k = a.length - 1; k > 0; k--) { var r = Math.floor(Math.random() * (k + 1)); var t = a[k]; a[k] = a[r]; a[r] = t; }
    return a;
  });

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var chuNho = function (s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>'); };
  var gui = function (duong, du) {
    return fetch(duong, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(du), keepalive: true })
      .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); });
  };
  var timKq = function (ma) { return B.ketQua.filter(function (r) { return r.ma === ma; })[0]; };

  /* ---------- làm bài ---------- */
  function hienCau() {
    var c = cau[i];
    soN.textContent = i + 1;
    thanh.style.width = Math.round((i / cau.length) * 100) + '%';
    hoi.textContent = thang ? c.chu : c.hoi;
    chonEl.className = 'kt-chon' + (thang ? ' thang' : '');
    var html = '';
    if (thang) {
      B.mucThang.forEach(function (nhan, j) {
        var v = j + 1;
        html += '<button type="button" class="kt-o' + (tl[i] === v ? ' chon' : '') + '" data-v="' + v + '"><span class="kt-chuCai">' + v + VONG + '</span><span>' + esc(nhan) + '</span></button>';
      });
    } else {
      thuTu[i].forEach(function (j, vt) {
        var o = c.chon[j];
        html += '<button type="button" class="kt-o' + (tl[i] === o.kq ? ' chon' : '') + '" data-v="' + esc(o.kq) + '"><span class="kt-chuCai">' + CHU_CAI[vt] + VONG + '</span><span>' + esc(o.chu) + '</span></button>';
      });
    }
    chonEl.innerHTML = html;
    lui.hidden = i === 0;
    khoa = false;
    var top = lamS.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.5) lamS.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try { hoi.focus({ preventScroll: true }); } catch (e) {}
  }

  function chon(nut) {
    if (khoa) return;
    khoa = true;
    chonEl.querySelectorAll('.kt-o').forEach(function (b) { b.classList.remove('chon'); });
    nut.classList.add('chon');
    tl[i] = thang ? Number(nut.dataset.v) : nut.dataset.v;
    setTimeout(function () {
      i++;
      if (i < cau.length) hienCau(); else xong();
    }, 320);
  }

  chonEl.addEventListener('click', function (e) {
    var nut = e.target.closest('.kt-o');
    if (nut) chon(nut);
  });
  document.addEventListener('keydown', function (e) {
    if (lamS.hidden || e.metaKey || e.ctrlKey || e.altKey) return;
    var n = parseInt(e.key, 10);
    var cacNut = chonEl.querySelectorAll('.kt-o');
    if (n >= 1 && n <= cacNut.length) chon(cacNut[n - 1]);
    else if (/^[a-e]$/i.test(e.key) && !thang) {
      var vt = e.key.toUpperCase().charCodeAt(0) - 65;
      if (cacNut[vt]) chon(cacNut[vt]);
    }
  });
  lui.addEventListener('click', function () { if (i > 0) { i--; hienCau(); } });

  /* ---------- chấm ---------- */
  function cham() {
    if (thang) {
      var tong = { lo: 0, ne: 0 }, dem = { lo: 0, ne: 0 }, theoSo = {};
      cau.forEach(function (c, j) {
        var v = tl[j];
        theoSo[c.so] = v;
        if (!c.tinh || !(c.tinh in tong)) return;
        tong[c.tinh] += c.dao ? 5 - v : v;
        dem[c.tinh]++;
      });
      var lo = dem.lo ? tong.lo / dem.lo : 0, ne = dem.ne ? tong.ne / dem.ne : 0;
      var ng = Number(B.truc.nguong) || 2.5;
      var kq = lo < ng ? (ne < ng ? 'an-toan' : 'ne') : (ne < ng ? 'lo' : 'canh-giac');
      var co = (B.cap || []).filter(function (cap) {
        var p = String(cap).split('-');
        return theoSo[p[0]] && theoSo[p[1]] && Math.abs(theoSo[p[0]] - (5 - theoSo[p[1]])) >= 2;
      }).length;
      return { kq: kq, diem: { lo: Math.round(lo * 100) / 100, ne: Math.round(ne * 100) / 100 }, doTinCay: co <= 1 ? 'cao' : co <= 3 ? 'vua' : 'thap', traLoi: theoSo };
    }
    var d = {};
    B.ketQua.forEach(function (r) { d[r.ma] = 0; });
    tl.forEach(function (k) { if (k in d) d[k]++; });
    var xep = B.ketQua.map(function (r) { return r.ma; }).sort(function (a, b) { return d[b] - d[a]; });
    var dau = xep.filter(function (k) { return d[k] === d[xep[0]]; });
    return { kq: xep[0], phu: d[xep[1]] > 0 ? xep[1] : '', ngang: dau.length > 1 ? dau : null, diem: d, traLoi: tl.slice() };
  }

  function xong() {
    thanh.style.width = '100%';
    ketQua = cham();
    ketQua.luc = Date.now();
    ketQua.tenKq = (timKq(ketQua.kq) || {}).ten;
    ketQua.ban = PHIEN;
    luu.dat(ketQua);
    gui('/api/kiem-tra', { bai: B.ma, buoc: 'xong', kq: ketQua.kq, phu: ketQua.phu || '', diem: ketQua.diem, doTinCay: ketQua.doTinCay || '', traLoi: ketQua.traLoi }).catch(function () {});
    hienKetQua(true);
  }

  /* ---------- hình ---------- */
  function haiDong(s) {
    var w = s.split(' ');
    if (w.length < 3) return [s];
    var giua = Math.ceil(w.length / 2);
    return [w.slice(0, giua).join(' '), w.slice(giua).join(' ')];
  }
  function banDo(kq) {
    var x = function (v) { return 50 + ((v - 1) / 3) * 260; };
    var y = function (v) { return 290 - ((v - 1) / 3) * 260; };
    var ng = Number(B.truc.nguong) || 2.5, mx = x(ng), my = y(ng);
    var o = [
      { ma: 'lo', cx: (50 + mx) / 2, cy: (30 + my) / 2 },
      { ma: 'canh-giac', cx: (mx + 310) / 2, cy: (30 + my) / 2 },
      { ma: 'an-toan', cx: (50 + mx) / 2, cy: (my + 290) / 2 },
      { ma: 'ne', cx: (mx + 310) / 2, cy: (my + 290) / 2 }
    ];
    var s = '<svg class="kt-ban-do" viewBox="0 0 330 330" role="img" aria-label="' + esc(B.truc.lo) + ' ' + kq.diem.lo + ', ' + esc(B.truc.ne) + ' ' + kq.diem.ne + '">';
    s += '<rect x="50" y="30" width="260" height="260" rx="8" fill="#FFFDF8" stroke="#6E2A34" stroke-width="1.5"/>';
    o.forEach(function (q) {
      var r = timKq(q.ma);
      if (!r) return;
      var la = q.ma === kq.kq;
      var x0 = q.cx < mx ? 50 : mx, y0 = q.cy < my ? 30 : my;
      var w = q.cx < mx ? mx - 50 : 310 - mx, h = q.cy < my ? my - 30 : 290 - my;
      if (la) s += '<rect x="' + (x0 + 3) + '" y="' + (y0 + 3) + '" width="' + (w - 6) + '" height="' + (h - 6) + '" rx="6" fill="#F6E3D3"/>';
      var dong = haiDong(r.ten);
      s += '<text x="' + q.cx + '" y="' + (q.cy - (dong.length - 1) * 8) + '" text-anchor="middle" font-family="Patrick Hand, cursive" font-size="15" fill="' + (la ? '#6E2A34' : '#8A7A70') + '">';
      dong.forEach(function (t, k) { s += '<tspan x="' + q.cx + '" dy="' + (k ? 17 : 0) + '">' + esc(t) + '</tspan>'; });
      s += '</text>';
    });
    s += '<line x1="' + mx + '" y1="30" x2="' + mx + '" y2="290" stroke="#C1653A" stroke-width="1.2" stroke-dasharray="4 5"/>';
    s += '<line x1="50" y1="' + my + '" x2="310" y2="' + my + '" stroke="#C1653A" stroke-width="1.2" stroke-dasharray="4 5"/>';
    s += '<text x="180" y="318" text-anchor="middle" font-size="12" fill="#6E2A34" font-family="Be Vietnam Pro, sans-serif">' + esc(B.truc.ne) + ' →</text>';
    s += '<text x="0" y="0" transform="translate(30 160) rotate(-90)" text-anchor="middle" font-size="12" fill="#6E2A34" font-family="Be Vietnam Pro, sans-serif">' + esc(B.truc.lo) + ' →</text>';
    var px = x(Math.min(4, Math.max(1, kq.diem.ne))), py = y(Math.min(4, Math.max(1, kq.diem.lo)));
    s += '<circle cx="' + px + '" cy="' + py + '" r="14" fill="#C1653A" opacity=".22"><animate attributeName="r" values="10;18;10" dur="2.4s" repeatCount="indefinite"/></circle>';
    s += '<circle cx="' + px + '" cy="' + py + '" r="7" fill="#A8522B" stroke="#FFFDF8" stroke-width="2.5"/>';
    return s + '</svg>';
  }
  function cot(kq) {
    var toiDa = {};
    cau.forEach(function (c) { c.chon.forEach(function (o) { toiDa[o.kq] = (toiDa[o.kq] || 0) + 1; }); });
    var s = '<div class="kt-bieu">';
    var xep = B.ketQua.slice().sort(function (a, b) { return kq.diem[b.ma] - kq.diem[a.ma]; });
    xep.forEach(function (r) {
      var n = kq.diem[r.ma] || 0;
      s += '<div class="kt-cot' + (r.ma === kq.kq ? ' chinh' : '') + '"><span>' + esc(r.ten) + '</span><span class="bar"><i style="width:0" data-w="' + Math.round((n / (toiDa[r.ma] || cau.length)) * 100) + '%"></i></span><span class="n">' + n + '</span></div>';
    });
    return s + '</div>';
  }

  /* ---------- phân tích (dùng chung định dạng với email) ---------- */
  function phanTich(t) {
    var out = '', ds = false;
    String(t || '').split(/\n/).forEach(function (dong) {
      dong = dong.trim();
      if (!dong) return;
      if (/^- /.test(dong)) { if (!ds) { out += '<ul>'; ds = true; } out += '<li>' + chuNho(dong.slice(2)) + '</li>'; return; }
      if (ds) { out += '</ul>'; ds = false; }
      if (/^## /.test(dong)) out += '<h4>' + chuNho(dong.slice(3)) + '</h4>';
      else out += '<p>' + chuNho(dong) + '</p>';
    });
    return out + (ds ? '</ul>' : '');
  }

  /* ---------- kết quả ---------- */
  function phanKetQua(kq, r, dayDu) {
    var h = '';
    h += '<p class="kt-nhan">' + esc(K.nhanKetQua) + '</p>';
    h += '<h2 class="kt-ten-kq" tabindex="-1" id="kt-ten-kq">' + esc(r.ten) + '</h2>';
    if (r.phu) h += '<p class="kt-phu-kq">' + esc(r.phu) + '</p>';
    h += '<p class="kt-mota">' + chuNho(r.moTa) + '</p>';
    if (dayDu && r.dau && r.dau.length) h += '<p style="margin:0">' + esc(K.banCoThe) + '</p><ul class="kt-ds-dau">' + r.dau.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (dayDu && r.canGi) h += '<div class="kt-can">' + (B.nhanCanGi ? '<b>' + esc(B.nhanCanGi) + '</b> ' : '') + chuNho(r.canGi) + '</div>';
    if (r.loiNhan) h += '<p class="kt-loi">' + esc(r.loiNhan) + '</p>';
    h += bieuDo(kq);
    if (B.ket) h += '<p class="kt-ket">' + esc(B.ket) + '</p>';
    return h;
  }
  function bieuDo(kq) {
    var h = '';
    if (thang) {
      h += banDo(kq);
      h += '<p class="kt-diem">' + esc(B.truc.lo) + ' ' + kq.diem.lo.toFixed(1) + ' / 4 · ' + esc(B.truc.ne) + ' ' + kq.diem.ne.toFixed(1) + ' / 4</p>';
      if (kq.doTinCay === 'thap' && B.doTinCayThap) h += '<p class="kt-ghichu">' + esc(B.doTinCayThap) + '</p>';
      return h;
    }
    h += cot(kq);
    var p = kq.phu && timKq(kq.phu);
    if (kq.ngang && kq.ngang.length > 1) {
      var ten = kq.ngang.map(function (k) { return '<b>' + esc((timKq(k) || {}).ten) + '</b>'; });
      var ds = ten.length > 2 ? ten.slice(0, -1).join(', ') + ' và ' + ten[ten.length - 1] : ten.join(' và ');
      h += '<p class="kt-phu2">' + esc(K.ngangNhau).replace('{ds}', ds) + '</p>';
      kq.ngang.slice(1).forEach(function (k) {
        var r2 = timKq(k);
        if (r2) h += '<div class="kt-can"><b>' + esc(r2.ten) + '.</b> ' + chuNho(r2.moTa) + (r2.loiNhan ? '<br><i>' + esc(r2.loiNhan) + '</i>' : '') + '</div>';
      });
    } else if (p) h += '<p class="kt-phu2">' + esc(K.nhanPhu) + ' <b>' + esc(p.ten) + '</b>.</p>';
    return h;
  }
  function hopEmail(kq) {
    var L = B.giuLienLac || {};
    var h = '<div class="kt-hop kt-mau-' + esc(B.mau || 'do-ruou') + '" id="kt-hop">';
    h += '<h3>' + esc(L.tieuDe) + '</h3>';
    if (L.moTa) h += '<p>' + esc(L.moTa) + '</p>';
    if (L.ds && L.ds.length) h += '<ul>' + L.ds.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    h += '<form class="kt-form" id="kt-form" novalidate><label>' + esc(K.oNhap) + '<input id="kt-lh" name="email" type="email" inputmode="email" autocomplete="email" placeholder="' + esc(K.goiYNhap) + '" value="' + esc(kq.email || '') + '" required></label><button class="btn" type="submit">' + esc(K.nutGui) + '</button></form>';
    h += '<p class="kt-nho">' + esc(K.chuNho) + (D.cs ? ' <a href="/chinh-sach-bao-mat/">' + esc(D.cs) + '</a>' : '') + '</p>';
    h += '<p class="kt-tb" id="kt-tb" aria-live="polite"></p>';
    return h + '</div>';
  }

  function hienKetQua(moiLam) {
    var kq = ketQua, r = timKq(kq.kq);
    if (!r) { luu.xoa(); return false; }
    var h = '';
    if (!kq.daGui) {
      // chưa để lại email: kết quả nằm sau lớp mờ
      h += '<p class="kt-nhan">' + esc(K.nhanXong) + '</p>';
      h += '<h2 class="kt-ten-kq" tabindex="-1" id="kt-ten-kq">' + esc(K.khoaTieuDe) + '</h2>';
      h += '<div class="kt-khoa"><div class="kt-mo-mo" aria-hidden="true"><p class="kt-ten-gia">██████ ███ ████</p>' + bieuDo(kq).replace(/<p class="kt-phu2">[\s\S]*$/, '') + '</div>' + hopEmail(kq) + '</div>';
    } else {
      var dayDu = !!(kq.dayDu || B.hienDayDu);
      h += '<div class="kt-thu kt-mau-' + esc(B.mau || 'do-ruou') + '">';
      h += '<p>' + esc(kq.thuToi ? K.daGuiEmail : K.khongGuiDuoc).replace('{email}', '<b>' + esc(kq.email || '') + '</b>') + '</p>';
      if (kq.thuToi) h += '<p class="kt-thu-nut"><button type="button" class="linkbtn" id="kt-gui-lai">' + esc(K.guiLai) + '</button> · <button type="button" class="linkbtn" id="kt-doi">' + esc(K.doiEmail) + '</button></p>';
      h += '<p class="kt-tb" id="kt-tb2" aria-live="polite"></p></div>';
      h += '<div id="kt-doi-hop" hidden>' + hopEmail(kq) + '</div>';
      h += phanKetQua(kq, r, dayDu);
      if (dayDu) {
        var themNgang = (kq.ngang || []).slice(1).map(function (k) { var r2 = timKq(k); return r2 ? '<h4 class="kt-them">' + esc(r2.ten) + '</h4>' + phanTich(r2.phanTich) : ''; }).join('');
        h += '<div class="kt-sau">' + phanTich(r.phanTich) + themNgang + '</div>';
      } else if (K.trongEmail) {
        h += '<p class="kt-trong-email">✉ ' + esc(K.trongEmail) + '</p>';
      }
      var T = B.buocTiep || {};
      if (T.link && T.nut) h += '<div class="kt-tiep"><p>' + chuNho(T.chu) + '</p><a class="btn" href="' + esc(T.link) + '">' + esc(T.nut) + ' →</a></div>';
      h += '<div class="kt-hang"><button type="button" class="btn ghost" id="kt-chia">' + esc(K.chiaSe) + '</button><button type="button" class="btn ghost" id="kt-lai">' + esc(K.lamLai) + '</button></div>';
      h += '<p class="kt-tb" id="kt-tb-chia" aria-live="polite"></p>';
      var khac = (D.khac || []).filter(function (x) { return x.ma !== B.ma; });
      if (khac.length) {
        h += '<div class="kt-khac"><h3>' + esc(K.deKhac) + '</h3>' + khac.map(function (x) {
          return '<a href="/kiem-tra/' + esc(x.ma) + '/"><b>' + esc(x.ten) + ' →</b><span>' + esc(x.moc) + '</span></a>';
        }).join('') + '</div>';
      }
    }
    if (!kq.daGui) h += '<p class="kt-lai-nho"><button type="button" class="linkbtn" id="kt-lai">' + esc(K.lamLai) + '</button></p>';

    kqS.innerHTML = h;
    moS.hidden = true; lamS.hidden = true; kqS.hidden = false;
    kqS.classList.remove('kt-hien'); void kqS.offsetWidth; kqS.classList.add('kt-hien');
    requestAnimationFrame(function () {
      kqS.querySelectorAll('.kt-cot .bar i').forEach(function (b) { b.style.width = b.dataset.w; });
    });
    if (moiLam) {
      window.scrollTo({ top: Math.max(0, kqS.getBoundingClientRect().top + window.scrollY - 30), behavior: 'smooth' });
      try { $('kt-ten-kq').focus({ preventScroll: true }); } catch (e) {}
    }
    ganNut();
    return true;
  }

  function guiKetQua(email, nut, tb, khiXong) {
    var du = { bai: B.ma, kq: ketQua.kq, phu: ketQua.phu || '', ngang: !!(ketQua.ngang && ketQua.ngang.length > 1), diem: ketQua.diem, email: email };
    if (nut) nut.disabled = true;
    if (tb) tb.textContent = K.dangGui || '';
    var kit = D.kit
      ? fetch('https://app.kit.com/forms/' + D.kit + '/subscriptions', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body: 'email_address=' + encodeURIComponent(email) }).catch(function () {})
      : Promise.resolve();
    return gui('/api/kiem-tra/lien-he', du)
      .then(function (r) { return kit.then(function () { return r; }); })
      .then(function (r) {
        if (!r.ok) throw new Error(r.loi || 'loi');
        ketQua.daGui = true; ketQua.email = email; ketQua.thuToi = !!r.daGui;
        ketQua.dayDu = !r.daGui;
        luu.dat(ketQua);
        khiXong(r);
      })
      .catch(function (err) {
        if (nut) nut.disabled = false;
        if (tb) tb.textContent = err && err.message && err.message !== 'loi' && err.message !== 'Failed to fetch' ? err.message : K.loiMang;
      });
  }

  function ganNut() {
    kqS.querySelectorAll('#kt-form').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var o = f.querySelector('input'), tb = f.parentNode.querySelector('.kt-tb');
        var v = o.value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { tb.textContent = K.loiNhap; o.focus(); return; }
        guiKetQua(v, f.querySelector('button'), tb, function () { hienKetQua(true); });
      });
    });
    var lai = $('kt-gui-lai');
    if (lai) lai.addEventListener('click', function () {
      var tb = $('kt-tb2');
      guiKetQua(ketQua.email, lai, tb, function (r) { lai.disabled = false; tb.textContent = r.daGui ? K.daGuiLai : K.loiMang; });
    });
    var doi = $('kt-doi');
    if (doi) doi.addEventListener('click', function () { var hop = $('kt-doi-hop'); hop.hidden = false; var o = hop.querySelector('input'); o.value = ''; o.focus(); });
    $('kt-lai').addEventListener('click', function () {
      luu.xoa(); tl = []; i = 0; ketQua = null;
      kqS.hidden = true; kqS.innerHTML = '';
      batDau();
    });
    var chia = $('kt-chia');
    if (chia) chia.addEventListener('click', function () {
      var url = location.origin + '/kiem-tra/' + B.ma + '/';
      var tb2 = $('kt-tb-chia');
      if (navigator.share) {
        navigator.share({ title: B.tieuDe, text: K.chiaSeLoi, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(K.chiaSeLoi + ' ' + url).then(function () { tb2.textContent = K.daChep; });
      } else {
        tb2.textContent = url;
      }
    });
  }

  /* ---------- bắt đầu ---------- */
  function batDau() {
    moS.hidden = true; lamS.hidden = false;
    lamS.classList.remove('kt-hien'); void lamS.offsetWidth; lamS.classList.add('kt-hien');
    hienCau();
    gui('/api/kiem-tra', { bai: B.ma, buoc: 'bat-dau' }).catch(function () {});
  }
  var nutBat = $('kt-bat');
  nutBat.hidden = false;
  nutBat.addEventListener('click', batDau);

  var cu = luu.lay();
  if (cu && cu.ban !== PHIEN) { luu.xoa(); cu = null; }
  if (cu && cu.kq && !/[?&]lam-lai/.test(location.search)) {
    ketQua = cu;
    hienKetQua(false);
  }
})();
