/* yeswithmay.com — một chút chuyển động, không thư viện nào. Form email và thanh toán dùng chung site.js */
(function () {
  document.documentElement.classList.add('js');

  /* Vạch đếm 21 ngày tự vẽ khi cuộn tới */
  var so = document.querySelector('.y-so');
  if (so && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { so.classList.add('ve'); io.disconnect(); } });
    }, { threshold: 0.35 });
    io.observe(so);
  } else if (so) so.classList.add('ve');

  /* Màn hình gọi điện: bấm Gọi thì thêm một vạch, bấm Để mai thì… */
  var dt = document.querySelector('[data-dien-thoai]');
  if (dt) {
    var lan = dt.querySelector('[data-lan]');
    var loi = dt.querySelector('[data-loi]');
    var vach = dt.querySelectorAll('.y-vach-dt path');
    var n = 0, hen;
    var noi = function (t) { loi.textContent = t; clearTimeout(hen); hen = setTimeout(function () { loi.textContent = ''; }, 2600); };
    dt.querySelector('[data-goi]').addEventListener('click', function () {
      if (n >= vach.length) { n = 0; vach.forEach(function (v) { v.classList.remove('co'); }); }
      vach[n].classList.add('co');
      n++;
      lan.textContent = n + 1;
      noi(dt.dataset.sauGoi);
    });
    dt.querySelector('[data-hoan]').addEventListener('click', function () {
      dt.classList.remove('lac'); void dt.offsetWidth; dt.classList.add('lac');
      noi(dt.dataset.sauHoan);
    });
  }

  /* Nút đặt trước bám đáy trên điện thoại: hiện khi đã qua nút ở đầu trang, ẩn khi đang thấy phần giá */
  var bam = document.querySelector('[data-bam]');
  var dau = document.querySelector('.y-dau-mua');
  var gia = document.getElementById('dat-truoc');
  if (bam && dau && gia && 'IntersectionObserver' in window) {
    bam.hidden = false;
    var qua = false, thayGia = false;
    var capNhat = function () { bam.classList.toggle('hien', qua && !thayGia); };
    new IntersectionObserver(function (es) { qua = !es[0].isIntersecting && es[0].boundingClientRect.top < 0; capNhat(); }).observe(dau);
    new IntersectionObserver(function (es) { thayGia = es[0].isIntersecting; capNhat(); }, { threshold: 0.15 }).observe(gia);
  }
})();
