// mayphung.com — phần chạy trên máy chủ (Cloudflare Worker)
// Trang tĩnh do Eleventy dựng; Worker chỉ lo mấy việc cần máy chủ:
//   POST /api/dang-ky        nhận email từ các ô đăng ký
//   POST /api/don            tạo đơn, trả mã QR chuyển khoản
//   GET  /api/don/:ma        trang thanh toán hỏi xem đơn đã nhận tiền chưa
//   POST /api/sepay          SePay báo có tiền vào
//   GET  /hoc/*              phòng học: chỉ mở khi có chìa khóa hợp lệ
//   POST /api/kiem-tra       bài kiểm tra: đếm người bắt đầu / làm xong, lưu câu trả lời ẩn danh
//   POST /api/kiem-tra/lien-he  người làm để lại email: lưu lại, gửi phần phân tích
//   GET  /quan-ly/           trang quản lý đơn cho May (cần mật khẩu riêng)
import banHang from "../src/_data/banHang.json";
import kiemTra from "../src/_data/kiemTra.json";

const SITE = "https://mayphung.com";
const FROM = "May Phung <may@mayphung.com>";
const MA_CHU = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const NGAY = 86400;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });

const emailHopLe = (e) => typeof e === "string" && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const sanPham = (ma) => banHang.sanPham.find((s) => s.ma === ma);
const tien = (n) => n.toLocaleString("vi-VN") + "đ";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function taoMa() {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return "MJ" + Array.from(b, (x) => MA_CHU[x % MA_CHU.length]).join("");
}

function b64url(bytes) {
  let s = "";
  for (const x of new Uint8Array(bytes)) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const b64urlText = (t) => b64url(new TextEncoder().encode(t));
function b64urlDecodeText(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function kyTen(env, phong, email) {
  if (!env.TOKEN_SECRET) throw new Error("Chưa đặt TOKEN_SECRET");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.TOKEN_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(phong + ":" + email.toLowerCase()));
  return b64url(sig).slice(0, 32);
}

async function linkPhong(env, phong, email) {
  const p = banHang.phong[phong];
  return `${SITE}${p.duongDan}?e=${b64urlText(email.toLowerCase())}&k=${await kyTen(env, phong, email)}`;
}

function qrUrl(so, ma) {
  const nh = banHang.nganHang;
  if (!nh.soTaiKhoan) return null;
  return `https://img.vietqr.io/image/${nh.maVietQr}-${nh.soTaiKhoan}-compact2.png?amount=${so}&addInfo=${ma}&accountName=${encodeURIComponent(nh.chuTaiKhoan)}`;
}

// ---------- gửi email ----------
async function guiEmail(env, { to, subject, html, replyTo }) {
  if (!env.RESEND_API_KEY) {
    console.log("Chưa có RESEND_API_KEY, bỏ qua email tới", to, subject);
    return false;
  }
  let r;
  try {
    r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM || FROM, to: [to], subject, html, reply_to: replyTo || env.EMAIL_MAY || undefined }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.log("Resend không phản hồi", String(e));
    return false;
  }
  if (!r.ok) console.log("Resend lỗi", r.status, await r.text());
  return r.ok;
}

const E = banHang.email || {};
const dien = (mau, v) => String(mau || "").replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
const doan = (t) => esc(t).split(/\n/).map((x) => `<p style="margin:0 0 14px">${x}</p>`).join("");
function khungEmail(noiDung) {
  return `<!doctype html><html><body style="margin:0;background:#F4EBE0;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#362A24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFDF8;border-radius:10px;padding:30px 28px">
<tr><td style="font-size:16px;line-height:1.7">${noiDung}
<p style="margin:28px 0 0">${esc(E.kyTen || "Ôm ôm,\nMay").replace(/\n/g, "<br>")}</p>
</td></tr></table>
<p style="font-size:12px;color:#7A6C64;margin:16px 0 0">mayphung.com · Bạn trả lời thẳng email này là May đọc được.</p>
</td></tr></table></body></html>`;
}
const nut = (href, chu) =>
  `<p style="margin:26px 0"><a href="${esc(href)}" style="background:#6E2A34;color:#FBF6EE;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:bold;display:inline-block">${esc(chu)}</a></p>`;

// ---------- Kit (danh sách email) ----------
// ---------- xử lý ----------
async function dangKy(request, env, ctx) {
  const body = await docBody(request);
  const email = String(body.email || body["fields[email]"] || "").trim().toLowerCase();
  const loai = ["chung", "qua"].includes(body.loai) ? body.loai : "chung";
  if (!emailHopLe(email)) return json({ ok: false, loi: "Email chưa đúng, bạn xem lại giúp May nhé." }, 400);
  const k = `dk:${email}`;
  const cu = (await env.DB.get(k, "json")) || { email, luc: Date.now(), loai: [] };
  if (!cu.loai.includes(loai)) cu.loai.push(loai);
  const coQua = loai === "qua" && !!banHang.quaTang.link && !!env.RESEND_API_KEY;
  if (coQua) cu.quaGui = Date.now();
  await env.DB.put(k, JSON.stringify(cu));
  if (coQua) ctx.waitUntil(guiQua(env, email).then((ok) => { if (!ok) { delete cu.quaGui; return env.DB.put(k, JSON.stringify(cu)); } }));
  return json({ ok: true, daGuiQua: coQua });
}

