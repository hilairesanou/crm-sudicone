// server/routes/factures.js
const express = require('express');
const db = require('../db/connection');
const { logActivite } = require('../utils/activite');
const PDFDocument = require('pdfkit');

const router = express.Router();

function genererNumero(type) {
  const prefix = type === 'facture' ? 'FAC' : 'DEV';
  const annee  = new Date().getFullYear();
  const count  = db.prepare(`SELECT COUNT(*) as c FROM factures WHERE type = ? AND strftime('%Y', created_at) = ?`).get(type, String(annee)).c;
  return `${prefix}-${annee}-${String(count + 1).padStart(4, '0')}`;
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
  if (role === 'commercial') { sql += ' AND f.owner_id = ?'; params.push(userId); }
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
  const { type, contact_id, opportunite_id, taux_tva, date_echeance, lignes, notes } = req.body;
  if (!Array.isArray(lignes) || lignes.length === 0) {
    return res.status(400).json({ error: 'Au moins une ligne est requise' });
  }
  const montant_ht  = lignes.reduce((sum, l) => sum + (l.quantite * l.prix_unitaire), 0);
  const tva         = taux_tva ?? 18;
  const montant_ttc = montant_ht * (1 + tva / 100);
  const numero      = genererNumero(type || 'devis');

  const transaction = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO factures (numero, type, contact_id, opportunite_id, statut,
        montant_ht, taux_tva, montant_ttc, date_echeance, notes, owner_id)
      VALUES (?, ?, ?, ?, 'brouillon', ?, ?, ?, ?, ?, ?)
    `).run(numero, type || 'devis', contact_id || null, opportunite_id || null,
           montant_ht, tva, montant_ttc, date_echeance || null, notes || null, req.session.userId);
    const factureId = result.lastInsertRowid;
    for (const ligne of lignes) {
      db.prepare(`INSERT INTO facture_lignes (facture_id, designation, quantite, prix_unitaire, total) VALUES (?, ?, ?, ?, ?)`)
        .run(factureId, ligne.designation, ligne.quantite, ligne.prix_unitaire, ligne.quantite * ligne.prix_unitaire);
    }
    return factureId;
  });

  const factureId = transaction();
  logActivite(
    type === 'facture' ? 'facture_creee' : 'devis_cree',
    `${type === 'facture' ? 'Facture' : 'Devis'} ${numero} créé(e) — ${montant_ttc.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XOF TTC`,
    contact_id, req.session.userId
  );
  const facture = db.prepare('SELECT * FROM factures WHERE id = ?').get(factureId);
  facture.lignes = db.prepare('SELECT * FROM facture_lignes WHERE facture_id = ?').all(factureId);
  res.status(201).json(facture);
});

// PUT /api/factures/:id — édition complète
router.put('/:id', (req, res) => {
  const role   = req.session.role;
  const userId = req.session.userId;
  const existing = db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Document introuvable' });
  if (role === 'commercial' && existing.owner_id !== userId) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }

  const { contact_id, taux_tva, date_echeance, lignes, notes } = req.body;

  const montant_ht  = lignes.reduce((sum, l) => sum + (l.quantite * l.prix_unitaire), 0);
  const tva         = taux_tva ?? existing.taux_tva ?? 18;
  const montant_ttc = montant_ht * (1 + tva / 100);

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE factures SET contact_id=?, taux_tva=?, montant_ht=?, montant_ttc=?,
        date_echeance=?, notes=? WHERE id=?
    `).run(contact_id || null, tva, montant_ht, montant_ttc,
           date_echeance || null, notes || null, req.params.id);
    db.prepare('DELETE FROM facture_lignes WHERE facture_id = ?').run(req.params.id);
    for (const ligne of lignes) {
      db.prepare(`INSERT INTO facture_lignes (facture_id, designation, quantite, prix_unitaire, total) VALUES (?, ?, ?, ?, ?)`)
        .run(req.params.id, ligne.designation, ligne.quantite, ligne.prix_unitaire, ligne.quantite * ligne.prix_unitaire);
    }
  });

  transaction();
  logActivite('facture_modifiee', `${existing.numero} modifié(e)`, contact_id, userId);
  const facture = db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id);
  facture.lignes = db.prepare('SELECT * FROM facture_lignes WHERE facture_id = ?').all(req.params.id);
  res.json(facture);
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
  const statutLabel = { brouillon: 'Brouillon', envoye: 'Envoyé', paye: 'Payé', en_retard: 'En retard', annule: 'Annulé' };
  logActivite('facture_statut', `${existing.numero} passé(e) au statut "${statutLabel[statut] || statut}"`, existing.contact_id, userId);
  res.json(db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id));
});

