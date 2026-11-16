export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // Xuống dòng trong bài viết giữ nguyên như khi gõ
  eleventyConfig.amendLibrary("md", (md) => md.set({ breaks: true, typographer: false }));

  // Ngày kiểu Việt: "16 tháng 11, 2026"
  eleventyConfig.addFilter("dateVi", (d) => {
    const dt = new Date(d);
    return `${dt.getDate()} tháng ${dt.getMonth() + 1}, ${dt.getFullYear()}`;
  });
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));

  // Tất cả bài viết (bỏ bài nháp), mới nhất lên đầu
  eleventyConfig.addCollection("posts", (api) =>
    api
      .getFilteredByGlob("src/bai-viet/*.md")
      .filter((p) => !p.data.draft)
      .sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addFilter("byCategory", (posts, cat) =>
    (posts || []).filter((p) => p.data.category === cat)
  );
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("without", (arr, url) => (arr || []).filter((p) => p.url !== url));

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
}
