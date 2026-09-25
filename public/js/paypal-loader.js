async function loadPayPalSDK() {
  try {
    const response = await fetch("/api/paypal-config");
    const config = await response.json();

    if (!config.clientId) {
      console.error("❌ Client ID PayPal introuvable. Vérifie ton .env");
      return false;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${config.clientId}&currency=EUR`;
    script.async = true;

    script.onload = () => {
      console.log("✅ PayPal SDK chargé");
      window.paypalReady = true;
      document.dispatchEvent(new Event("paypalLoaded"));
    };

    script.onerror = () => {
      console.error("❌ Erreur chargement PayPal SDK");
    };

    document.head.appendChild(script);
  } catch (err) {
    console.error(" Erreur config PayPal :", err);
  }
}

loadPayPalSDK();