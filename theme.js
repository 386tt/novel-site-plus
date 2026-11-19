// 全站统一的主题处理
// 各页面只需要在 <head> 里引入本文件,并在导航栏放一个 .theme-toggle 按钮即可。
(function () {
  var THEMES = ['light', 'dark', 'green', 'sepia', 'blue'];
  var ICONS = { light: '☀️', dark: '🌙', green: '🍃', sepia: '📜', blue: '💧' };
  var KEY = 'theme';

  function readTheme() {
    try {
      var saved = localStorage.getItem(KEY);
      if (saved && THEMES.indexOf(saved) !== -1) return saved;
    } catch (e) {}
    return 'light';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = document.querySelector('.theme-toggle');
    if (btn) {
      btn.textContent = ICONS[theme] || '🌙';
      btn.setAttribute('title', '切换主题（当前：' + theme + '）');
    }
  }

  function set(theme) {
    if (THEMES.indexOf(theme) === -1) theme = 'light';
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) {}
    apply(theme);
    // 通知同页面的其它逻辑（如阅读器设置面板）
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
  }

  function next() {
    var current = document.documentElement.getAttribute('data-theme') || readTheme();
    var idx = THEMES.indexOf(current);
    set(THEMES[(idx + 1) % THEMES.length]);
  }

  window.ThemeManager = {
    themes: THEMES,
    icons: ICONS,
    get: function () { return document.documentElement.getAttribute('data-theme') || readTheme(); },
    set: set,
    toggle: next,
    apply: apply
  };
  window.toggleTheme = next;

  // 尽早应用,避免首屏闪烁
  apply(readTheme());

  document.addEventListener('DOMContentLoaded', function () {
    apply(document.documentElement.getAttribute('data-theme') || readTheme());
    var btn = document.querySelector('.theme-toggle');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        next();
      });
    }
  });
})();
