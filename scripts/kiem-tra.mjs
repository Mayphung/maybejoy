// Cổng chặn trước khi web lên mạng.
// Chạy tự động mỗi lần dựng web (eleventy.config.js gọi). Thấy lỗi là dừng, web cũ vẫn chạy.
// Chạy tay: npm run kiem-tra
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const GOC = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const doc = (p) => fs.readFileSync(path.join(GOC, p), "utf8");
const json = (p) => JSON.parse(doc(p));
const KHOA_PHAP_LY = "scripts/phap-ly.khoa.json";
const TRANG_PHAP_LY = ["src/chinh-sach-bao-mat.md", "src/dieu-khoan.md"];

export const maPhapLy = () => crypto.createHash("sha256").update(TRANG_PHAP_LY.map(doc).join("\n---\n")).digest("hex").slice(0, 16);

// Chấm điểm giống hệt hàm cham() trong src/assets/js/kiemtra.js (bài kiểu "chon")
function cham(B, tl) {
  const d = {};
  B.ketQua.forEach((r) => (d[r.ma] = 0));
  tl.forEach((k) => { if (k in d) d[k]++; });
  const xep = B.ketQua.map((r) => r.ma).sort((a, b) => d[b] - d[a]);
  const dau = xep.filter((k) => d[k] === d[xep[0]]);
  return { kq: xep[0], ngang: dau.length > 1 ? dau : null };
}

export function kiemTraNguon() {
  const loi = [];
  const site = json("src/_data/site.json");
  const banHang = json("src/_data/banHang.json");
  const xuong = json("src/_data/xuong.json");
  const kiemTra = json("src/_data/kiemTra.json");
  const phapLy = json("src/_data/phapLy.json");

  // Giá: chỉ một chỗ, phải là số
  for (const sp of banHang.sanPham || []) {
    if (!Number.isInteger(sp.gia) || sp.gia <= 0) loi.push(`Bán hàng: món "${sp.ten}" có giá không phải số dương (${sp.gia}).`);
    if (sp.giaSau != null && sp.giaSau !== "" && !(sp.giaSau > sp.gia)) loi.push(`Bán hàng: món "${sp.ten}" có giá sau (${sp.giaSau}) không lớn hơn giá đang bán (${sp.gia}).`);
    if (sp.phong && !(banHang.phong || {})[sp.phong]) loi.push(`Bán hàng: món "${sp.ten}" trỏ tới phòng học "${sp.phong}" không tồn tại.`);
  }
  const maSp = new Set((banHang.sanPham || []).map((s) => s.ma));
  for (const nhom of ["daXong", "dangMay"]) for (const m of xuong[nhom] || []) {
    if (m.sanPham && !maSp.has(m.sanPham)) loi.push(`Ở xưởng May: thẻ "${m.ten}" lấy giá từ mã "${m.sanPham}" nhưng 💳 Bán hàng không có mã này.`);
  }

  // Bài test: dữ liệu đủ và chấm ra đúng kết quả
  for (const B of kiemTra.bai || []) {
    const ma = B.ketQua.map((r) => r.ma);
    if (new Set(ma).size !== ma.length) loi.push(`Bài test ${B.ma}: có mã kết quả bị trùng.`);
    for (const r of B.ketQua) if (!r.ten || !r.moTa) loi.push(`Bài test ${B.ma}: kết quả "${r.ma}" thiếu tên hoặc mô tả.`);
    if (B.kieu !== "chon") continue;
    const coMat = new Set();
    B.cau.forEach((c, i) => {
      if (!c.chon || c.chon.length < 2) loi.push(`Bài test ${B.ma}: câu ${i + 1} có ít hơn 2 lựa chọn.`);
      for (const o of c.chon || []) {
        if (!ma.includes(o.kq)) loi.push(`Bài test ${B.ma}: câu ${i + 1} có lựa chọn trỏ tới kết quả lạ "${o.kq}".`);
        coMat.add(o.kq);
      }
    });
    for (const m of ma) if (!coMat.has(m)) loi.push(`Bài test ${B.ma}: không câu nào dẫn tới kết quả "${m}".`);
    // Người luôn chọn kiểu X (khi có thể) phải ra đúng X
    for (const X of ma) {
      const dem = Object.fromEntries(ma.map((m) => [m, 0]));
      const tl = B.cau.map((c) => {
        const o = c.chon.find((o) => o.kq === X) || [...c.chon].sort((a, b) => dem[a.kq] - dem[b.kq])[0];
        dem[o.kq]++;
        return o.kq;
      });
      const r = cham(B, tl);
      if (r.kq !== X || r.ngang) loi.push(`Bài test ${B.ma}: người chọn toàn kiểu "${X}" lại ra "${r.kq}"${r.ngang ? " (ngang điểm)" : ""}.`);
    }
  }

  // Chính sách: sửa nội dung thì phải nâng phiên bản
  const khoa = fs.existsSync(path.join(GOC, KHOA_PHAP_LY)) ? json(KHOA_PHAP_LY) : {};
  const hienTai = maPhapLy();
  if (khoa[phapLy.phienBan] !== hienTai) {
    loi.push(khoa[phapLy.phienBan]
      ? `Nội dung Chính sách bảo mật hoặc Điều khoản đã đổi nhưng phienBan (${phapLy.phienBan}) chưa đổi. Nâng phienBan trong src/_data/phapLy.json, rồi chạy: npm run khoa-phap-ly`
      : `Phiên bản chính sách ${phapLy.phienBan} chưa được khoá. Chạy: npm run khoa-phap-ly`);
  }

  // Lời ký phải có
  if (!site.chu?.kyTen) loi.push("Cài đặt: ô Lời ký đang trống.");

  // Không để lộ khoá bí mật trong repo
  const MAU_KHOA = [/\bre_[A-Za-z0-9_]{20,}/, /\bsk-[A-Za-z0-9_-]{20,}/, /\bghp_[A-Za-z0-9]{30,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
  const quet = (thuMuc) => {
    for (const f of fs.readdirSync(path.join(GOC, thuMuc), { withFileTypes: true })) {
      const p = path.join(thuMuc, f.name);
      if (f.isDirectory()) { if (!["node_modules", ".git", "_site", ".wrangler", "images", "qua"].includes(f.name)) quet(p); continue; }
      if (!/\.(js|mjs|json|jsonc|md|njk|yml|yaml|html|css|txt|toml)$/.test(f.name)) continue;
      const t = doc(p);
      if (MAU_KHOA.some((m) => m.test(t))) loi.push(`Có thứ trông giống khoá bí mật trong file ${p}. Xoá khỏi file, khoá chỉ đặt trên Cloudflare.`);
    }
  };
  quet("src"); quet("worker"); quet("scripts");
  for (const f of ["wrangler.jsonc", ".pages.yml", "package.json", "README.md"]) if (fs.existsSync(path.join(GOC, f)) && MAU_KHOA.some((m) => m.test(doc(f)))) loi.push(`Có thứ trông giống khoá bí mật trong file ${f}.`);

  return loi;
}

// Chữ không được lọt lên web
const CAM = [
  [/\bmay\.lat\b/i, "tên miền cũ may.lat"],
  [/workers\.dev/i, "địa chỉ tạm workers.dev"],
  [/\[(điền|thêm|chèn|link|todo|sửa|placeholder)[^\]]*\]/i, "chữ tạm trong ngoặc vuông"],
  [/\bTODO\b|lorem ipsum/i, "chữ nháp"],
  [/\bundefined\b|\[object Object\]|\bNaN\b/, "lỗi dữ liệu (undefined, NaN…)"],
  [/Ôm ôm,\s*May|— May(?! Phung)\b/, "lời ký cũ"],
];
const chuThay = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

export function kiemTraKetQua(thuMuc = path.join(GOC, "_site")) {
  const loi = [];
  const site = json("src/_data/site.json");
  const banHang = json("src/_data/banHang.json");
  const trang = [];
  const di = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) { if (f.name !== "assets") di(p); } else if (f.name.endsWith(".html")) trang.push(p); } };
  di(thuMuc);
  for (const p of trang) {
    const html = fs.readFileSync(p, "utf8");
    const ten = "/" + path.relative(thuMuc, p).replace(/index\.html$/, "");
    const chu = chuThay(html) + " " + [...html.matchAll(/(?:content|alt|title|aria-label)="([^"]*)"/g)].map((k) => k[1]).join(" ");
    for (const [m, ly] of CAM) { const k = chu.match(m); if (k) loi.push(`${ten}: có ${ly} ("${k[0]}").`); }
    if (!/<title>[^<]+<\/title>/.test(html)) loi.push(`${ten}: thiếu tiêu đề trang.`);
    if (!ten.includes("404") && !/<meta name="description" content="[^"]+"/.test(html)) loi.push(`${ten}: thiếu mô tả cho Google.`);
    for (const k of html.matchAll(/class="(?:signoff|signature)">([^<]*)</g)) if (k[1].trim() !== site.chu.kyTen) loi.push(`${ten}: lời ký là "${k[1].trim()}", không khớp lời ký trong Cài đặt.`);
  }
  // Giá khoá học trên trang bán và thẻ Ở xưởng May phải khớp giá thu tiền
  const kd = (banHang.sanPham || []).find((s) => s.ma === "emotion-course");
  if (kd) {
    const giaChu = kd.gia.toLocaleString("vi-VN") + "đ";
    for (const t of ["khoang-dung-cam-xuc", "o-xuong-may"]) {
      const p = path.join(thuMuc, t, "index.html");
      if (fs.existsSync(p) && !fs.readFileSync(p, "utf8").includes(giaChu)) loi.push(`/${t}/: không thấy giá ${giaChu} như trong 💳 Bán hàng.`);
    }
  }
  return loi;
}

