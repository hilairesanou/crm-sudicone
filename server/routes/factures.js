// server/routes/factures.js
const express = require('express');
const db = require('../db/connection');
const { logActivite } = require('../utils/activite');
const PDFDocument = require('pdfkit');

const router = express.Router();

function genererNumero(type) {
  const prefix = type === 'facture' ? 'FAC' : 'DEV';
  const annee = new Date().getFullYear();
  const count = db.prepare(`SELECT COUNT(*) as c FROM factures WHERE type = ? AND strftime('%Y', created_at) = ?`).get(type, String(annee)).c;
  const numero = String(count + 1).padStart(4, '0');
  return `${prefix}-${annee}-${numero}`;
}

// GET /api/factures
router.get('/', (req, res) => {
  const { type, statut } = req.query;
  const role   = req.session.role;
  const userId = req.session.userId;

  let sql = `
    SELECT f.*, c.nom as contact_nom, c.entreprise as contact_entreprise
    FROM factures f
    LEFT JOIN contacts c ON c.id = f.contact_id
    WHERE 1=1
  `;
  const params = [];

  if (role === 'commercial') {
    sql += ` AND f.owner_id = ?`;
    params.push(userId);
  }
  if (type)   { sql += ' AND f.type = ?';   params.push(type); }
  if (statut) { sql += ' AND f.statut = ?'; params.push(statut); }
  sql += ' ORDER BY f.created_at DESC';

  res.json(db.prepare(sql).all(...params));
});

// GET /api/factures/:id
router.get('/:id', (req, res) => {
  const role   = req.session.role;
  const userId = req.session.userId;

  const facture = db.prepare(`
    SELECT f.*, c.nom as contact_nom, c.entreprise as contact_entreprise,
           c.email as contact_email, c.adresse as contact_adresse
    FROM factures f
    LEFT JOIN contacts c ON c.id = f.contact_id
    WHERE f.id = ?
  `).get(req.params.id);

  if (!facture) return res.status(404).json({ error: 'Document introuvable' });

  if (role === 'commercial' && facture.owner_id !== userId) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }

  facture.lignes = db.prepare('SELECT * FROM facture_lignes WHERE facture_id = ?').all(req.params.id);
  res.json(facture);
});

