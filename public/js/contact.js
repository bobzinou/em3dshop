document.getElementById("contact-form").addEventListener("submit", async function(e) {
  e.preventDefault();
  
  const form = e.target;
  const status = document.getElementById("contact-status");
  const submitBtn = document.getElementById("contact-submit");
  
  submitBtn.disabled = true;
  submitBtn.textContent = "Envoi en cours...";
  status.textContent = "";
  status.className = "contact-status";

  const formData = new FormData(form);
  const object = Object.fromEntries(formData);
  const json = JSON.stringify(object);

  try {
    const response = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: json
    });

    const result = await response.json();

    if (result.success) {
      status.textContent = "✅ Message envoyé avec succès ! Je te réponds rapidement.";
      status.classList.add("success");
      form.reset();
    } else {
      status.textContent = "❌ Une erreur est survenue. Réessaie ou contacte-moi directement par email.";
      status.classList.add("error");
    }
  } catch (error) {
    status.textContent = "❌ Erreur de connexion. Réessaie plus tard.";
    status.classList.add("error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Envoyer le message";
  }
});