function guiQua(env, email) {
  const v = { ten: banHang.quaTang.ten };
  return guiEmail(env, {
    to: email,
    subject: dien(E.quaTieuDe || "May gửi bạn sổ tay {ten}", v),
    html: khungEmail(doan(dien(E.quaMoDau, v)) + nut(banHang.quaTang.link, dien(E.quaNut || "Mở sổ tay", v)) + doan(dien(E.quaKet, v))),
  });
}

// Người đăng ký nhận quà từ trước khi có file: chưa ai gửi cho họ
async function chuaNhanQua(env) {
  const out = [];
  let cursor;
  do {
    const l = await env.DB.list({ prefix: "dk:", cursor });
    for (const x of l.keys) {
      const e = await env.DB.get(x.name, "json");
      if (e && e.loai?.includes("qua") && !e.quaGui) out.push(e);
    }
    cursor = l.list_complete ? null : l.cursor;
  } while (cursor);
  return out;
}

async function taoDon(request, env) {
  const body = await docBody(request);
  const email = String(body.email || "").trim().toLowerCase();
  const sp = sanPham(String(body.sp || ""));
  if (!sp) return json({ ok: false, loi: "Không tìm thấy món này." }, 400);
  if (!emailHopLe(email)) return json({ ok: false, loi: "Email chưa đúng, bạn xem lại giúp May nhé." }, 400);
  if (!banHang.nganHang.soTaiKhoan || !env.TOKEN_SECRET) return json({ ok: false, loi: "May đang hoàn tất phần chuyển khoản. Bạn quay lại sau ít phút nhé." }, 503);
  let ma = taoMa();
  for (let i = 0; i < 3 && (await env.DB.get(`don:${ma}`)); i++) ma = taoMa();
  const don = { ma, email, sp: sp.ma, ten: sp.ten, gia: sp.gia, phong: sp.phong, trangThai: "cho", luc: Date.now() };
  await env.DB.put(`don:${ma}`, JSON.stringify(don), { expirationTtl: 30 * NGAY });
  return json({ ok: true, ma, gia: sp.gia, giaChu: tien(sp.gia), qr: qrUrl(sp.gia, ma), nganHang: banHang.nganHang });
}

async function xemDon(ma, env) {
  const don = await env.DB.get(`don:${ma}`, "json");
  if (!don) return json({ ok: false }, 404);
  const out = { ok: true, trangThai: don.trangThai };
  if (don.trangThai === "da-nhan") out.link = await linkPhong(env, don.phong, don.email);
  return json(out);
}

async function guiChiaKhoa(env, don) {
  const link = await linkPhong(env, don.phong, don.email);
  const v = { phong: banHang.phong[don.phong].ten, mon: don.ten, gia: tien(don.gia), ma: don.ma };
  return guiEmail(env, {
    to: don.email,
    subject: dien(E.chiaKhoaTieuDe || "Chìa khóa vào {phong} của bạn", v),
    html: khungEmail(doan(dien(E.chiaKhoaMoDau, v)) + nut(link, dien(E.chiaKhoaNut || "Vào {phong}", v)) + doan(dien(E.chiaKhoaKet, v))),
  });
}

async function xacNhanDon(env, don, nguon) {
  if (don.trangThai === "da-nhan") return false;
  don.trangThai = "da-nhan";
  don.nhanLuc = Date.now();
  don.nguon = nguon;
  await env.DB.put(`don:${don.ma}`, JSON.stringify(don), { expirationTtl: 3650 * NGAY });
  const ds = (await env.DB.get(`mua:${don.email}`, "json")) || [];
  if (!ds.includes(don.phong)) ds.push(don.phong);
  await env.DB.put(`mua:${don.email}`, JSON.stringify(ds));
  await guiChiaKhoa(env, don);
  if (env.EMAIL_MAY) {
    await guiEmail(env, {
      to: env.EMAIL_MAY,
      subject: `🎉 Đơn mới: ${don.ten} · ${tien(don.gia)}`,
      html: khungEmail(`<p>Có đơn mới vừa thanh toán xong.</p><p><strong>${esc(don.ten)}</strong> · ${tien(don.gia)}<br>Người mua: ${esc(don.email)}<br>Mã đơn: ${don.ma}<br>Xác nhận bởi: ${nguon}</p><p>Web đã tự gửi chìa khóa cho người mua.</p>`),
    });
  }
  return true;
}