// POST /api/factures
router.post('/', (req, res) => {
  const { type, contact_id, opportunite_id, taux_tva, date_echeance, lignes } = req.body;

  if (!Array.isArray(lignes) || lignes.length === 0) {
    return res.status(400).json({ error: 'Au moins une ligne est requise' });
  }

  const montant_ht  = lignes.reduce((sum, l) => sum + (l.quantite * l.prix_unitaire), 0);
  const tva         = taux_tva ?? 18;
  const montant_ttc = montant_ht * (1 + tva / 100);
  const numero      = genererNumero(type || 'devis');

  const insertFacture = db.prepare(`
    INSERT INTO factures (numero, type, contact_id, opportunite_id, statut,
      montant_ht, taux_tva, montant_ttc, date_echeance, owner_id)
    VALUES (?, ?, ?, ?, 'brouillon', ?, ?, ?, ?, ?)
  `);
  const insertLigne = db.prepare(`
    INSERT INTO facture_lignes (facture_id, designation, quantite, prix_unitaire, total)
    VALUES (?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    const result = insertFacture.run(
      numero, type || 'devis', contact_id || null, opportunite_id || null,
      montant_ht, tva, montant_ttc, date_echeance || null, req.session.userId
    );
    const factureId = result.lastInsertRowid;
    for (const ligne of lignes) {
      insertLigne.run(factureId, ligne.designation, ligne.quantite,
        ligne.prix_unitaire, ligne.quantite * ligne.prix_unitaire);
    }
    return factureId;
  });

  const factureId = transaction();

  // ── Log enrichi ───────────────────────────────────────────────────
  logActivite(
    type === 'facture' ? 'facture_creee' : 'devis_cree',
    `${type === 'facture' ? 'Facture' : 'Devis'} ${numero} créé(e) — ${montant_ttc.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XOF TTC`,
    contact_id, req.session.userId
  );

  const facture = db.prepare('SELECT * FROM factures WHERE id = ?').get(factureId);
  facture.lignes = db.prepare('SELECT * FROM facture_lignes WHERE facture_id = ?').all(factureId);
  res.status(201).json(facture);
});

// PUT /api/factures/:id/statut
router.put('/:id/statut', (req, res) => {
  const role   = req.session.role;
  const userId = req.session.userId;
  const { statut } = req.body;

  const existing = db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Document introuvable' });

  if (role === 'commercial' && existing.owner_id !== userId) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }

  db.prepare('UPDATE factures SET statut = ? WHERE id = ?').run(statut, req.params.id);

  // ── Log avec label lisible ────────────────────────────────────────
  const statutLabel = {
    brouillon: 'Brouillon', envoye: 'Envoyé',
    paye: 'Payé', en_retard: 'En retard', annule: 'Annulé'
  };
  logActivite(
    'facture_statut',
    `${existing.numero} passé(e) au statut "${statutLabel[statut] || statut}"`,
    existing.contact_id, userId
  );

  res.json(db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id));
});

// DELETE /api/factures/:id
router.delete('/:id', (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Suppression réservée à l\'administrateur.' });
  }

  const existing = db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Document introuvable' });

  // ── Log avant suppression ─────────────────────────────────────────
  logActivite(
    'facture_supprimee',
    `${existing.type === 'facture' ? 'Facture' : 'Devis'} ${existing.numero} supprimé(e)`,
    existing.contact_id, req.session.userId
  );

  db.prepare('DELETE FROM factures WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/factures/:id/pdf
router.get('/:id/pdf', (req, res) => {
  const role   = req.session.role;
  const userId = req.session.userId;

  const facture = db.prepare(`
    SELECT f.*, c.nom as contact_nom, c.entreprise as contact_entreprise,
           c.email as contact_email, c.adresse as contact_adresse
    FROM factures f LEFT JOIN contacts c ON c.id = f.contact_id
    WHERE f.id = ?
  `).get(req.params.id);

  if (!facture) return res.status(404).json({ error: 'Document introuvable' });

  if (role === 'commercial' && facture.owner_id !== userId) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }

  // ── Log consultation PDF ──────────────────────────────────────────
  logActivite(
    'facture_pdf',
    `PDF de ${facture.numero} consulté`,
    facture.contact_id, userId
  );

  facture.lignes = db.prepare('SELECT * FROM facture_lignes WHERE facture_id = ?').all(req.params.id);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${facture.numero || 'document'}.pdf"`);
  doc.pipe(res);

  const BLUE  = '#0b2545';
  const LIGHT = '#f7f7f7';
  const GRAY  = '#666';

  doc.save().rect(0, 0, doc.page.width, 120).fill(BLUE).restore();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(28).text('SUDICONE', 50, 34);
  doc.font('Helvetica').fontSize(10).text('sudicone.com', 50, 68);
  doc.text('226 04864124', 50, 82);
  doc.text('sudicone226@outlook.fr', 50, 96);

  const domain = 'sudicone.com';
  doc.font('Helvetica').fontSize(10).text(domain, doc.page.width - 150, 60,
    { width: 120, align: 'right', color: '#ffffff' });

  const infoW = 220, infoH = 72;
  const infoX = doc.page.width - infoW - 50, infoY = 28;
  doc.roundedRect(infoX, infoY, infoW, infoH, 6).fill('#ffffff');
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(12)
    .text(facture.type === 'facture' ? 'FACTURE' : 'DEVIS', infoX + 12, infoY + 8);
  const dateEmission = facture.date_emission
    ? facture.date_emission.slice(0, 10) : new Date().toISOString().slice(0, 10);
  doc.font('Helvetica').fontSize(10).fillColor('#333')
    .text(`N° ${facture.numero || ''}`, infoX + 12, infoY + 28);
  doc.text(`Date : ${dateEmission}`, infoX + 12, infoY + 44);
  doc.text(`Échéance : ${facture.date_echeance || '-'}`, infoX + 12, infoY + 58);

  let cursorY = 140;
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#333').text('Facturer à :', 50, cursorY);
  cursorY += 18;
  if (facture.contact_entreprise) {
    doc.font('Helvetica-Bold').fontSize(11).text(facture.contact_entreprise, 50, cursorY);
    cursorY += 16;
  }
  if (facture.contact_nom)     { doc.font('Helvetica').fontSize(10).text(facture.contact_nom, 50, cursorY);     cursorY += 14; }
  if (facture.contact_adresse) { doc.text(facture.contact_adresse, 50, cursorY); cursorY += 14; }
  if (facture.contact_email)   { doc.text(facture.contact_email,   50, cursorY); cursorY += 14; }

  const tableTop = cursorY + 12;
  const colX = { desc: 50, qty: 360, pu: 440, total: 510 };
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff');
  doc.rect(48, tableTop - 6, doc.page.width - 96, 24).fill(BLUE);
  doc.fillColor('#ffffff').text('Désignation', colX.desc + 2, tableTop - 2);
  doc.text('Qté',        colX.qty,   tableTop - 2, { width: 40, align: 'right' });
  doc.text('Prix unit.',  colX.pu,   tableTop - 2, { width: 60, align: 'right' });
  doc.text('Total',      colX.total, tableTop - 2, { width: 60, align: 'right' });

  doc.font('Helvetica').fontSize(10).fillColor('#333');
  let rowY = tableTop + 22;
  let subtotal = 0;

  facture.lignes.forEach((l, idx) => {
    const lineTotal = (l.quantite || 0) * (l.prix_unitaire || 0);
    subtotal += lineTotal;
    if (idx % 2 === 0) {
      doc.save().rect(48, rowY - 6, doc.page.width - 96, 20).fill(LIGHT).restore();
    }
    if (rowY > doc.page.height - 140) { doc.addPage(); rowY = 50; }

    doc.fillColor('#333').text(l.designation || '-', colX.desc + 2, rowY,
      { width: colX.qty - colX.desc - 10 });
    doc.text(String(l.quantite || 0), colX.qty, rowY, { width: 40, align: 'right' });
    doc.text(Number(l.prix_unitaire || 0).toLocaleString('fr-FR',
      { maximumFractionDigits: 0 }) + ' XOF', colX.pu, rowY, { width: 60, align: 'right' });
    doc.text(Number(lineTotal).toLocaleString('fr-FR',
      { maximumFractionDigits: 0 }) + ' XOF', colX.total, rowY, { width: 60, align: 'right' });
    rowY += 22;
  });

  const tva         = facture.taux_tva != null ? Number(facture.taux_tva) : 18;
  const montantTva  = subtotal * (tva / 100);
  const totalTtc    = subtotal + montantTva;
  const totalsX     = colX.pu;

  doc.moveTo(totalsX - 20, rowY + 8).lineTo(doc.page.width - 48, rowY + 8).stroke('#e6e6e6');
  doc.font('Helvetica').fontSize(10).fillColor('#333')
    .text('Sous-total HT', totalsX - 20, rowY + 14, { width: 150, align: 'left' });
  doc.text(Number(subtotal).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' XOF',
    colX.total, rowY + 14, { width: 60, align: 'right' });
  doc.text(`TVA (${tva}%)`, totalsX - 20, rowY + 34, { width: 150, align: 'left' });
  doc.text(Number(montantTva).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' XOF',
    colX.total, rowY + 34, { width: 60, align: 'right' });

  const boxW = 160, boxH = 40;
  const boxX = doc.page.width - boxW - 48, boxY = rowY + 54;
  doc.roundedRect(boxX, boxY, boxW, boxH, 6).fill(BLUE);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12).text('TOTAL TTC', boxX + 12, boxY + 8);
  doc.font('Helvetica-Bold').fontSize(12).text(
    Number(totalTtc).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' XOF',
    boxX, boxY + 8, { width: boxW - 18, align: 'right' }
  );

  doc.font('Helvetica').fontSize(10).fillColor(GRAY).text('Notes :', 50, boxY + 64);
  if (facture.notes) doc.text(facture.notes, 50, boxY + 80, { width: doc.page.width - 100 });

  doc.moveTo(48, doc.page.height - 60).lineTo(doc.page.width - 48, doc.page.height - 60).stroke('#e6e6e6');
  doc.font('Helvetica').fontSize(9).fillColor('#888')
    .text('Contact: 226 04864124 • sudicone226@outlook.fr • sudicone.com',
      48, doc.page.height - 48, { align: 'center', width: doc.page.width - 96 });

  doc.end();
});

module.exports = router;