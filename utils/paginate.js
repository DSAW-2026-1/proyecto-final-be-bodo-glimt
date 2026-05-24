function paginate(query, defaults = { page: 1, limit: 20 }) {
  const page = Math.max(parseInt(query.page, 10) || defaults.page, 1);
  const limit = Math.max(parseInt(query.limit, 10) || defaults.limit, 1);
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = { paginate };