// DELETE /api/factures/:id
router.delete('/:id', (req, res) => {
  if (req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Suppression réservée à l\'administrateur.' });
  }
  const existing = db.prepare('SELECT * FROM factures WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Document introuvable' });
  logActivite('facture_supprimee', `${existing.type === 'facture' ? 'Facture' : 'Devis'} ${existing.numero} supprimé(e)`, existing.contact_id, req.session.userId);
  db.prepare('DELETE FROM factures WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/factures/:id/pdf
router.get('/:id/pdf', (req, res) => {
  const role   = req.session.role;
  const userId = req.session.userId;
  const facture = db.prepare(`
    SELECT f.*, c.nom as contact_nom, c.entreprise as contact_entreprise,
           c.email as contact_email, c.adresse as contact_adresse, c.ville as contact_ville
    FROM factures f LEFT JOIN contacts c ON c.id = f.contact_id
    WHERE f.id = ?
  `).get(req.params.id);
  if (!facture) return res.status(404).json({ error: 'Document introuvable' });
  if (role === 'commercial' && facture.owner_id !== userId) {
    return res.status(403).json({ error: 'Accès refusé.' });
  }
  logActivite('facture_pdf', `PDF de ${facture.numero} consulté`, facture.contact_id, userId);
  facture.lignes = db.prepare('SELECT * FROM facture_lignes WHERE facture_id = ?').all(req.params.id);

  // ── Helpers formatage ────────────────────────────────────────────
  function fmtMontant(n) {
    return Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' XOF';
  }
  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  const BLUE  = '#0b2545';
  const LIGHT = '#f8f9fa';
  const GRAY  = '#6b7280';
  const W     = 595.28; // largeur A4 en points
  const M     = 45;     // marge

  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    bufferPages: true, // important pour éviter les pages vides
    info: {
      Title: facture.numero,
      Author: 'CRM Sudicone'
    }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${facture.numero}.pdf"`);
  doc.pipe(res);

  // ── HEADER ───────────────────────────────────────────────────────
  doc.rect(0, 0, W, 110).fill(BLUE);

  // Logo
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24)
     .text('SUDICONE', M, 28);
  doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.7)')
     .text('Agence de Communication & Digital', M, 58);
  doc.text('+226 04 86 41 24  |  sudicone226@outlook.fr', M, 72);
  doc.text('Ouagadougou, Burkina Faso', M, 86);

  // Boite type document
  const bW = 180, bH = 76;
  const bX = W - bW - M, bY = 17;
  doc.roundedRect(bX, bY, bW, bH, 6).fill('rgba(255,255,255,0.12)');
  doc.fillColor('#c9a84c').font('Helvetica-Bold').fontSize(14)
     .text(facture.type === 'facture' ? 'FACTURE' : 'DEVIS', bX, bY + 10, { width: bW, align: 'center' });
  doc.fillColor('#ffffff').font('Helvetica').fontSize(9)
     .text(`N° ${facture.numero}`, bX, bY + 32, { width: bW, align: 'center' });
  doc.text(`Date : ${fmtDate(facture.date_emission)}`, bX, bY + 46, { width: bW, align: 'center' });
  doc.text(`Échéance : ${fmtDate(facture.date_echeance)}`, bX, bY + 60, { width: bW, align: 'center' });

  let y = 128;

  // ── INFOS CLIENT ─────────────────────────────────────────────────
  doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(9)
     .text('FACTURER À', M, y);
  y += 14;

  const clientLines = [
    facture.contact_entreprise,
    facture.contact_nom,
    facture.contact_adresse,
    facture.contact_ville,
    facture.contact_email
  ].filter(Boolean);

  clientLines.forEach(line => {
    doc.fillColor('#333333').font('Helvetica').fontSize(10).text(line, M, y);
    y += 14;
  });

  y += 10;

  // ── TABLEAU LIGNES ────────────────────────────────────────────────
  // En-tête tableau
  const COL = {
    desc: M,
    qty:  M + 260,
    pu:   M + 320,
    total: M + 410
  };
  const tableW = W - M * 2;

  doc.rect(M, y, tableW, 22).fill(BLUE);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
  doc.text('Désignation',  COL.desc  + 4, y + 7, { width: 250 });
  doc.text('Qté',          COL.qty,        y + 7, { width: 55, align: 'center' });
  doc.text('Prix unitaire',COL.pu,         y + 7, { width: 85, align: 'right' });
  doc.text('Total',        COL.total,      y + 7, { width: 80, align: 'right' });
  y += 22;

  // Lignes
  let subtotal = 0;
  facture.lignes.forEach((l, idx) => {
    const lineTotal = (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0);
    subtotal += lineTotal;

    // Fond alterné
    if (idx % 2 === 0) {
      doc.rect(M, y, tableW, 22).fill(LIGHT);
    }

    doc.fillColor('#333333').font('Helvetica').fontSize(9);
    doc.text(l.designation || '—',                          COL.desc + 4,  y + 7, { width: 250 });
    doc.text(String(Number(l.quantite) || 0),               COL.qty,        y + 7, { width: 55, align: 'center' });
    doc.text(fmtMontant(l.prix_unitaire),                   COL.pu,         y + 7, { width: 85, align: 'right' });
    doc.text(fmtMontant(lineTotal),                         COL.total,      y + 7, { width: 80, align: 'right' });
    y += 22;
  });

  // Ligne séparatrice
  doc.moveTo(M, y + 4).lineTo(W - M, y + 4).strokeColor('#e5e7eb').stroke();
  y += 16;

  // ── TOTAUX ────────────────────────────────────────────────────────
  const tva        = Number(facture.taux_tva) || 18;
  const montantTva = subtotal * (tva / 100);
  const totalTtc   = subtotal + montantTva;
  const totX       = COL.pu - 80;
  const valX       = COL.total;

  // Sous-total HT
  doc.fillColor(GRAY).font('Helvetica').fontSize(9)
     .text('Sous-total HT', totX, y, { width: 170, align: 'left' });
  doc.fillColor('#333').text(fmtMontant(subtotal), valX, y, { width: 80, align: 'right' });
  y += 18;

  // TVA
  doc.fillColor(GRAY).font('Helvetica').fontSize(9)
     .text(`TVA (${tva}%)`, totX, y, { width: 170, align: 'left' });
  doc.fillColor('#333').text(fmtMontant(montantTva), valX, y, { width: 80, align: 'right' });
  y += 18;

  // Total TTC — boite colorée
  const ttcBoxW = 200, ttcBoxH = 32;
  const ttcBoxX = W - M - ttcBoxW;
  doc.rect(ttcBoxX, y, ttcBoxW, ttcBoxH).fill(BLUE);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
     .text('TOTAL TTC', ttcBoxX + 10, y + 10, { width: 90 });
  doc.fillColor('#c9a84c').font('Helvetica-Bold').fontSize(11)
     .text(fmtMontant(totalTtc), ttcBoxX, y + 10, { width: ttcBoxW - 10, align: 'right' });
  y += ttcBoxH + 20;

  // ── NOTES ────────────────────────────────────────────────────────
  if (facture.notes) {
    doc.fillColor(BLUE).font('Helvetica-Bold').fontSize(9).text('NOTES', M, y);
    y += 14;
    doc.fillColor(GRAY).font('Helvetica').fontSize(9)
       .text(facture.notes, M, y, { width: tableW, lineGap: 3 });
    y += 30;
  }

  // ── PIED DE PAGE ─────────────────────────────────────────────────
  // On positionne le pied de page à une position fixe en bas
  const footerY = 780;
  doc.moveTo(M, footerY).lineTo(W - M, footerY).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  doc.fillColor(GRAY).font('Helvetica').fontSize(8)
     .text(
       'SUDICONE — +226 04 86 41 24 • sudicone226@outlook.fr • Ouagadougou, Burkina Faso',
       M, footerY + 8, { width: W - M * 2, align: 'center' }
     );

  doc.end();
});

module.exports = router;