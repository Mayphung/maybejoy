import markdownIt from "markdown-it";

const md = markdownIt({ html: true, breaks: true });

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/_redirects": "_redirects" });

  // Xuống dòng trong bài viết giữ nguyên như khi gõ
  eleventyConfig.amendLibrary("md", (lib) => lib.set({ breaks: true, typographer: false }));

  // Chữ có *nghiêng*, **đậm** trong các ô chữ ngắn
  eleventyConfig.addFilter("mdInline", (s) => md.renderInline(s || ""));
  eleventyConfig.addFilter("md", (s) => md.render(s || ""));

  // Ngày kiểu Việt
  eleventyConfig.addFilter("dateVi", (d) => {
    const dt = new Date(d);
    return `${dt.getDate()} tháng ${dt.getMonth() + 1}, ${dt.getFullYear()}`;
  });
  eleventyConfig.addFilter("dateDots", (d) => {
    const dt = new Date(d);
    const p = (n) => String(n).padStart(2, "0");
    return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}`;
  });
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));

  // Số phút đọc (khoảng 200 chữ mỗi phút)
  eleventyConfig.addFilter("readMin", (content) => {
    const words = String(content || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  });

  // Bài viết dài (bỏ bài nháp), mới nhất lên đầu
  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByGlob("src/bai-viet/*.md").filter((p) => !p.data.draft).sort((a, b) => b.date - a.date)
  );
  // Trang nhật ký ngắn: ghi chú, ảnh, câu tâm đắc
  eleventyConfig.addCollection("nhatKy", (api) =>
    api.getFilteredByGlob("src/nhat-ky/*.md").filter((p) => !p.data.draft).sort((a, b) => b.date - a.date)
  );

  // Trang mới nhất cho trang chủ: bài dài + trang nhật ký ngắn, mới nhất lên đầu
  eleventyConfig.addCollection("moiNhat", (api) =>
    [...api.getFilteredByGlob("src/bai-viet/*.md"), ...api.getFilteredByGlob("src/nhat-ky/*.md")]
      .filter((p) => !p.data.draft)
      .sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addFilter("byCategory", (posts, cat) => (posts || []).filter((p) => p.data.category === cat));
  eleventyConfig.addFilter("byTag", (posts, tag) => (posts || []).filter((p) => (p.data.the || []).includes(tag)));
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("without", (arr, url) => (arr || []).filter((p) => p.url !== url));
  eleventyConfig.addFilter("byDate", (arr) => [...(arr || [])].sort((a, b) => b.date - a.date));
  eleventyConfig.addFilter("concat", (a, b) => [...(a || []), ...(b || [])]);
  // Đan bài dài vào giữa tường nhật ký: bài đầu tiên đứng đầu, rồi cứ "every" trang ngắn lại chen một bài
  eleventyConfig.addFilter("weave", (notes, posts, every = 6) => {
    const out = [];
    const ps = [...(posts || [])];
    (notes || []).forEach((n, i) => {
      if (i % every === 2 && ps.length) out.push(ps.shift());
      out.push(n);
    });
    return out.concat(ps);
  });
  eleventyConfig.addFilter("findBy", (arr, key, val) => (arr || []).find((x) => String(x[key]) === String(val)));
  eleventyConfig.addFilter("featured", (posts) => (posts || []).find((p) => p.data.noiBat) || (posts || [])[0]);
  eleventyConfig.addFilter("vnd", (n) => Number(n || 0).toLocaleString("vi-VN") + "đ");
  eleventyConfig.addFilter("digits", (s) => String(s || "").replace(/\D/g, ""));
  eleventyConfig.addFilter("navItem", (nav, key) => (nav || []).find((c) => c.key === key));

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
