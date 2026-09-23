module.exports = {
  siteName: "EM3DSHOP",

  // Frais de livraison
  shipping: {
    price: 3.99,
    freeLocalPickup: true,
    pickupLocation: "Le Plessis-Bouchard (95)"
  },

  // PayPal - Mode Sandbox (test) pour l'instant
  // Quand tu seras prêt pour le vrai site, remplace par ton Client ID PayPal Live
  paypal: {
    mode: "sandbox", // "sandbox" ou "live"
    clientId: "sb" // "sb" = client id de test générique PayPal, fonctionne direct en sandbox
  },

  // Thèmes disponibles avec leurs couleurs
  themes: {
    halloween: {
      label: "Halloween",
      colors: {
        bg: "#0d0d0d",
        bgSecondary: "#1a1a1a",
        primary: "#ff7518",
        secondary: "#ffffff",
        text: "#f5f5f5",
        cardBg: "#1f1f1f",
        border: "#ff7518"
      }
    },
    noel: {
      label: "Noël",
      colors: {
        bg: "#ffffff",
        bgSecondary: "#f7f7f7",
        primary: "#c81d25",
        secondary: "#146b3a",
        text: "#1a1a1a",
        cardBg: "#ffffff",
        border: "#c81d25"
      }
    },
    figurines: {
      label: "Figurines",
      colors: {
        bg: "#f4f1ea",
        bgSecondary: "#eae5d9",
        primary: "#3a5a78",
        secondary: "#d8a24a",
        text: "#222222",
        cardBg: "#ffffff",
        border: "#3a5a78"
      }
    },
    hueforge: {
      label: "Tableaux Hueforge",
      colors: {
        bg: "#101418",
        bgSecondary: "#1c2228",
        primary: "#5ec2e8",
        secondary: "#c0c0c0",
        text: "#f0f0f0",
        cardBg: "#1c2228",
        border: "#5ec2e8"
      }
    }
  },

  // Catégories disponibles pour chaque thème
  categories: ["Décorations", "Figurines", "Divers"]
};