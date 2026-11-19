# mayphung.com — Bit by Bit của May

Sổ tay đầy đủ (vận hành, rủi ro, brief, SEO, nội dung, mạng xã hội):
https://claude.ai/artifact/TptLkHNpwFZjLnDyDgb5Ws

## Sửa chữ, đăng bài
Vào **app.pagescms.org** → đăng nhập bằng GitHub → chọn **maybejoy**.

- **✏️ Từng chút một — trang ngắn**: ghi chú, ảnh, câu tâm đắc lên tường nhật ký.
- **📖 Bài viết dài**: bài cho *Từng chút một* hoặc *Mẹ cũng đang học*.
- **🏠 Trang chủ**, **📄 các trang chuyên mục**: sửa chữ, thêm video, thêm link mua sách.
- **⚙️ Cài đặt**: link TikTok / Facebook / YouTube, email liên hệ, số form Kit, chữ dùng chung.
- **💳 Bán hàng**: tài khoản nhận tiền, giá thu tiền, quà tặng, chữ trên trang thanh toán và thư tự động.
- **🎓 Phòng học**, **🎓 Trang bán khóa Khoảng Dừng Cảm Xúc**, **📝 Bài kiểm tra**.

Bấm **Save** → khoảng 1–2 phút sau web tự cập nhật.
Nút hay mục nào chưa có link thì tự ẩn, có link là tự hiện.

Đơn hàng, email đăng ký, số liệu bài test: **mayphung.com/quan-ly/** (mật khẩu quản lý).

## Phần kỹ thuật (để Claude đọc)
- Eleventy 3 · `npm run build` → `_site/` · chữ và cài đặt nằm trong `src/_data/*.json`, Pages CMS đọc `.pages.yml`
- Cloudflare Workers (static assets + `worker/index.js`) · cấu hình ở `wrangler.jsonc` · KV binding `DB`
- Worker lo: `/api/dang-ky`, `/api/don`, `/api/sepay`, `/hoc/*`, `/api/kiem-tra`, `/api/kiem-tra/lien-he`, `/quan-ly/`
- Khoá bí mật (đặt trên Cloudflare, không đưa vào repo): `RESEND_API_KEY`, `TOKEN_SECRET`, `SEPAY_API_KEY`, `ADMIN_KEY`
- Thư gửi qua Resend từ `may@mayphung.com`, trả lời về `EMAIL_MAY`; email đăng ký đồng thời gửi lên form Kit
- Giá khoá học nằm ở 3 chỗ: `banHang.json` (giá thu tiền), `xuong.json` (chữ trên thẻ), `khoangDung.json` (`giaSau`)
- Ảnh: `src/assets/images/`
