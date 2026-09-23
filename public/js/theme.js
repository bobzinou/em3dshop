// theme.js - Gestion des thèmes visuels du site

const THEMES = {
  halloween: {
    name: "Halloween",
    class: "theme-halloween",
    primary: "#ff7518",
    bg: "#0d0d0d"
  },
  noel: {
    name: "Noël",
    class: "theme-noel",
    primary: "#c0392b",
    bg: "#ffffff"
  },
  figurines: {
    name: "Figurines",
    class: "theme-figurines",
    primary: "#3498db",
    bg: "#1a1a1a"
  },
  hueforge: {
    name: "Hueforge",
    class: "theme-hueforge",
    primary: "#9b59b6",
    bg: "#1a1a1a"
  }
};

let currentTheme = "halloween";

function applyTheme(themeKey) {
  const theme = THEMES[themeKey];
  if (!theme) return;

  // Retire toutes les classes de thème précédentes
  Object.values(THEMES).forEach(t => {
    document.body.classList.remove(t.class);
  });

  // Applique la nouvelle classe de thème
  document.body.classList.add(theme.class);
  currentTheme = themeKey;

  // Met à jour les boutons actifs dans la nav
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === themeKey);
  });
}

function renderThemeNav() {
  const nav = document.getElementById('theme-nav');
  if (!nav) return;

  nav.innerHTML = Object.keys(THEMES).map(key => {
    const t = THEMES[key];
    return `<button class="theme-btn" data-theme="${key}">${t.name}</button>`;
  }).join('');

  nav.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.theme;
      applyTheme(theme);
      if (typeof loadProductsForTheme === 'function') {
        loadProductsForTheme(theme);
      }
    });
  });
}