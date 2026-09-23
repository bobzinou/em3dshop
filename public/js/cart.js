// ========================
// 🛒 PANIER & PAIEMENT
// ========================

let cart = [];
let paypalButtonRendered = false;
let customer = {};
let total = 0;

function addToCart(productId, productName, productPrice) {
  const existing = cart.find(item => item.id === productId);
  
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      id: productId,
      name: productName,
      price: productPrice,
      qty: 1
    });
  }
  
  updateCartUI();
  console.log("✅ Produit ajouté :", productName);
}

function removeFromCart(productId) {
  cart = cart.filter(item => item.id !== productId);
  updateCartUI();
}

function updateQty(productId, newQty) {
  const item = cart.find(item => item.id === productId);
  if (item) {
    item.qty = Math.max(1, newQty);
    updateCartUI();
  }
}

function updateCartUI() {
  const cartCount = document.getElementById("cart-count");
  const cartItems = document.getElementById("cart-items");
  const cartEmpty = document.getElementById("cart-empty");
  const cartTotal = document.getElementById("cart-total");

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  cartCount.textContent = totalItems;

  if (cart.length === 0) {
    cartItems.innerHTML = "";
    cartEmpty.classList.remove("hidden");
    cartTotal.textContent = "0.00€";
    return;
  }

  cartEmpty.classList.add("hidden");

  cartItems.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <strong>${item.name}</strong>
        <p>${item.price.toFixed(2)}€</p>
      </div>
      <div class="cart-item-qty">
        <button onclick="updateQty(${item.id}, ${item.qty - 1})">-</button>
        <input type="number" value="${item.qty}" onchange="updateQty(${item.id}, this.value)">
        <button onclick="updateQty(${item.id}, ${item.qty + 1})">+</button>
      </div>
      <button class="cart-remove" onclick="removeFromCart(${item.id})">Supprimer</button>
    </div>
  `).join("");

  updateTotals();
}

function updateTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const pickup = document.getElementById("pickup-checkbox")?.checked || false;
  const shippingCost = pickup ? 0 : 3.99;
  
  total = subtotal + shippingCost;
  
  const cartTotal = document.getElementById("cart-total");
  const shippingDisplay = document.getElementById("shipping-display");
  const subtotalDisplay = document.getElementById("subtotal-display");
  
  if (subtotalDisplay) subtotalDisplay.textContent = subtotal.toFixed(2) + "€";
  if (shippingDisplay) shippingDisplay.textContent = shippingCost.toFixed(2) + "€";
  if (cartTotal) cartTotal.textContent = total.toFixed(2) + "€";
  
  console.log("💰 Total mis à jour :", { subtotal, shipping: shippingCost, total });
}

function openCart() {
  const modal = document.getElementById("cart-modal");
  if (modal) {
    modal.classList.remove("hidden");
    updateTotals();
  }
}

function closeCart() {
  const modal = document.getElementById("cart-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
  closePayPalModal();
}

function closePayPalModal() {
  const modal = document.getElementById("paypal-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
  paypalButtonRendered = false;
  const container = document.getElementById("paypal-button-container");
  if (container) {
    container.innerHTML = "";
  }
}

function handlePickupChange() {
  updateTotals();
}

async function handlePaymentClick() {
  const name = document.getElementById("customer-name")?.value.trim() || "";
  const email = document.getElementById("customer-email")?.value.trim() || "";
  const pickup = document.getElementById("pickup-checkbox")?.checked || false;
  const address = document.getElementById("customer-address")?.value.trim() || "";
  const cguChecked = document.getElementById("cgu-checkbox")?.checked || false;

  console.log("Validation:", { name, email, pickup, address, cguChecked, cartLength: cart.length });

  // ✅ Validations
  if (!name || !email) {
    alert("❌ Merci de renseigner votre nom et votre email.");
    return;
  }

  if (!cguChecked) {
    alert("❌ Merci d'accepter les CGV et la Politique de Confidentialité.");
    return;
  }

  if (!pickup && !address) {
    alert("❌ Merci de renseigner une adresse de livraison, ou cochez le retrait en main propre.");
    return;
  }

  if (cart.length === 0) {
    alert("❌ Votre panier est vide.");
    return;
  }

  // ✅ Sauvegarde les données du client
  customer = {
    name,
    email,
    address,
    pickup
  };

  console.log("✅ Validation OK ! Affichage du modal PayPal...");

  // Affiche le modal PayPal
  const paypalModal = document.getElementById("paypal-modal");
  if (paypalModal) {
    paypalModal.classList.remove("hidden");
  }

  // Rend le bouton PayPal si pas déjà rendu
  if (!paypalButtonRendered && typeof paypal !== "undefined") {
    renderPayPalButton();
  }
}

function renderPayPalButton() {
  if (paypalButtonRendered || typeof paypal === "undefined") {
    console.log("⚠️ PayPal non disponible ou déjà rendu");
    return;
  }

  paypalButtonRendered = true;

  paypal.Buttons({
    createOrder: async (data, actions) => {
      try {
        console.log("📦 Création de la commande PayPal...");
        
        const res = await fetch("/api/paypal/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cart,
            total: total.toFixed(2),
            customer: customer
          })
        });

        const orderData = await res.json();

        if (!orderData.orderId) {
          throw new Error("OrderID manquant");
        }

        console.log("✅ Commande créée :", orderData.orderId);
        return orderData.orderId;
      } catch (err) {
        console.error("❌ Erreur création commande :", err);
        alert("❌ Erreur lors de la création de la commande. Réessayez.");
        throw err;
      }
    },

    onApprove: async (data, actions) => {
      try {
        console.log("✅ Paiement approuvé, capture en cours...");
        
        const res = await fetch("/api/paypal/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderID })
        });

        const orderData = await res.json();

        if (orderData.success) {
          console.log("✅ Paiement capturé !");
          
          // Enregistre la commande
          const orderRes = await fetch("/api/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId: data.orderID,
              customer: customer,
              items: cart,
              total: total.toFixed(2),
              pickup: customer.pickup,
              transactionId: orderData.transactionId
            })
          });

          const orderResult = await orderRes.json();
          
          if (orderResult.success) {
            alert("✅ Paiement validé ! Facture envoyée par email.");
            cart = [];
            updateCartUI();
            
            // ⭐ FERME LE MODAL IMMÉDIATEMENT
            closePayPalModal();
            closeCart();
          } else {
            alert("❌ Erreur : " + (orderResult.error || "Impossible d'enregistrer la commande"));
            closePayPalModal();
          }
        } else {
          alert("❌ Erreur : " + (orderData.error || "Paiement non complété"));
          closePayPalModal();
        }
      } catch (err) {
        console.error("❌ Erreur onApprove :", err);
        alert("❌ Erreur de paiement. Réessayez.");
        closePayPalModal();
      }
    },

    onError: (err) => {
      console.error("❌ Erreur PayPal :", err);
      alert("❌ Une erreur est survenue avec PayPal. Réessayez.");
      closePayPalModal();
    },

    onCancel: () => {
      console.log("⚠️ Paiement annulé par l'utilisateur");
      alert("⚠️ Paiement annulé.");
      closePayPalModal();
    }
  }).render("#paypal-button-container");
}

// ========================
// 📱 EVENT LISTENERS
// ========================

document.addEventListener("DOMContentLoaded", () => {
  // Bouton panier
  const cartBtn = document.getElementById("cart-btn");
  if (cartBtn) {
    cartBtn.addEventListener("click", openCart);
  }

  // Fermeture du modal panier
  const closeCartBtn = document.getElementById("close-cart");
  if (closeCartBtn) {
    closeCartBtn.addEventListener("click", closeCart);
  }

  // Fermeture du modal PayPal
  const closePayPalBtn = document.getElementById("paypal-modal-close");
  if (closePayPalBtn) {
    closePayPalBtn.addEventListener("click", closePayPalModal);
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

  // Fermeture du panier au clic en dehors
  const overlay = document.getElementById("overlay");
  if (overlay) {
    overlay.addEventListener("click", closeCart);
  }

  // Mise à jour des totaux au chargement
  updateTotals();
});