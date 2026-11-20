/** @param {unknown} value The public EAS identity shared by updates and push. */
function normalizeProjectId(value) {
  if (typeof value !== "string") return null;
  const id = value.trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) &&
    !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(id) ? id : null;
}

module.exports = { normalizeProjectId };
