let cart = [];
let paypalButtonRendered = false;

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
      <div>
        <strong>${item.name}</strong><br>
        x${item.qty} = ${(item.price * item.qty).toFixed(2)}€
      </div>
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
  const shippingCost = pickup ? 0 : 3.99;

  document.getElementById("cart-subtotal").textContent = subtotal.toFixed(2) + "€";
  document.getElementById("cart-shipping").textContent = shippingCost.toFixed(2) + "€";
  document.getElementById("cart-total").textContent = (subtotal + shippingCost).toFixed(2) + "€";

  document.getElementById("proceed-to-payment").classList.remove("hidden");
  closePayPalModal();
}

document.addEventListener("DOMContentLoaded", () => {
  const pickupCheckbox = document.getElementById("pickup-checkbox");
  const addressField = document.getElementById("customer-address");

  pickupCheckbox.addEventListener("change", () => {
    if (pickupCheckbox.checked) {
      addressField.value = "";
      addressField.disabled = true;
    } else {
      addressField.disabled = false;
    }
    updateTotals();
  });

  document.getElementById("cart-icon").addEventListener("click", () => {
    document.getElementById("cart-panel").classList.remove("hidden");
    document.getElementById("overlay").classList.remove("hidden");
  });

  document.getElementById("cart-close").addEventListener("click", closeCart);
  document.getElementById("overlay").addEventListener("click", closeCart);

  // ⭐ MODAL PayPal
  document.getElementById("paypal-modal-close").addEventListener("click", closePayPalModal);

  document.getElementById("proceed-to-payment").addEventListener("click", handlePaymentClick);
});

function closeCart() {
  document.getElementById("cart-panel").classList.add("hidden");
  document.getElementById("overlay").classList.add("hidden");
}

function closePayPalModal() {
  document.getElementById("paypal-modal").classList.add("hidden");
  document.getElementById("paypal-button-container").innerHTML = "";
  paypalButtonRendered = false;
}

function handlePaymentClick() {
  const name = document.getElementById("customer-name").value.trim();
  const email = document.getElementById("customer-email").value.trim();
  const pickup = document.getElementById("pickup-checkbox").checked;
  const address = document.getElementById("customer-address").value.trim();
  const cguChecked = document.getElementById("cgu-checkbox").checked;

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

  console.log("✅ Validation OK ! Affichage de PayPal...");

  // ⭐ Ouvre le MODAL au lieu de popup
  document.getElementById("paypal-modal").classList.remove("hidden");

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const shippingCost = pickup ? 0 : 3.99;
  const total = subtotal + shippingCost;

  const customer = { name, email, address, pickup };

  if (!paypalButtonRendered) {
    renderPayPalButton(total, customer);
    paypalButtonRendered = true;
  }
}

function renderPayPalButton(total, customer) {
  const container = document.getElementById("paypal-button-container");
  container.innerHTML = "";

  if (cart.length === 0 || !window.paypal) {
    console.error("❌ Panier vide ou PayPal SDK non chargé");
    return;
  }

  paypal.Buttons({
    createOrder: async (data, actions) => {
      try {
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
        console.log("✅ Commande créée :", orderData.orderId);
        return orderData.orderId;
      } catch (err) {
        console.error("❌ Erreur create-order :", err);
        alert("❌ Erreur création commande");
        throw err;
      }
    },

    onApprove: async (data, actions) => {
      try {
        const res = await fetch("/api/paypal/capture-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderID })
        });

        const orderData = await res.json();

        if (orderData.success) {
          // ✅ Enregistre la commande
          await fetch("/api/order", {
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

          alert("✅ Paiement validé ! Facture envoyée par email.");
          cart = [];
          updateCartUI();
          closePayPalModal();
          closeCart();
        } else {
          alert("❌ Erreur : " + (orderData.error || "Paiement non complété"));
        }
      } catch (err) {
        console.error("❌ Erreur capture-order :", err);
        alert("❌ Erreur de paiement. Réessayez.");
      }
    },

    onError: (err) => {
      console.error("❌ Erreur PayPal :", err);
      alert("❌ Erreur de paiement. Réessayez.");
    }
  }).render("#paypal-button-container");
}