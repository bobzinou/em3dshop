async function loadPayPalSDK() {
  try {
    const res = await fetch("/api/paypal-config");
    const data = await res.json();

    if (!data.clientId) {
      console.error("❌ Client ID PayPal introuvable. Vérifie ton .env");
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${data.clientId}&currency=EUR`;
    script.onload = () => {
      console.log("✅ SDK PayPal chargé avec le vrai Client ID");
      document.dispatchEvent(new Event("paypal-sdk-ready"));
    };
    document.body.appendChild(script);
  } catch (err) {
    console.error("Erreur chargement PayPal SDK :", err);
  }
}

loadPayPalSDK();