// mayphung.com — phần chạy trên máy chủ (Cloudflare Worker)
// Trang tĩnh do Eleventy dựng; Worker chỉ lo mấy việc cần máy chủ:
//   POST /api/dang-ky        nhận email từ các ô đăng ký
//   POST /api/don            tạo đơn, trả mã QR chuyển khoản
//   GET  /api/don/:ma        trang thanh toán hỏi xem đơn đã nhận tiền chưa
//   POST /api/sepay          SePay báo có tiền vào
//   GET  /hoc/*              phòng học: chỉ mở khi có chìa khoá hợp lệ
//   GET  /quan-ly/           trang quản lý đơn cho May (cần mật khẩu riêng)
import banHang from "../src/_data/banHang.json";

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
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM || FROM, to: [to], subject, html, reply_to: replyTo || env.EMAIL_MAY || undefined }),
  });
  if (!r.ok) console.log("Resend lỗi", r.status, await r.text());
  return r.ok;
}

function khungEmail(noiDung) {
  return `<!doctype html><html><body style="margin:0;background:#F4EBE0;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#362A24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFDF8;border-radius:10px;padding:30px 28px">
<tr><td style="font-size:16px;line-height:1.7">${noiDung}
<p style="margin:28px 0 0">Ôm ôm,<br><strong style="color:#6E2A34">May</strong></p>
</td></tr></table>
<p style="font-size:12px;color:#7A6C64;margin:16px 0 0">mayphung.com · Bạn trả lời thẳng email này là May đọc được.</p>
</td></tr></table></body></html>`;
}
const nut = (href, chu) =>
  `<p style="margin:26px 0"><a href="${esc(href)}" style="background:#6E2A34;color:#FBF6EE;text-decoration:none;padding:13px 26px;border-radius:999px;font-weight:bold;display:inline-block">${esc(chu)}</a></p>`;

// ---------- Kit (danh sách email) ----------
async function guiKit(env, email, loai) {
  const formId = (loai === "qua" && env.KIT_FORM_QUA) || env.KIT_FORM_CHUNG;
  if (!formId) return;
  let ghi = { luc: Date.now(), email };
  try {
    const r = await fetch(`https://app.kit.com/forms/${formId}/subscriptions`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", "user-agent": "Mozilla/5.0 (mayphung.com)" },
      body: new URLSearchParams({ email_address: email }),
      redirect: "manual",
    });
    ghi.status = r.status;
    ghi.body = (await r.text()).slice(0, 300);
  } catch (e) {
    ghi.loi = e.message;
  }
  console.log("Kit", JSON.stringify(ghi));
  await env.DB.put("kit:cuoi", JSON.stringify(ghi));
}

