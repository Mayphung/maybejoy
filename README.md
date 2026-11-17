# maybejoy.com — Vở Bit by Bit của May

## Sửa chữ, đăng bài
Vào **app.pagescms.org** → đăng nhập bằng GitHub → chọn **maybejoy**.

- **✏️ Từng chút một — trang ngắn**: ghi chú, ảnh, câu tâm đắc lên tường nhật ký.
- **📖 Bài viết dài**: bài cho *Từng chút một* hoặc *Mẹ cũng đang học*.
- **🏠 Trang chủ**, **📄 các trang chuyên mục**: sửa chữ, thêm video, thêm link mua sách.
- **⚙️ Cài đặt**: link Facebook / YouTube, form email, số tài khoản.

Bấm **Save** → khoảng 1–2 phút sau web tự cập nhật.

Nút hay mục nào chưa có link thì tự ẩn, có link là tự hiện.

## Phần kỹ thuật (để Claude đọc)
- Eleventy 3 · `npm run build` → `_site/`
- Cloudflare Workers (static assets) · cấu hình ở `wrangler.jsonc`
- Ảnh: `src/assets/images/`
