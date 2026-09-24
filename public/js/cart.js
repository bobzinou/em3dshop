// ========================
// PANIER & PAIEMENT
// ========================

let cart = [];
let paypalButtonRendered = false;

// AJOUTER AU PANIER
function addToCart(product) {
  const existing = cart.find(item => item.id === product.id);
  
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ 
      ...product, 
      qty: 1 
    });
  }
  
  updateCartUI();
  console.log("Produit ajouté :", product.name);
}

// RETIRER DU PANIER
function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  updateCartUI();
  console.log("Produit supprimé");
}

// MODIFIER QUANTITÉ
function updateQty(id, newQty) {
  const item = cart.find(item => item.id === id);
  if (item) {
    item.qty = Math.max(1, parseInt(newQty));
    updateCartUI();
  }
}

// AFFICHER LE PANIER
function updateCartUI() {
  const cartCount = document.getElementById("cart-count");
  const cartItems = document.getElementById("cart-items");
  
  // Compter les items
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  cartCount.textContent = totalItems;

  // Afficher les items
  if (cart.length === 0) {
    cartItems.innerHTML = "<p style='text-align: center; padding: 20px; opacity: 0.6;'>Votre panier est vide</p>";
  } else {
    cartItems.innerHTML = cart.map(item => `
      <div class="cart-item" data-id="${item.id}">
        <div class="cart-item-details">
          <strong>${item.name}</strong>
          <p class="cart-item-price">${item.price.toFixed(2)}€</p>
        </div>
        <div class="cart-item-qty">
          <button class="qty-btn qty-minus" data-id="${item.id}">-</button>
          <span class="qty-display">${item.qty}</span>
          <button class="qty-btn qty-plus" data-id="${item.id}">+</button>
        </div>
        <button class="cart-remove" data-id="${item.id}">X</button>
      </div>
    `).join("");

    // EVENT LISTENERS pour les boutons MOINS
    document.querySelectorAll(".qty-minus").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.target.dataset.id;
        const item = cart.find(i => i.id === id);
        if (item && item.qty > 1) {
          updateQty(id, item.qty - 1);
        }
      });
    });

    // EVENT LISTENERS pour les boutons PLUS
    document.querySelectorAll(".qty-plus").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.target.dataset.id;
        const item = cart.find(i => i.id === id);
        if (item) {
          updateQty(id, item.qty + 1);
        }
      });
    });

    // EVENT LISTENERS pour les boutons SUPPRIMER
    document.querySelectorAll(".cart-remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        removeFromCart(e.target.dataset.id);
      });
    });
  }

  updateTotals();
}

// CALCULER TOTAUX
function updateTotals() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const pickup = document.getElementById("pickup-checkbox").checked;
  const shippingCost = pickup ? 0 : 3.99;
  const total = subtotal + shippingCost;

  document.getElementById("cart-subtotal").textContent = subtotal.toFixed(2) + "€";
  document.getElementById("cart-shipping").textContent = shippingCost.toFixed(2) + "€";
  document.getElementById("cart-total").textContent = total.toFixed(2) + "€";
}

// OUVRIR PANIER
function openCart() {
  document.getElementById("cart-panel").classList.remove("hidden");
  document.getElementById("overlay").classList.remove("hidden");
  updateCartUI();
}

// FERMER PANIER
function closeCart() {
  document.getElementById("cart-panel").classList.add("hidden");
  document.getElementById("overlay").classList.add("hidden");
}

// FERMER MODAL PAYPAL
function closePayPalModal() {
  document.getElementById("paypal-modal").classList.add("hidden");
  document.getElementById("paypal-button-container").innerHTML = "";
  document.getElementById("proceed-to-payment").classList.remove("hidden");
  paypalButtonRendered = false;
}

// GESTION RETRAIT EN MAIN PROPRE
function handlePickupChange() {
  const pickup = document.getElementById("pickup-checkbox").checked;
  const addressInput = document.getElementById("customer-address");
  
  if (pickup) {
    addressInput.disabled = true;
    addressInput.value = "";
  } else {
    addressInput.disabled = false;
  }
  
  updateTotals();
}

// PASSER AU PAIEMENT
function handlePaymentClick() {
  const name = document.getElementById("customer-name").value.trim();
  const email = document.getElementById("customer-email").value.trim();
  const pickup = document.getElementById("pickup-checkbox").checked;
  const address = document.getElementById("customer-address").value.trim();
  const cguChecked = document.getElementById("cgu-checkbox").checked;

  console.log("Validation:", { name, email, pickup, address, cguChecked, cartLength: cart.length });

  // VALIDATIONS
  if (!name || !email) {
    alert("Merci de renseigner votre nom et votre email.");
    return;
  }

  if (!cguChecked) {
    alert("Merci d'accepter les CGV et la Politique de Confidentialité.");
    return;
  }

  if (!pickup && !address) {
    alert("Merci de renseigner une adresse de livraison, ou cochez le retrait en main propre.");
    return;
  }

  if (cart.length === 0) {
    alert("Votre panier est vide.");
    return;
  }

  console.log("Validation OK ! Affichage de PayPal...");

  // Cache le bouton, affiche la modal PayPal
  document.getElementById("proceed-to-payment").classList.add("hidden");
  document.getElementById("paypal-modal").classList.remove("hidden");

  // Render PayPal
  if (!paypalButtonRendered) {
    renderPayPalButton();
    paypalButtonRendered = true;
  }
}

