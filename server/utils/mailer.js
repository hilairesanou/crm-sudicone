// server/utils/mailer.js
// Utilitaire d'envoi d'emails via Gmail (Nodemailer)
// Remplacer GMAIL_USER et GMAIL_PASS dans .env par les vraies valeurs

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// ── Template email facture en retard ─────────────────────────────────────────
function templateFactureRetard(data) {
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', sans-serif; background:#f0f4f8; margin:0; padding:0; }
    .wrapper { max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08); }
    .header { background:#0b2545; padding:32px; text-align:center; }
    .header h1 { color:#fff; font-size:1.4rem; margin:0; letter-spacing:1px; }
    .header p { color:rgba(255,255,255,0.7); font-size:0.85rem; margin:6px 0 0; }
    .body { padding:32px; }
    .body h2 { font-size:1.1rem; color:#0b2545; margin-bottom:8px; }
    .body p { color:#6b7280; font-size:0.9rem; line-height:1.7; margin-bottom:16px; }
    .alert-box {
      background:#fef2f2; border:1px solid #fecaca;
      border-left:4px solid #dc2626; border-radius:8px;
      padding:16px 20px; margin-bottom:24px;
    }
    .alert-box .montant { font-size:1.4rem; font-weight:800; color:#dc2626; }
    .alert-box .detail { font-size:0.85rem; color:#991b1b; margin-top:4px; }
    .info-grid {
      display:grid; grid-template-columns:1fr 1fr;
      gap:12px; margin-bottom:24px;
    }
    .info-item { background:#f7f8fa; border-radius:8px; padding:12px 14px; }
    .info-item label { display:block; font-size:0.72rem; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:3px; }
    .info-item span { font-size:0.9rem; font-weight:600; color:#0b2545; }
    .btn {
      display:block; text-align:center;
      background:#0b2545; color:#fff;
      padding:14px 24px; border-radius:8px;
      text-decoration:none; font-weight:700;
      font-size:0.9rem; margin-bottom:24px;
    }
    .footer { background:#f7f8fa; padding:20px 32px; text-align:center; }
    .footer p { color:#9ca3af; font-size:0.78rem; margin:0; line-height:1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>SUDICONE</h1>
      <p>Communication & Digital — Burkina Faso</p>
    </div>
    <div class="body">
      <h2>Bonjour ${data.contact_nom},</h2>
      <p>
        Nous vous contactons au sujet d'une facture dont le délai de paiement 
        est dépassé. Nous vous invitons à régulariser votre situation dans 
        les meilleurs délais.
      </p>

      <div class="alert-box">
        <div class="montant">${data.montant_ttc} XOF</div>
        <div class="detail">
          Facture ${data.numero} — ${data.jours_retard} jour(s) de retard
        </div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
        <tr style="background:#f7f8fa;">
          <td style="padding:10px 14px; font-size:0.82rem; color:#6b7280; width:40%;">Numéro de facture</td>
          <td style="padding:10px 14px; font-size:0.88rem; font-weight:600; color:#0b2545;">${data.numero}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px; font-size:0.82rem; color:#6b7280;">Date d'émission</td>
          <td style="padding:10px 14px; font-size:0.88rem; font-weight:600; color:#0b2545;">${data.date_emission}</td>
        </tr>
        <tr style="background:#f7f8fa;">
          <td style="padding:10px 14px; font-size:0.82rem; color:#6b7280;">Date d'échéance</td>
          <td style="padding:10px 14px; font-size:0.88rem; font-weight:600; color:#dc2626;">${data.date_echeance}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px; font-size:0.82rem; color:#6b7280;">Montant TTC</td>
          <td style="padding:10px 14px; font-size:0.88rem; font-weight:700; color:#0b2545;">${data.montant_ttc} XOF</td>
        </tr>
      </table>

      <p>
        Pour effectuer votre règlement ou pour toute question concernant 
        cette facture, n'hésitez pas à nous contacter :
      </p>

      <table style="width:100%; margin-bottom:24px;">
        <tr>
          <td style="padding:6px 0; font-size:0.85rem; color:#6b7280;">
            📞 <strong>20 20 20 20</strong>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-size:0.85rem; color:#6b7280;">
            ✉️ <strong>sudicone@gmail.com</strong>
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0; font-size:0.85rem; color:#6b7280;">
            📍 Trame d'accueil, 2ème étage, Immeuble Le Privilège, Ouagadougou
          </td>
        </tr>
      </table>

      <p style="font-size:0.82rem; color:#9ca3af;">
        Si vous avez déjà effectué ce paiement, veuillez ignorer ce message 
        et nous envoyer votre justificatif par email.
      </p>
    </div>
    <div class="footer">
      <p>
        © 2026 SUDICONE — Communication & Digital<br>
        Cet email a été envoyé automatiquement, merci de ne pas y répondre directement.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

// ── Envoi email facture en retard ─────────────────────────────────────────────
async function envoyerRappelFacture(facture) {
  if (!facture.contact_email) return { sent: false, reason: 'Pas d\'email client' };
  if (!process.env.GMAIL_USER || !process.env.GMAIL_PASS) {
    console.log(`[Mailer] Config email manquante — rappel non envoyé pour ${facture.numero}`);
    return { sent: false, reason: 'Config email manquante' };
  }

  const joursRetard = Math.floor(
    (new Date() - new Date(facture.date_echeance)) / (1000 * 60 * 60 * 24)
  );

  const data = {
    contact_nom:  facture.contact_nom  || 'Client',
    numero:       facture.numero,
    montant_ttc:  Number(facture.montant_ttc || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }),
    date_emission: facture.date_emission ? new Date(facture.date_emission).toLocaleDateString('fr-FR') : '—',
    date_echeance: facture.date_echeance ? new Date(facture.date_echeance).toLocaleDateString('fr-FR') : '—',
    jours_retard: joursRetard
  };

  try {
    await transporter.sendMail({
      from:    `"SUDICONE" <${process.env.GMAIL_USER}>`,
      to:      facture.contact_email,
      subject: `⚠️ Rappel de paiement — Facture ${facture.numero} (${joursRetard} jour(s) de retard)`,
      html:    templateFactureRetard(data)
    });

    console.log(`✓ Rappel envoyé à ${facture.contact_email} pour ${facture.numero}`);
    return { sent: true };
  } catch (err) {
    console.error(`✗ Erreur envoi email ${facture.numero}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

module.exports = { envoyerRappelFacture };