async function sepay(request, env, ctx) {
  const auth = request.headers.get("authorization") || "";
  if (!env.SEPAY_API_KEY || auth.replace(/^Apikey\s+/i, "").trim() !== env.SEPAY_API_KEY) return json({ success: false }, 401);
  const tx = await request.json().catch(() => null);
  if (!tx) return json({ success: false }, 400);
  if (tx.transferType !== "in") return json({ success: true });
  if (tx.id && (await env.DB.get(`gd:${tx.id}`))) return json({ success: true });
  if (tx.id) await env.DB.put(`gd:${tx.id}`, "1", { expirationTtl: 90 * NGAY });
  const chu = `${tx.code || ""} ${tx.content || ""} ${tx.description || ""}`.toUpperCase().replace(/[^A-Z0-9]/g, " ");
  const gop = chu.replace(/\s+/g, "");
  const cacMa = new Set([...(chu.match(/MJ[A-Z0-9]{6}/g) || []), ...(gop.match(/MJ[A-Z0-9]{6}/g) || [])]);
  for (const ma of cacMa) {
    const don = await env.DB.get(`don:${ma}`, "json");
    if (!don) continue;
    if (Number(tx.transferAmount) >= don.gia) {
      ctx.waitUntil(xacNhanDon(env, don, "SePay"));
    } else {
      don.ghiChu = `Nhận ${tx.transferAmount}, thiếu so với ${don.gia}`;
      await env.DB.put(`don:${ma}`, JSON.stringify(don), { expirationTtl: 30 * NGAY });
    }
    break;
  }
  return json({ success: true });
}


// ---------- bài kiểm tra ----------
const baiKt = (ma) => (kiemTra.bai || []).find((b) => b.ma === ma && b.hien !== false);
const kqKt = (bai, ma) => (bai.ketQua || []).find((r) => r.ma === ma);
const maNgau = () => Date.now().toString(36) + b64url(crypto.getRandomValues(new Uint8Array(4)));

async function tang(env, khoa) {
  const n = Number((await env.DB.get(khoa)) || 0) + 1;
  await env.DB.put(khoa, String(n), { metadata: { n } });
  return n;
}

function diemGon(diem) {
  if (!diem || typeof diem !== "object") return {};
  const out = {};
  for (const [k, v] of Object.entries(diem).slice(0, 12)) if (typeof v === "number" && isFinite(v)) out[String(k).slice(0, 20)] = Math.round(v * 100) / 100;
  return out;
}

async function kiemTraGhi(request, env) {
  const body = await docBody(request);
  const bai = baiKt(String(body.bai || ""));
  if (!bai) return json({ ok: false }, 400);
  if (body.buoc === "bat-dau") {
    await tang(env, `dem:${bai.ma}:_bat-dau`);
    return json({ ok: true });
  }
  if (body.buoc !== "xong" || !kqKt(bai, String(body.kq || ""))) return json({ ok: false }, 400);
  const kq = String(body.kq);
  const phu = kqKt(bai, String(body.phu || "")) ? String(body.phu) : "";
  let traLoi = body.traLoi;
  try { traLoi = JSON.parse(JSON.stringify(traLoi ?? null)); } catch { traLoi = null; }
  if (JSON.stringify(traLoi || "").length > 2000) traLoi = null;
  await env.DB.put(`kt:${bai.ma}:${maNgau()}`, JSON.stringify({ luc: Date.now(), kq, phu, diem: diemGon(body.diem), doTinCay: String(body.doTinCay || "").slice(0, 8), traLoi }), { expirationTtl: 730 * NGAY });
  await tang(env, `dem:${bai.ma}:_xong`);
  await tang(env, `dem:${bai.ma}:${kq}`);
  return json({ ok: true });
}

// Phần phân tích viết trong kiemTra.json: "## " là tiêu đề nhỏ, "- " là gạch đầu dòng
function phanTichHtml(t) {
  let out = "", ds = false;
  const chu = (x) => esc(x).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  for (let d of String(t || "").split(/\n/)) {
    d = d.trim();
    if (!d) continue;
    if (d.startsWith("- ")) { if (!ds) { out += '<ul style="margin:0 0 14px;padding-left:20px">'; ds = true; } out += `<li style="margin:0 0 8px">${chu(d.slice(2))}</li>`; continue; }
    if (ds) { out += "</ul>"; ds = false; }
    out += d.startsWith("## ") ? `<h3 style="font-family:Georgia,serif;color:#6E2A34;font-size:19px;margin:26px 0 8px">${chu(d.slice(3))}</h3>` : `<p style="margin:0 0 14px">${chu(d)}</p>`;
  }
  return out + (ds ? "</ul>" : "");
}

