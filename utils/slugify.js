export function slugify(text, suffix = "") {
  const base = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  return suffix ? `${base}-${suffix}` : base;
}

export default slugify;
