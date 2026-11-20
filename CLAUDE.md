# mayphung.com — điều Claude phải biết trước khi sửa

Web của May (Phương Phùng): viết lách, làm mẹ, truyện cho trẻ, khoá học và sổ viết về cảm xúc. May không rành kỹ thuật; May sửa chữ qua Pages CMS, Claude lo phần còn lại. Trả lời May bằng tiếng Việt.

## Không được phá

1. **Giọng viết.** Xưng "mình", gọi người đọc "bạn". Tiếng Việt tự nhiên, không giọng dịch (tránh "cuốn nhỏ", "cuốn này dùng để…"). Quà tặng gọi là "sổ tay". Lời ký: "bit by bit, May" (lấy từ `site.chu.kyTen`, không viết cứng).
2. **Không chữ tạm.** Không để `[ngoặc vuông]`, TODO, chữ nháp lên web. Ô nào chưa có thông tin thì để trống, giao diện phải tự ẩn phần trống.
3. **Giá chỉ ở một chỗ:** `src/_data/banHang.json` → `sanPham[].gia` (giá đang bán) và `giaSau` (giá gạch ngang). Thẻ ở `xuong.json` có `sanPham` thì lấy giá từ đó. Không viết giá cứng ở chỗ khác.
4. **Chính sách bảo mật và Điều khoản** (`src/chinh-sach-bao-mat.md`, `src/dieu-khoan.md`) phải khớp đúng cách web đang chạy. Sửa nội dung thì: nâng `phienBan` và `ngayCapNhat` trong `src/_data/phapLy.json`, rồi chạy `npm run khoa-phap-ly`. Máy chủ ghi phiên bản này vào mỗi lần người dùng đồng ý.
5. **Khoá bí mật** (RESEND_API_KEY, TOKEN_SECRET, SEPAY_API_KEY, ADMIN_KEY) chỉ nằm trên Cloudflare và `.dev.vars` (không commit). Không bao giờ ghi vào repo, không xin May dán vào chat.
6. **Bài test.** Hàm `cham()` trong `src/assets/js/kiemtra.js` và bản sao trong `scripts/kiem-tra.mjs` phải giống nhau. Không đổi mã kết quả (`ketQua[].ma`) của bài đang chạy: dữ liệu cũ trong KV dùng các mã đó.
7. **Ô mới cho May sửa** thì thêm vào `.pages.yml` với nhãn tiếng Việt dễ hiểu. Giữ JSON thụt lề 2 dấu cách.
8. **KV gói miễn phí** cho 1.000 lần ghi mỗi ngày. Mỗi người làm test và để lại email tốn khoảng 8 lần ghi. Đừng thêm lần ghi không cần.
9. **Gọi dịch vụ ngoài** (Resend, Kit) phải có timeout; lỗi thì ghi log và đi tiếp, không làm hỏng việc của người dùng.

## Cổng chặn

`scripts/kiem-tra.mjs` chạy tự động mỗi lần dựng web (gọi từ `eleventy.config.js`). Thấy lỗi thì dừng, Cloudflare không đưa bản lỗi lên, web cũ vẫn chạy. Nó kiểm tra:
- giá, mã sản phẩm, dữ liệu bài test, người chọn toàn kiểu X phải ra X;
- nội dung chính sách đổi mà chưa nâng phiên bản;
- thứ trông giống khoá bí mật trong repo;
- trên trang đã dựng: chữ tạm, may.lat, workers.dev, undefined/NaN, lời ký cũ, trang thiếu tiêu đề hay mô tả, giá khoá học lệch.

Chạy tay: `npm run kiem-tra`. Thêm quy tắc mới vào file này khi May sửa một lỗi lặp lại: sửa nguyên tắc, đừng sửa từng ví dụ.

## Trước khi giao

- `rm -rf _site && npx @11ty/eleventy` phải chạy sạch (bản dựng cũ có thể còn file thừa).
- Sửa máy chủ: `node --check worker/index.js` và `npx wrangler deploy --dry-run --outdir /tmp/wb`.
- Đổi giao diện: chụp màn hình cả máy tính và điện thoại để xem.
- Đẩy lên `main` → Cloudflare Workers Builds tự dựng và đưa lên sau 1–2 phút. Xem lại trên mayphung.com.
- Lời commit bằng tiếng Việt, nói được đổi gì.

## Bản đồ

- `src/_data/*.json`: chữ và cài đặt (site, trangChu, banHang, khoangDung, kiemTra, xuong, phapLy…).
- `src/bai-viet/`, `src/nhat-ky/`: bài dài và trang ngắn.
- `worker/index.js`: đăng ký email, đơn hàng, SePay, phòng học `/hoc/`, bài test `/api/kiem-tra`, trang quản lý `/quan-ly/`, thư báo cáo tuần (cron trong `wrangler.jsonc`, 8 giờ sáng thứ Hai giờ Việt Nam).
- Sổ tay đầy đủ cho May: https://claude.ai/artifact/TptLkHNpwFZjLnDyDgb5Ws