async function guiPhanTich(env, bai, r, email, r2, diem) {
  const v = { ten: r.ten, phu: r.phu || "", loiNhan: r.loiNhan || "" };
  const T = bai.buocTiep || {};
  const C = kiemTra.chu || {};
  const link = (x) => (String(x || "").startsWith("/") ? SITE + x : x);
  const chu = (x) => esc(x).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  const mau = { "do-ruou": "#6E2A34", than: "#362A24", "dat-nung": "#A8522B" }[bai.mau] || "#6E2A34";
  // khối kết quả
  let kq = `<div style="background:${mau};color:#FBF6EE;border-radius:10px;padding:22px 24px;margin:6px 0 22px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.85">${esc(bai.ten)}</p>
<p style="margin:0;font-family:Georgia,serif;font-size:26px;line-height:1.25;font-weight:bold">${esc(r.ten)}</p>
${r.phu ? `<p style="margin:4px 0 0;font-size:13px;opacity:.85">${esc(r.phu)}</p>` : ""}
<p style="margin:14px 0 0">${chu(r.moTa)}</p></div>`;
  if (r.dau?.length) kq += `<p style="margin:0 0 4px">${esc(C.banCoThe || "Bạn có thể:")}</p><ul style="margin:0 0 14px;padding-left:20px">${r.dau.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
  if (r.canGi) kq += `<p style="margin:0 0 14px;padding:12px 16px;border:1.5px dashed #A8522B;border-radius:8px">${bai.nhanCanGi ? `<strong>${esc(bai.nhanCanGi)}</strong> ` : ""}${chu(r.canGi)}</p>`;
  if (r.loiNhan) kq += `<p style="margin:0 0 18px;padding-left:14px;border-left:3px solid #C1653A;font-style:italic;color:#A8522B">${esc(r.loiNhan)}</p>`;
  // điểm từng kiểu
  if (diem && bai.kieu !== "thang") {
    const toiDa = {};
    for (const c of bai.cau || []) for (const o of c.chon || []) toiDa[o.kq] = (toiDa[o.kq] || 0) + 1;
    const xep = (bai.ketQua || []).slice().sort((a, b) => (diem[b.ma] || 0) - (diem[a.ma] || 0));
    kq += `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 18px;font-size:14px">${xep
      .map((x) => {
        const n = diem[x.ma] || 0, w = Math.round((n / (toiDa[x.ma] || 1)) * 100);
        return `<tr><td style="padding:4px 10px 4px 0;white-space:nowrap;${x.ma === r.ma ? "font-weight:bold;color:#6E2A34" : ""}">${esc(x.ten)}</td><td style="width:60%;padding:4px 0"><div style="background:#EADFD3;border-radius:99px;height:10px"><div style="background:${x.ma === r.ma ? "#C1653A" : "#C9B8A8"};width:${w}%;height:10px;border-radius:99px"></div></div></td><td style="padding:4px 0 4px 10px;text-align:right;color:#7A6C64">${n}</td></tr>`;
      })
      .join("")}</table>`;
  }
  if (r2) kq += `<p style="margin:0 0 18px">${esc(String(C.ngangNhau || "").replace("{ds}", `${r.ten} và ${r2.ten}`))}</p>`;
  const html = khungEmail(
    doan(dien(bai.email?.moDau || "Cảm ơn bạn đã làm bài test cùng May.", v).split("\n")[0]) +
      kq +
      `<h2 style="font-family:Georgia,serif;color:#6E2A34;font-size:22px;margin:30px 0 4px;border-top:1px dotted #6E2A34;padding-top:20px">${esc(C.tieuDePhanTich || "Phân tích chi tiết")}</h2>` +
      phanTichHtml(r.phanTich) +
      (r2 ? `<h2 style="font-family:Georgia,serif;color:#6E2A34;font-size:22px;margin:34px 0 4px;border-top:1px dotted #6E2A34;padding-top:20px">${esc(r2.ten)}</h2><p style="margin:0 0 14px">${chu(r2.moTa)}</p>` + phanTichHtml(r2.phanTich) : "") +
      (bai.ket ? `<p style="margin:22px 0 0;font-family:Georgia,serif;font-style:italic;color:#6E2A34">${esc(bai.ket)}</p>` : "") +
      (T.link && T.nut ? `<p style="margin:26px 0 0">${esc(String(T.chu || "").replace(/\*/g, ""))}</p>` + nut(link(T.link), T.nut) : "") +
      `<p style="margin:18px 0 0;font-size:14px"><a href="${SITE}/kiem-tra/" style="color:#A8522B">${esc(C.lamThemEmail || "Làm thêm bài test khác của May")}</a></p>`
  );
  return guiEmail(env, { to: email, subject: dien(bai.email?.tieuDe || "Kết quả bài test của bạn: {ten}", v), html });
}

async function kiemTraLienHe(request, env, ctx) {
  const body = await docBody(request);
  const bai = baiKt(String(body.bai || ""));
  const r = bai && kqKt(bai, String(body.kq || ""));
  if (!r) return json({ ok: false, loi: "Không tìm thấy bài test này." }, 400);
  const email = String(body.email || "").trim().toLowerCase();
  if (!emailHopLe(email)) return json({ ok: false, loi: "Email chưa đúng, bạn xem lại giúp May nhé." }, 400);
  const phu = kqKt(bai, String(body.phu || "")) ? String(body.phu) : "";
  const diem = diemGon(body.diem);
  // cùng một người bấm gửi lại trong 10 phút: chỉ gửi lại thư, không đếm thêm
  const khoaMoi = `lh-moi:${bai.ma}:${email}`;
  if (!(await env.DB.get(khoaMoi))) {
    await env.DB.put(khoaMoi, "1", { expirationTtl: 600 });
    const ban = { luc: Date.now(), bai: bai.ma, kq: r.ma, phu, diem, email, zalo: "" };
    await env.DB.put(`lh:${maNgau()}`, JSON.stringify(ban), { metadata: { luc: ban.luc, bai: bai.ma, kq: r.ma, phu, email, zalo: "" } });
    await tang(env, `dem:${bai.ma}:_lien-he`);
    const k = `dk:${email}`;
    const cu = (await env.DB.get(k, "json")) || { email, luc: Date.now(), loai: [] };
    if (!cu.loai.includes("kiem-tra")) cu.loai.push("kiem-tra");
    cu.kiemTra = { ...(cu.kiemTra || {}), [bai.ma]: r.ma };
    await env.DB.put(k, JSON.stringify(cu));
  }
  const daGui = env.RESEND_API_KEY ? await guiPhanTich(env, bai, r, email, body.ngang === true && phu ? kqKt(bai, phu) : null, diem) : false;
  return json({ ok: true, daGui: !!daGui });
}

async function soLieuKt(env) {
  const dem = {};
  let cursor;
  do {
    const l = await env.DB.list({ prefix: "dem:", cursor });
    for (const x of l.keys) dem[x.name.slice(4)] = x.metadata?.n ?? Number((await env.DB.get(x.name)) || 0);
    cursor = l.list_complete ? null : l.cursor;
  } while (cursor);
  return dem;
}
async function dsLienHe(env, gioiHan = 1000) {
  const out = [];
  let cursor;
  do {
    const l = await env.DB.list({ prefix: "lh:", cursor });
    for (const x of l.keys) if (x.metadata) out.push(x.metadata);
    cursor = l.list_complete || out.length >= gioiHan ? null : l.cursor;
  } while (cursor);
  return out.sort((a, b) => b.luc - a.luc);
}
const tenKq = (baiMa, kqMa) => { const b = (kiemTra.bai || []).find((x) => x.ma === baiMa); return (b && kqKt(b, kqMa)?.ten) || kqMa || ""; };
const tenBai = (ma) => (kiemTra.bai || []).find((x) => x.ma === ma)?.ten || ma;
const csvO = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

// ---------- phòng học ----------
async function phongHoc(request, env, url) {
  const ten = url.pathname.split("/")[2] || "";
  if (!banHang.phong[ten]) return env.ASSETS.fetch(request);
  const p = banHang.phong[ten];
  const xemTruoc = (env.ADMIN_KEY && url.searchParams.get("xem") === env.ADMIN_KEY) || (await laMayDangNhap(request, env));
  if (!env.TOKEN_SECRET && !xemTruoc) return new Response(trangKhoa(p.ten), { status: 403, headers: { "content-type": "text/html; charset=utf-8" } });
  const cookieName = `chia_${ten.replace(/-/g, "_")}`;
  let e = url.searchParams.get("e");
  let k = url.searchParams.get("k");
  if (!e || !k) {
    const c = (request.headers.get("cookie") || "").split(/;\s*/).find((x) => x.startsWith(cookieName + "="));
    if (c) [e, k] = decodeURIComponent(c.slice(cookieName.length + 1)).split(".");
  }
  let email = "";
  try { email = e ? b64urlDecodeText(e) : ""; } catch { email = ""; }
  const laMay = !!xemTruoc;
  const hopLe = !laMay && env.TOKEN_SECRET && email && k && (await kyTen(env, ten, email)) === k;
  if (hopLe && (await env.DB.get(`thu-hoi:${ten}:${email.toLowerCase()}`))) {
    return new Response(trangKhoa(p.ten, "Chìa khóa này đã ngừng dùng. Nếu bạn nghĩ có nhầm lẫn, trả lời email của May để May xem giúp nhé."), { status: 403, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "set-cookie": `${cookieName}=; Path=/hoc/${ten}/; Max-Age=0; Secure; HttpOnly; SameSite=Lax` } });
  }
  if (laMay || hopLe) {
    const res0 = await env.ASSETS.fetch(new Request(new URL(url.pathname, url.origin), request));
    const chu = laMay ? "May đang xem trước phòng này" : `Phòng học của: ${email.toLowerCase()}`;
    const res = new HTMLRewriter()
      .on("[data-chu-phong]", { element(el) { el.removeAttribute("hidden"); el.setInnerContent(chu); } })
      .transform(res0);
    const out = new Response(res.body, res);
    out.headers.set("cache-control", "private, no-store");
    out.headers.set("x-robots-tag", "noindex");
    if (!laMay && url.searchParams.has("k")) {
      out.headers.append("set-cookie", `${cookieName}=${encodeURIComponent(e + "." + k)}; Path=/hoc/${ten}/; Max-Age=${3650 * NGAY}; Secure; HttpOnly; SameSite=Lax`);
    }
    return out;
  }
  return new Response(trangKhoa(p.ten), { status: 403, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } });
}

function trangKhoa(ten, loiRieng) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(ten)} — May Phung</title>
<style>body{margin:0;background:#F4EBE0;color:#362A24;font:17px/1.7 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:20px}main{max-width:460px;background:#FFFDF8;padding:34px 30px;border-radius:12px}h1{font-family:Georgia,serif;color:#6E2A34;font-weight:500;margin:0 0 12px}a{color:#A8522B}</style></head>
<body><main><h1>Phòng này cần chìa khóa</h1>${loiRieng ? `<p>${esc(loiRieng)}</p>` : `<p>Bạn mở <strong>${esc(ten)}</strong> bằng đường dẫn trong email May gửi sau khi thanh toán nhé. Mỗi người có một đường dẫn riêng.</p><p>Không tìm thấy email? Xem thử mục Quảng cáo, Spam, hoặc trả lời bất kỳ email nào của May để May gửi lại.</p>`}<p><a href="/">← Về nhà May</a></p></main></body></html>`;
}