// ---------- xử lý ----------
async function dangKy(request, env, ctx) {
  const body = await docBody(request);
  const email = String(body.email || body["fields[email]"] || "").trim().toLowerCase();
  const loai = ["chung", "qua"].includes(body.loai) ? body.loai : "chung";
  if (!emailHopLe(email)) return json({ ok: false, loi: "Email chưa đúng, bạn xem lại giúp May nhé." }, 400);
  const k = `dk:${email}`;
  const cu = (await env.DB.get(k, "json")) || { email, luc: Date.now(), loai: [] };
  if (!cu.loai.includes(loai)) cu.loai.push(loai);
  await env.DB.put(k, JSON.stringify(cu));
  ctx.waitUntil(guiKit(env, email, loai));
  const coQua = loai === "qua" && !!banHang.quaTang.link && !!env.RESEND_API_KEY;
  if (coQua) {
    ctx.waitUntil(
      guiEmail(env, {
        to: email,
        subject: `Cuốn nhỏ của bạn: ${banHang.quaTang.ten}`,
        html: khungEmail(`<p>Chào bạn,</p><p>Cảm ơn bạn đã ghé nhà May. Đây là cuốn <em>${esc(banHang.quaTang.ten)}</em> như đã hứa.</p>${nut(banHang.quaTang.link, "Mở cuốn sách")}<p>Đọc chậm thôi, làm bài tập bên trong nếu bạn thích. Đọc xong có gì muốn kể, bạn trả lời email này nhé.</p>`),
      })
    );
  }
  return json({ ok: true, daGuiQua: coQua });
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
  const phong = banHang.phong[don.phong];
  return guiEmail(env, {
    to: don.email,
    subject: `Chìa khoá vào ${phong.ten} của bạn`,
    html: khungEmail(
      `<p>Chào bạn,</p><p>May đã nhận được ${tien(don.gia)} cho <strong>${esc(don.ten)}</strong> (mã đơn ${don.ma}). Cảm ơn bạn nhiều lắm.</p>${nut(link, "Vào " + phong.ten)}<p>Bạn giữ email này lại nhé: đường dẫn trên là chìa khoá riêng của bạn, dùng được mãi, trên máy nào cũng được.</p>`
    ),
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
      html: khungEmail(`<p>Có đơn mới vừa thanh toán xong.</p><p><strong>${esc(don.ten)}</strong> · ${tien(don.gia)}<br>Người mua: ${esc(don.email)}<br>Mã đơn: ${don.ma}<br>Xác nhận bởi: ${nguon}</p><p>Web đã tự gửi chìa khoá cho người mua.</p>`),
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
    return new Response(trangKhoa(p.ten, "Chìa khoá này đã ngừng dùng. Nếu bạn nghĩ có nhầm lẫn, trả lời email của May để May xem giúp nhé."), { status: 403, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex", "set-cookie": `${cookieName}=; Path=/hoc/${ten}/; Max-Age=0; Secure; HttpOnly; SameSite=Lax` } });
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
<body><main><h1>Phòng này cần chìa khoá</h1>${loiRieng ? `<p>${esc(loiRieng)}</p>` : `<p>Bạn mở <strong>${esc(ten)}</strong> bằng đường dẫn trong email May gửi sau khi thanh toán nhé. Mỗi người có một đường dẫn riêng.</p><p>Không tìm thấy email? Xem thử mục Quảng cáo, Spam, hoặc trả lời bất kỳ email nào của May để May gửi lại.</p>`}<p><a href="/">← Về nhà May</a></p></main></body></html>`;
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
    if (body.hanhDong === "dong-bo-kit") {
      const ds = await env.DB.list({ prefix: "dk:" });
      for (const x of ds.keys) await guiKit(env, x.name.slice(3), "chung");
      return new Response(null, { status: 303, headers: { location: "/quan-ly/?kit=" + ds.keys.length } });
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
        tt = (bi ? `⛔ đã thu hồi chìa khoá<br>` : `✅ đã nhận<br><small>${esc(d.nguon || "")}</small><br>`) +
          (bi
            ? nutForm(d.ma, "mo-lai", "Mở lại", `Mở lại chìa khoá cho ${esc(d.email)}?`)
            : nutForm(d.ma, "gui-lai", "Gửi lại chìa khoá", `Gửi lại email chìa khoá cho ${esc(d.email)}?`, "#A8522B") +
              nutForm(d.ma, "thu-hoi", "Thu hồi", `Thu hồi chìa khoá của ${esc(d.email)}? Người này sẽ không vào phòng được nữa.`, "#7A6C64"));
      } else {
        tt = `chờ tiền${d.ghiChu ? `<br><small>${esc(d.ghiChu)}</small>` : ""}<br>` +
          nutForm(d.ma, "xac-nhan", "Đã nhận tiền", `Đã thấy ${tien(d.gia)} với nội dung ${d.ma} trong tài khoản? Web sẽ gửi chìa khoá cho ${esc(d.email)}.`);
      }
      return `<tr><td>${new Date(d.luc).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td><td><b>${d.ma}</b></td><td>${esc(d.ten)}<br><small>${tien(d.gia)}</small></td><td>${esc(d.email)}</td><td>${tt}</td></tr>`;
    })
    .join("");
  const thieu = ["TOKEN_SECRET", "RESEND_API_KEY", "SEPAY_API_KEY"].filter((x) => !env[x]);
  const kit = await env.DB.get("kit:cuoi", "json");
  const dsEmail = (await Promise.all(dk.keys.slice(0, 50).map((x) => env.DB.get(x.name, "json")))).filter(Boolean).sort((a, b) => b.luc - a.luc);
  const than = `<h1>Đơn hàng</h1>
<p class="links"><a href="/hoc/emotion-course/">Xem phòng Emotion Course</a><a href="/hoc/soi-chieu/">Xem phòng Soi Chiếu</a></p>
${thieu.length ? `<p style="color:#A8522B">Máy chủ còn thiếu: ${thieu.join(", ")}</p>` : `<p>✅ Đủ khoá: thanh toán, gửi email, phòng học.</p>`}
<p>${dons.filter((d) => d.trangThai === "da-nhan").length} đơn đã thanh toán · ${dk.keys.length} email đăng ký
${url.searchParams.get("kit") ? ` · ✅ đã chuyển ${esc(url.searchParams.get("kit"))} email sang Kit` : ""}</p>
${dk.keys.length && env.KIT_FORM_CHUNG ? `<form method="post" style="margin:-6px 0 18px"><input type="hidden" name="hanhDong" value="dong-bo-kit"><button style="background:#A8522B">Chuyển các email đã có sang Kit</button></form>` : ""}
${kit ? `<p><small>Lần gửi sang Kit gần nhất: ${new Date(kit.luc).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · ${esc(kit.email)} · kết quả: <b>${esc(kit.status ?? kit.loi)}</b> ${esc((kit.body || "").slice(0, 160))}</small></p>` : ""}
<table><tr><th>Lúc</th><th>Mã</th><th>Món</th><th>Email</th><th>Trạng thái</th></tr>${rows || '<tr><td colspan="5">Chưa có đơn nào.</td></tr>'}</table>
<h2 style="color:#6E2A34;font-family:Georgia,serif;font-weight:500;margin-top:34px">Email đăng ký</h2>
<table><tr><th>Lúc</th><th>Email</th><th>Ô nào</th></tr>${dsEmail.map((e) => `<tr><td>${new Date(e.luc).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td><td>${esc(e.email)}</td><td>${e.loai.map((l) => (l === "qua" ? "cuốn quà tặng" : "nhận bài mới")).join(", ")}</td></tr>`).join("") || '<tr><td colspan="3">Chưa có ai.</td></tr>'}</table>
<form method="post" style="margin-top:28px"><input type="hidden" name="hanhDong" value="dang-xuat"><button style="background:#7A6C64">Đăng xuất</button></form>`;
  return html(khungTrang("Quản lý đơn", than), 200, k ? { "set-cookie": await datPhien() } : {});
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
      if (p === "/quan-ly/" || p === "/quan-ly") return await quanLy(request, env, url);
      if (p.startsWith("/api/")) return json({ ok: false }, 404);
    } catch (e) {
      console.log("Lỗi", p, e.stack || e.message);
      return json({ ok: false, loi: "Có trục trặc nhỏ. Bạn thử lại giúp May nhé." }, 500);
    }
    return env.ASSETS.fetch(request);
  },
};