export function baoLoi(loi, buoc) {
  if (!loi.length) return;
  const thu = `\n✋ Web chưa được đưa lên vì còn ${loi.length} lỗi (${buoc}):\n` + loi.map((l) => "  • " + l).join("\n") + "\n";
  throw new Error(thu);
}

// Chạy tay: node scripts/kiem-tra.mjs  |  node scripts/kiem-tra.mjs khoa
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  if (process.argv[2] === "khoa") {
    const phapLy = json("src/_data/phapLy.json");
    const khoa = fs.existsSync(path.join(GOC, KHOA_PHAP_LY)) ? json(KHOA_PHAP_LY) : {};
    if (khoa[phapLy.phienBan] && khoa[phapLy.phienBan] !== maPhapLy()) {
      console.error(`Phiên bản ${phapLy.phienBan} đã khoá với nội dung khác. Nâng phienBan trong src/_data/phapLy.json trước.`);
      process.exit(1);
    }
    khoa[phapLy.phienBan] = maPhapLy();
    fs.writeFileSync(path.join(GOC, KHOA_PHAP_LY), JSON.stringify(khoa, null, 2) + "\n");
    console.log(`Đã khoá chính sách phiên bản ${phapLy.phienBan}.`);
  } else {
    const loi = [...kiemTraNguon(), ...(fs.existsSync(path.join(GOC, "_site")) ? kiemTraKetQua() : [])];
    if (loi.length) { console.error(loi.map((l) => "• " + l).join("\n")); process.exit(1); }
    console.log("✅ Không thấy lỗi.");
  }
}