// RENDER PAYPAL
function renderPayPalButton() {
  if (!window.paypal) {
    console.error("PayPal SDK pas chargé");
    alert("Le module PayPal se charge... réessaie dans 2-3 secondes");
    return;
  }

  const name = document.getElementById("customer-name").value.trim();
  const email = document.getElementById("customer-email").value.trim();
  const pickup = document.getElementById("pickup-checkbox").checked;
  const address = document.getElementById("customer-address").value.trim();

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const shippingCost = pickup ? 0 : 3.99;
  const total = subtotal + shippingCost;

  document.getElementById("paypal-button-container").innerHTML = "";

  paypal.Buttons({
    createOrder: function(data, actions) {
      return fetch("/api/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart,
          total: total.toFixed(2),
          customer: {
            name: name,
            email: email,
            address: address,
            pickup: pickup
          }
        })
      })
      .then(res => res.json())
      .then(order => {
        if (!order.orderId) {
          console.error("Pas d'orderId reçu :", order);
          throw new Error("Erreur création commande PayPal");
        }
        return order.orderId;
      });
    },

    onApprove: function(data, actions) {
      console.log("✅ Paiement approuvé par l'utilisateur");

      return fetch("/api/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: data.orderID })
      })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(result => {
        console.log("Capture result:", result);
        if (!result.success) {
          throw new Error("Capture échouée : " + result.error);
        }

        return fetch("/api/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: data.orderID,
            items: cart,
            customer: {
              name: document.getElementById("customer-name").value.trim(),
              email: document.getElementById("customer-email").value.trim(),
              address: document.getElementById("customer-address").value.trim(),
              pickup: document.getElementById("pickup-checkbox").checked
            },
            transactionId: result.transactionId,
            total: cart.reduce((sum, item) => sum + (item.price * item.qty), 0) + 
                   (document.getElementById("pickup-checkbox").checked ? 0 : 3.99)
          })
        });
      })
      .then(orderRes => {
        if (!orderRes.ok) throw new Error(`HTTP ${orderRes.status}`);
        return orderRes.json();
      })
      .then(orderData => {
  console.log("Order saved:", orderData);
  
  if (orderData.success) {
    // REDIRIGE vers la page de succès
    window.location.href = "/success.html?orderId=" + orderData.orderId;
    return;
  } else {
    throw new Error(orderData.error || "Erreur enregistrement commande");
  }
})
      .catch(err => {
        console.error("Erreur paiement :", err);
        alert("Erreur : " + err.message);
        
        // Force fermeture même en cas d'erreur
        document.getElementById("paypal-modal").classList.add("hidden");
        document.getElementById("paypal-button-container").innerHTML = "";
        document.getElementById("proceed-to-payment").classList.remove("hidden");
        paypalButtonRendered = false;
      });
    },

    onError: function(err) {
      console.error("PayPal Error:", err);
      alert("Erreur de paiement. Réessaie.");
      closePayPalModal();
    }
  }).render("#paypal-button-container");
}

// ========================
// EVENT LISTENERS
// ========================

document.addEventListener("DOMContentLoaded", () => {
  console.log("Initialisation du panier...");

  // Bouton panier
  const cartIcon = document.getElementById("cart-icon");
  if (cartIcon) {
    cartIcon.addEventListener("click", openCart);
  }

  // Fermer panier
  const cartClose = document.getElementById("cart-close");
  if (cartClose) {
    cartClose.addEventListener("click", closeCart);
  }

  // Fermer modal PayPal
  const paypalClose = document.getElementById("paypal-modal-close");
  if (paypalClose) {
    paypalClose.addEventListener("click", closePayPalModal);
  }

  // Bouton "Passer au paiement"
  const proceedBtn = document.getElementById("proceed-to-payment");
  if (proceedBtn) {
    proceedBtn.addEventListener("click", handlePaymentClick);
  }

  // Checkbox retrait en main propre
  const pickupCheckbox = document.getElementById("pickup-checkbox");
  if (pickupCheckbox) {
    pickupCheckbox.addEventListener("change", handlePickupChange);
  }

  // Fermeture panier au clic overlay
  const overlay = document.getElementById("overlay");
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeCart();
      }
    });
  }
});