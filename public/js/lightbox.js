let currentProductImages = [];
let currentImageIndex = 0;
let currentLightboxProduct = null;

function openLightbox(product) {
  currentLightboxProduct = product;
  currentProductImages = product.images;
  currentImageIndex = 0;
  updateLightboxImage();

  document.getElementById("lightbox-title").textContent = product.name;
  document.getElementById("lightbox-desc").textContent = product.description;
  document.getElementById("lightbox-price").textContent = product.price.toFixed(2) + "€";

  document.getElementById("lightbox").classList.remove("hidden");
}

function updateLightboxImage() {
  const img = document.getElementById("lightbox-img");
  img.src = `images/${currentTheme}/${currentProductImages[currentImageIndex]}`;
}

document.getElementById("lightbox-close").addEventListener("click", () => {
  document.getElementById("lightbox").classList.add("hidden");
});

document.getElementById("lightbox-prev").addEventListener("click", () => {
  currentImageIndex = (currentImageIndex - 1 + currentProductImages.length) % currentProductImages.length;
  updateLightboxImage();
});

document.getElementById("lightbox-next").addEventListener("click", () => {
  currentImageIndex = (currentImageIndex + 1) % currentProductImages.length;
  updateLightboxImage();
});

document.getElementById("lightbox-add-cart").addEventListener("click", () => {
  addToCart(currentLightboxProduct);
  document.getElementById("lightbox").classList.add("hidden");
});