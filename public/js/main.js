let allProducts = {};
let currentCategory = "Toutes";

const CATEGORIES = ["Toutes", "Décorations", "Figurines", "Divers"];

async function loadProducts() {
  const res = await fetch("/api/products");
  allProducts = await res.json();
}

function renderCategoryBar() {
  const bar = document.getElementById("category-bar");
  if (!bar) return;

  bar.innerHTML = CATEGORIES.map(cat =>
    `<button class="category-btn ${cat === currentCategory ? 'active' : ''}" data-category="${cat}">${cat}</button>`
  ).join("");

  bar.querySelectorAll(".category-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentCategory = btn.dataset.category;
      bar.querySelectorAll(".category-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadProductsForTheme();
    });
  });
}

function loadProductsForTheme() {
  const grid = document.getElementById("products-grid");
  grid.innerHTML = "";

  const products = allProducts[currentTheme] || [];
  const filtered = currentCategory === "Toutes"
    ? products
    : products.filter(p => p.category === currentCategory);

  if (filtered.length === 0) {
    grid.innerHTML = `<p style="grid-column: 1/-1; text-align:center; opacity:0.6; padding:40px;">
      Aucun produit pour le moment dans cette catégorie. Reviens bientôt ! 🎨
    </p>`;
    return;
  }

  filtered.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="images/${currentTheme}/${product.images[0]}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <div class="product-price">${product.price.toFixed(2)}€</div>
      </div>
    `;
    card.addEventListener("click", () => openLightbox(product));
    grid.appendChild(card);
  });
}

async function init() {
  renderThemeNav();
  applyTheme(currentTheme);
  renderCategoryBar();
  await loadProducts();
  loadProductsForTheme();
}

init();