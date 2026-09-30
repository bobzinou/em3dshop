// ============================
// relay.js - Gestion Mondial Relay (Sendcloud)
// ============================

let selectedRelayPoint = null;

document.addEventListener("DOMContentLoaded", () => {
  const relayCheckbox = document.getElementById("relay-checkbox");
  const chooseRelayBtn = document.getElementById("choose-relay-btn");
  const relayModal = document.getElementById("relay-modal");
  const relayModalClose = document.getElementById("relay-modal-close");
  const relaySearchBtn = document.getElementById("relay-search-btn");
  const relayPostalCode = document.getElementById("relay-postal-code");
  const relayResults = document.getElementById("relay-results");
  const selectedRelayInfo = document.getElementById("selected-relay-info");
  const overlay = document.getElementById("overlay");
  const pickupCheckbox = document.getElementById("pickup-checkbox");

  if (!relayCheckbox) return;

  // Afficher/masquer le bouton "Choisir un point relais"
  relayCheckbox.addEventListener("change", () => {
    if (relayCheckbox.checked) {
      chooseRelayBtn.classList.remove("hidden");
      if (pickupCheckbox && pickupCheckbox.checked) {
        pickupCheckbox.checked = false;
        pickupCheckbox.dispatchEvent(new Event("change"));
      }
    } else {
      chooseRelayBtn.classList.add("hidden");
      selectedRelayInfo.classList.add("hidden");
      selectedRelayInfo.innerHTML = "";
      selectedRelayPoint = null;
      updateShippingDisplay();
    }
  });

  // Si on coche "retrait main propre", on décoche relay
  if (pickupCheckbox) {
    pickupCheckbox.addEventListener("change", () => {
      if (pickupCheckbox.checked && relayCheckbox.checked) {
        relayCheckbox.checked = false;
        relayCheckbox.dispatchEvent(new Event("change"));
      }
    });
  }

  // Ouvrir la modale de recherche
  chooseRelayBtn.addEventListener("click", () => {
    relayModal.classList.remove("hidden");
    overlay.classList.remove("hidden");
  });

  // Fermer la modale
  relayModalClose.addEventListener("click", closeRelayModal);
  overlay.addEventListener("click", () => {
    if (!relayModal.classList.contains("hidden")) {
      closeRelayModal();
    }
  });

  function closeRelayModal() {
    relayModal.classList.add("hidden");
    overlay.classList.add("hidden");
  }

  // Recherche des points relais
  relaySearchBtn.addEventListener("click", searchRelayPoints);
  relayPostalCode.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchRelayPoints();
    }
  });

  async function searchRelayPoints() {
    const postalCode = relayPostalCode.value.trim();

    if (!postalCode || postalCode.length < 4) {
      relayResults.innerHTML = `<p style="color:red;">Merci d'entrer un code postal valide.</p>`;
      return;
    }

    relayResults.innerHTML = `<p>🔎 Recherche en cours...</p>`;

    try {
      const res = await fetch(
        `/api/relay-points?postalCode=${encodeURIComponent(postalCode)}&country=FR`
      );

      if (!res.ok) {
        throw new Error("Erreur serveur");
      }

      const data = await res.json();
      renderRelayResults(data);
    } catch (err) {
      console.error("Erreur recherche points relais:", err);
      relayResults.innerHTML = `<p style="color:red;">❌ Impossible de récupérer les points relais. Réessayez.</p>`;
    }
  }

  function renderRelayResults(points) {
    if (!points || points.length === 0) {
      relayResults.innerHTML = `<p>Aucun point relais trouvé pour ce code postal.</p>`;
      return;
    }

    relayResults.innerHTML = "";

    points.forEach((point) => {
      const card = document.createElement("div");
      card.className = "relay-point-card";
      card.innerHTML = `
        <strong>${point.name || point.company_name || "Point Relais"}</strong><br>
        ${point.street || ""} ${point.house_number || ""}<br>
        ${point.postal_code || ""} ${point.city || ""}<br>
        <button type="button" class="btn-primary select-relay-btn">Choisir ce point</button>
      `;

      const selectBtn = card.querySelector(".select-relay-btn");
      selectBtn.addEventListener("click", () => {
        selectRelayPoint(point);
      });

      relayResults.appendChild(card);
    });
  }

  function selectRelayPoint(point) {
    // ✅ Enrichis l'objet point avec toutes les infos nécessaires
    selectedRelayPoint = {
      id: point.id,
      name: point.name || point.company_name || "Point Relais",
      street: point.street || "",
      house_number: point.house_number || "",
      postal_code: point.postal_code || "",
      city: point.city || "",
      address: `${point.street || ""} ${point.house_number || ""}`.trim()
    };

    selectedRelayInfo.classList.remove("hidden");
    selectedRelayInfo.innerHTML = `
      ✅ Point relais sélectionné :<br>
      <strong>${selectedRelayPoint.name}</strong><br>
      ${selectedRelayPoint.street} ${selectedRelayPoint.house_number}, ${selectedRelayPoint.postal_code} ${selectedRelayPoint.city}
    `;

    console.log("🎯 Point relais sélectionné:", selectedRelayPoint);

    closeRelayModal();
    updateShippingDisplay();
  }

  function updateShippingDisplay() {
    if (typeof updateTotals === "function") {
      updateTotals();
    }
  }

  // Expose la fonction pour cart.js si besoin
  window.updateShippingDisplay = updateShippingDisplay;
});

// ✅ Ces fonctions doivent rester HORS du DOMContentLoaded pour être accessibles globalement
function getSelectedRelayPoint() {
  return selectedRelayPoint;
}
window.getSelectedRelayPoint = getSelectedRelayPoint;