// ---------- trang quản lý ----------
async function maPhien(env) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.ADMIN_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("quan-ly-may"))).slice(0, 40);
}
async function laMayDangNhap(request, env) {
  if (!env.ADMIN_KEY) return false;
  const c = (request.headers.get("cookie") || "").split(/;\s*/).find((x) => x.startsWith("qly="));
  return !!c && c.slice(4) === (await maPhien(env));
}
const khungTrang = (tieuDe, than) => `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${tieuDe}</title>
<style>body{font:15px/1.6 system-ui,sans-serif;background:#F4EBE0;color:#362A24;margin:0;padding:24px}h1{color:#6E2A34;font-family:Georgia,serif;font-weight:500}table{border-collapse:collapse;width:100%;background:#FFFDF8}td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left;vertical-align:top}button{margin-top:6px;background:#6E2A34;color:#fff;border:0;border-radius:99px;padding:9px 16px;cursor:pointer;font:inherit}input[type=password]{font:inherit;padding:10px;border:1px solid #bbb;border-radius:6px;width:100%;max-width:340px;box-sizing:border-box}.box{background:#FFFDF8;padding:26px;border-radius:12px;max-width:420px}a{color:#A8522B}.links a{margin-right:18px}</style></head><body>${than}</body></html>`;
const html = (b, status = 200, extra = {}) => new Response(b, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex", ...extra } });

function trangDangNhap(loi) {
  return khungTrang("Đăng nhập", `<div class="box"><h1>Chào May</h1>${loi ? `<p style="color:#A8522B">${loi}</p>` : ""}<form method="post"><input type="hidden" name="hanhDong" value="dang-nhap"><label>Mật khẩu quản lý<br><input type="password" name="matKhau" autofocus required></label><br><button>Vào</button></form></div>`);
}
async function quanLy(request, env, url) {
  if (!env.ADMIN_KEY) return html(trangDangNhap("Máy chủ chưa có ADMIN_KEY trong Runtime variables. Thêm xong đợi 1 phút rồi tải lại."), 503);
  let daVao = await laMayDangNhap(request, env);
  const k = url.searchParams.get("k");
  if (!daVao && k && k === env.ADMIN_KEY) daVao = true;
  const datPhien = async () => `qly=${await maPhien(env)}; Path=/; Max-Age=${30 * NGAY}; Secure; HttpOnly; SameSite=Lax`;
  if (request.method === "POST") {
    const body = await docBody(request);
    if (body.hanhDong === "dang-nhap") {
      if (String(body.matKhau || "").trim() !== env.ADMIN_KEY.trim()) return html(trangDangNhap("Mật khẩu chưa đúng. May thử lại nhé."), 403);
      return new Response(null, { status: 303, headers: { location: "/quan-ly/", "set-cookie": await datPhien() } });
    }
    if (!daVao) return html(trangDangNhap(), 403);
    if (body.hanhDong === "gui-qua-con-thieu" && banHang.quaTang.link && env.RESEND_API_KEY) {
      for (const e of await chuaNhanQua(env)) {
        if (!(await guiQua(env, e.email))) continue;
        e.quaGui = Date.now();
        await env.DB.put(`dk:${e.email}`, JSON.stringify(e));
        await new Promise((ok) => setTimeout(ok, 600));
      }
      return Response.redirect(`${url.origin}/quan-ly/`, 303);
    }
    if (body.hanhDong === "dang-xuat") return new Response(null, { status: 303, headers: { location: "/quan-ly/", "set-cookie": "qly=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax" } });
    const don = await env.DB.get(`don:${String(body.ma || "")}`, "json");
    if (don) {
      const khoa = `thu-hoi:${don.phong}:${don.email}`;
      if (body.hanhDong === "thu-hoi") await env.DB.put(khoa, String(Date.now()));
      else if (body.hanhDong === "mo-lai") await env.DB.delete(khoa);
      else if (body.hanhDong === "gui-lai" && don.trangThai === "da-nhan") await guiChiaKhoa(env, don);
      else if (body.hanhDong === "xac-nhan") await xacNhanDon(env, don, "May xác nhận tay");
    }
    return Response.redirect(`${url.origin}/quan-ly/`, 303);
  }
  if (!daVao) return html(trangDangNhap());
  const list = await env.DB.list({ prefix: "don:" });
  const dons = (await Promise.all(list.keys.map((x) => env.DB.get(x.name, "json")))).filter(Boolean).sort((a, b) => b.luc - a.luc);
  const dk = await env.DB.list({ prefix: "dk:" });
  const daThuHoi = new Set((await env.DB.list({ prefix: "thu-hoi:" })).keys.map((x) => x.name));
  const nutForm = (ma, hd, chu, hoi, mau) =>
    `<form method="post" style="display:inline" onsubmit="return confirm('${hoi}')"><input type="hidden" name="ma" value="${ma}"><input type="hidden" name="hanhDong" value="${hd}"><button${mau ? ` style="background:${mau}"` : ""}>${chu}</button></form> `;
  const rows = dons
    .map((d) => {
      let tt;
      if (d.trangThai === "da-nhan") {
        const bi = daThuHoi.has(`thu-hoi:${d.phong}:${d.email}`);
        tt = (bi ? `⛔ đã thu hồi chìa khóa<br>` : `✅ đã nhận<br><small>${esc(d.nguon || "")}</small><br>`) +
          (bi
            ? nutForm(d.ma, "mo-lai", "Mở lại", `Mở lại chìa khóa cho ${esc(d.email)}?`)
            : nutForm(d.ma, "gui-lai", "Gửi lại chìa khóa", `Gửi lại email chìa khóa cho ${esc(d.email)}?`, "#A8522B") +
              nutForm(d.ma, "thu-hoi", "Thu hồi", `Thu hồi chìa khóa của ${esc(d.email)}? Người này sẽ không vào phòng được nữa.`, "#7A6C64"));
      } else {
        tt = `chờ tiền${d.ghiChu ? `<br><small>${esc(d.ghiChu)}</small>` : ""}<br>` +
          nutForm(d.ma, "xac-nhan", "Đã nhận tiền", `Đã thấy ${tien(d.gia)} với nội dung ${d.ma} trong tài khoản? Web sẽ gửi chìa khóa cho ${esc(d.email)}.`);
      }
      return `<tr><td>${new Date(d.luc).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td><td><b>${d.ma}</b></td><td>${esc(d.ten)}<br><small>${tien(d.gia)}</small></td><td>${esc(d.email)}</td><td>${tt}</td></tr>`;
    })
    .join("");
  const thieu = ["TOKEN_SECRET", "RESEND_API_KEY", "SEPAY_API_KEY"].filter((x) => !env[x]);
  const dsEmail = (await Promise.all(dk.keys.slice(0, 50).map((x) => env.DB.get(x.name, "json")))).filter(Boolean).sort((a, b) => b.luc - a.luc);
  const than = `<h1>Đơn hàng</h1>
<p class="links"><a href="/hoc/emotion-course/">Xem phòng Emotion Course</a><a href="/hoc/soi-chieu/">Xem phòng Soi Chiếu</a></p>
${thieu.length ? `<p style="color:#A8522B">Máy chủ còn thiếu: ${thieu.join(", ")}</p>` : `<p>✅ Đủ khóa: thanh toán, gửi email, phòng học.</p>`}
<p>${dons.filter((d) => d.trangThai === "da-nhan").length} đơn đã thanh toán · ${dk.keys.length} email đăng ký
</p>
<table><tr><th>Lúc</th><th>Mã</th><th>Món</th><th>Email</th><th>Trạng thái</th></tr>${rows || '<tr><td colspan="5">Chưa có đơn nào.</td></tr>'}</table>
<h2 style="color:#6E2A34;font-family:Georgia,serif;font-weight:500;margin-top:34px">Email đăng ký</h2>
<p><a href="/quan-ly/email.csv">Tải danh sách email (file CSV, nhập được vào Kit)</a></p>
${await (async () => {
  if (!banHang.quaTang.link || !env.RESEND_API_KEY) return "";
  const n = (await chuaNhanQua(env)).length;
  return n ? `<form method="post" onsubmit="return confirm('Gửi sổ tay ${esc(banHang.quaTang.ten)} cho ${n} người đã đăng ký nhận quà nhưng chưa nhận được?')"><input type="hidden" name="hanhDong" value="gui-qua-con-thieu"><p>${n} người đăng ký nhận sổ tay từ trước khi có file, chưa nhận được thư. <button>Gửi sổ tay cho ${n} người này</button></p></form>` : "<p>✅ Ai đăng ký nhận quà cũng đã được gửi.</p>";
})()}
<table><tr><th>Lúc</th><th>Email</th><th>Ô nào</th></tr>${dsEmail.map((e) => `<tr><td>${new Date(e.luc).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td><td>${esc(e.email)}</td><td>${e.loai.map((l) => (l === "qua" ? "sổ tay quà tặng" : l === "kiem-tra" ? "bài kiểm tra" : "nhận bài mới")).join(", ")}</td></tr>`).join("") || '<tr><td colspan="3">Chưa có ai.</td></tr>'}</table>
${await phanKiemTra(env)}
<form method="post" style="margin-top:28px"><input type="hidden" name="hanhDong" value="dang-xuat"><button style="background:#7A6C64">Đăng xuất</button></form>`;
  return html(khungTrang("Quản lý đơn", than), 200, k ? { "set-cookie": await datPhien() } : {});
}


async function phanKiemTra(env) {
  const dem = await soLieuKt(env);
  const lh = await dsLienHe(env, 200);
  const h2 = (t) => `<h2 style="color:#6E2A34;font-family:Georgia,serif;font-weight:500;margin-top:34px">${t}</h2>`;
  const hang = (kiemTra.bai || []).map((b) => {
    const bd = dem[`${b.ma}:_bat-dau`] || 0, xong = dem[`${b.ma}:_xong`] || 0, lien = dem[`${b.ma}:_lien-he`] || 0;
    const pt = (a, c) => (c ? ` <small>(${Math.round((a / c) * 100)}%)</small>` : "");
    const kq = (b.ketQua || []).map((r) => `${esc(r.ten)}: <b>${dem[`${b.ma}:${r.ma}`] || 0}</b>`).join("<br>");
    return `<tr><td><b>${esc(b.ten)}</b>${b.hien === false ? "<br><small>đang ẩn</small>" : ""}<br><a href="/kiem-tra/${b.ma}/">mở bài</a></td><td>${bd}</td><td>${xong}${pt(xong, bd)}</td><td>${lien}${pt(lien, xong)}</td><td>${kq}</td></tr>`;
  }).join("");
  const dong = lh.slice(0, 100).map((x) => `<tr><td>${new Date(x.luc).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td><td>${esc(tenBai(x.bai))}</td><td>${esc(tenKq(x.bai, x.kq))}${x.phu ? `<br><small>cũng khá giống: ${esc(tenKq(x.bai, x.phu))}</small>` : ""}</td><td>${esc(x.email)}${x.zalo ? `${x.email ? "<br>" : ""}Zalo: ${esc(x.zalo)}` : ""}</td></tr>`).join("");
  return `${h2("Bài kiểm tra")}
<p>Bắt đầu → làm xong → để lại email/Zalo. Câu trả lời được lưu ẩn danh.</p>
<table><tr><th>Bài</th><th>Bắt đầu</th><th>Làm xong</th><th>Để lại liên hệ</th><th>Kết quả</th></tr>${hang}</table>
${h2("Người để lại liên hệ sau bài kiểm tra")}
<p><a href="/quan-ly/kiem-tra.csv">Tải danh sách (file CSV, có cả kết quả từng người)</a></p>
<table><tr><th>Lúc</th><th>Bài</th><th>Kết quả</th><th>Liên hệ</th></tr>${dong || '<tr><td colspan="4">Chưa có ai.</td></tr>'}</table>`;
}

async function docBody(request) {
  const ct = request.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await request.json().catch(() => ({}))) || {};
  const fd = await request.formData().catch(() => null);
  return fd ? Object.fromEntries(fd) : {};
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    try {
      if (p === "/api/dang-ky" && request.method === "POST") return await dangKy(request, env, ctx);
      if (p === "/api/don" && request.method === "POST") return await taoDon(request, env);
      if (p.startsWith("/api/don/") && request.method === "GET") return await xemDon(p.slice(9).toUpperCase(), env);
      if (p === "/api/sepay" && request.method === "POST") return await sepay(request, env, ctx);
      if (p.startsWith("/hoc/")) return await phongHoc(request, env, url);
      if (p === "/quan-ly/email.csv") {
        if (!(await laMayDangNhap(request, env))) return new Response("Không có quyền.", { status: 403 });
        const ds = await env.DB.list({ prefix: "dk:" });
        const rows = (await Promise.all(ds.keys.map((x) => env.DB.get(x.name, "json")))).filter(Boolean);
        const csv = "email,ngay_dang_ky,o_dang_ky\n" + rows.map((e) => `${e.email},${new Date(e.luc).toISOString().slice(0, 10)},${e.loai.join(" ")}`).join("\n");
        return new Response("\ufeff" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="email-mayphung.csv"', "cache-control": "no-store" } });
      }
      if (p === "/api/kiem-tra" && request.method === "POST") return await kiemTraGhi(request, env);
      if (p === "/api/kiem-tra/lien-he" && request.method === "POST") return await kiemTraLienHe(request, env, ctx);
      if (p === "/quan-ly/kiem-tra.csv") {
        if (!(await laMayDangNhap(request, env))) return new Response("Không có quyền.", { status: 403 });
        const ds = await dsLienHe(env, 10000);
        const csv = "ngay,bai,ket_qua,gan_thu_hai,email,zalo\n" + ds.map((x) => [new Date(x.luc).toISOString().slice(0, 10), tenBai(x.bai), tenKq(x.bai, x.kq), x.phu ? tenKq(x.bai, x.phu) : "", x.email, x.zalo].map(csvO).join(",")).join("\n");
        return new Response("\ufeff" + csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="kiem-tra-mayphung.csv"', "cache-control": "no-store" } });
      }
      if (p === "/quan-ly/" || p === "/quan-ly") return await quanLy(request, env, url);
      if (p.startsWith("/api/")) return json({ ok: false }, 404);
    } catch (e) {
      console.log("Lỗi", p, e.stack || e.message);
      return json({ ok: false, loi: "Có trục trặc nhỏ. Bạn thử lại giúp May nhé." }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};
