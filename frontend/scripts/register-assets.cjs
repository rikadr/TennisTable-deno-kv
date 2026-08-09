for (const ext of [".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".css", ".ico"]) {
  require.extensions[ext] = (module) => {
    module.exports = "";
  };
}
