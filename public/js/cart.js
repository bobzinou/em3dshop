let cart = [];
let paypalSdkReady = false;

document.addEventListener("paypal-sdk-ready", () => {
  paypalSdkReady = true;
});

function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...product, qty: 1 });
  }
  updateCartUI();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  updateCartUI();
}

function updateCartUI() {
  const countEl = document.getElementById("cart-count");
  countEl.textContent = cart.reduce((sum, i) => sum + i.qty, 0);

  const itemsEl = document.getElementById("cart-items");
  itemsEl.innerHTML = "";

  cart.forEach(item => {
    const div = document.createElement("div");
    div.className = "cart-item";
    div.innerHTML = `
      <img src="images/${currentTheme}/${item.images[0]}" alt="${item.name}">
      <div>${item.name} x${item.qty}</div>
      <div>${(item.price * item.qty).toFixed(2)}€</div>
      <span class="cart-item-remove" data-id="${item.id}">✕</span>
    `;
    itemsEl.appendChild(div);
  });

  itemsEl.querySelectorAll(".cart-item-remove").forEach(btn => {
    btn.addEventListener("click", (e) => removeFromCart(e.target.dataset.id));
  });

  updateTotals();
}

function updateTotals() {
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const pickup = document.getElementById("pickup-checkbox").checked;
  const shippingCost = pickup ? 0 : appConfig.shipping.price;

  document.getElementById("cart-subtotal").textContent = subtotal.toFixed(2) + "€";
  document.getElementById("cart-shipping").textContent = shippingCost.toFixed(2) + "€";
  document.getElementById("cart-total").textContent = (subtotal + shippingCost).toFixed(2) + "€";

  // Si le panier change, on remet le bouton "Passer au paiement" et on cache PayPal
  document.getElementById("proceed-to-payment").classList.remove("hidden");
  document.getElementById("paypal-button-container").classList.add("hidden");
  document.getElementById("paypal-button-container").innerHTML = "";
}

document.getElementById("pickup-checkbox").addEventListener("change", () => {
  const addressField = document.getElementById("customer-address");
  addressField.disabled = document.getElementById("pickup-checkbox").checked;
  updateTotals();
});

document.getElementById("cart-icon").addEventListener("click", () => {
  document.getElementById("cart-panel").classList.remove("hidden");
  document.getElementById("overlay").classList.remove("hidden");
});

document.getElementById("cart-close").addEventListener("click", closeCart);
document.getElementById("overlay").addEventListener("click", closeCart);

function closeCart() {
  document.getElementById("cart-panel").classList.add("hidden");
  document.getElementById("overlay").classList.add("hidden");
}

function renderPayPalButton(total) {
  const container = document.getElementById("paypal-button-container");
  container.innerHTML = "";

  if (cart.length === 0 || !window.paypal || !paypalSdkReady) return;

  paypal.Buttons({
    // Crée la commande côté SERVEUR
    createOrder: async (data, actions) => {
      try {
        const res = await fetch("/api/paypal/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cart,
            total: total,
            pickup: document.getElementById("pickup-checkbox").checked
          })
        });
        const orderData = await res.json();
        return orderData.orderId;
      } catch (err) {
        console.error("Erreur création commande :", err);
        actions.reject();
      }
    },

    // Capture la commande après approbation du client
    onApprove: async (data, actions) => {
      try {
        const name = document.getElementById("customer-name").value;
        const email = document.getElementById("customer-email").value;
        const address = document.getElementById("customer-address").value;
        const pickup = document.getElementById("pickup-checkbox").checked;

        // Capture côté SERVEUR
        const captureRes = await fetch("/api/paypal/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: data.orderID,
            customer: { name, email, address, pickup },
            items: cart,
            total: total.toFixed(2)
          })
        });

        const captureData = await captureRes.json();

        if (captureData.success) {
          alert("✅ Merci " + name + " ! Votre commande a bien été validée.\nNuméro de transaction : " + captureData.transactionId);
          cart = [];
          updateCartUI();
          closeCart();
        } else {
          alert("❌ Erreur lors de la capture du paiement : " + captureData.error);
        }
      } catch (err) {
        console.error("Erreur validation :", err);
        alert("Une erreur est survenue. Contacter le support.");
      }
    },

    onError: function(err) {
      alert("❌ Une erreur est survenue avec le paiement. Réessayez.");
      console.error(err);
    }
  }).render("#paypal-button-container");
}

document.getElementById("proceed-to-payment").addEventListener("click", () => {
  const name = document.getElementById("customer-name").value.trim();
  const email = document.getElementById("customer-email").value.trim();
  const cgvAccepted = document.getElementById("cgv-checkbox").checked;

  if (!cgvAccepted) {
    alert("Merci d'accepter les CGV et mentions légales avant de continuer.");
    return;
  }

  if (!name || !email) {
    alert("Merci de renseigner votre nom et votre email avant de continuer.");
    return;
  }

  // ... reste du code existant

  if (!pickup && !address) {
    alert("Merci de renseigner une adresse de livraison, ou cochez le retrait en main propre.");
    return;
  }

  if (cart.length === 0) {
    alert("Votre panier est vide.");
    return;
  }

  if (!paypalSdkReady) {
    alert("Le module de paiement PayPal est en cours de chargement, réessayez dans quelques secondes.");
    return;
  }

  document.getElementById("proceed-to-payment").classList.add("hidden");
  document.getElementById("paypal-button-container").classList.remove("hidden");

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shippingCost = pickup ? 0 : appConfig.shipping.price;
  renderPayPalButton(subtotal + shippingCost);
});