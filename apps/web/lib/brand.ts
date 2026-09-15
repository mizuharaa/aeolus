// Runs before theme initialization and hydration, so every existing storage caller agrees.
export const brandStorageScript = `
(function () {
  ["localStorage", "sessionStorage"].forEach(function (name) {
    try {
      var storage = window[name];
      if (storage.getItem("olus-storage-migrated") === "1") return;
      var keys = [];
      for (var i = 0; i < storage.length; i++) keys.push(storage.key(i));
      keys.forEach(function (key) {
        if (!key || key.indexOf("aeolus-") !== 0) return;
        var next = "olus-" + key.slice(7);
        if (storage.getItem(next) === null) storage.setItem(next, storage.getItem(key));
      });
      storage.setItem("olus-storage-migrated", "1");
    } catch (_) { /* Storage can be blocked; the app remains usable. */ }
  });
})();
`

export const themeInitScript = `
(function(){
  document.documentElement.setAttribute("data-olus-intro", "pending");
  try {
    var c = localStorage.getItem("olus-console-theme") || "light";
    var r = c === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : c;
    document.documentElement.setAttribute("data-console-theme", r);
  } catch (e) {
    document.documentElement.setAttribute("data-console-theme", "light");
  }
})();
`
