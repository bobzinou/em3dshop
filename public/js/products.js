async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const products = await res.json();
    displayProducts(products);
  } catch (err) {
    console.error("Erreur chargement:", err);
  }
}

function displayProducts(products) {
  const container = document.getElementById('products-container');
  container.innerHTML = products.map(p => `
    <div class="product-card">
      <h3>${p.name}</h3>
      <p>${p.description}</p>
      <p class="price">${p.price}€</p>
      <button onclick="addToCart({id: '${p.id}', name: '${p.name}', price: ${p.price}})">
        Ajouter au panier
      </button>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', loadProducts);