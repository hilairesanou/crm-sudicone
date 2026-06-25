const express = require('express');
const db = require('../db/connection');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const router = express.Router();

// ─── EXPORT EXISTANT : Contacts XLSX ────────────────────────────────────────
router.get('/contacts.xlsx', async (req, res) => {
  const contacts = db.prepare('SELECT * FROM contacts ORDER BY nom ASC').all();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Contacts');
  sheet.columns = [
    { header: 'ID', key: 'id', width: 8 },
    { header: 'Nom', key: 'nom', width: 30 },
    { header: 'Entreprise', key: 'entreprise', width: 30 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Téléphone', key: 'telephone', width: 20 },
    { header: 'Ville', key: 'ville', width: 20 },
    { header: 'Pays', key: 'pays', width: 18 },
    { header: 'Statut', key: 'statut_client', width: 18 },
    { header: 'Code client', key: 'code_client', width: 18 },
    { header: 'Responsable', key: 'responsable', width: 24 }
  ];
  contacts.forEach(c => sheet.addRow(c));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=contacts.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

// ─── EXPORT EXISTANT : Clients PDF ──────────────────────────────────────────
router.get('/clients.pdf', (req, res) => {
  const contacts = db.prepare('SELECT * FROM contacts WHERE type = ? ORDER BY nom ASC').all('client');
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=clients.pdf');
  doc.pipe(res);
  doc.fontSize(18).text('Liste des clients SUDICONE', { align: 'center' }).moveDown(0.5);
  doc.fontSize(10);
  contacts.forEach((c, index) => {
    doc.text(`${index + 1}. ${c.nom} — ${c.entreprise || 'Sans entreprise'} (${c.email || '—'})`, { continued: false });
    doc.text(`    Code client: ${c.code_client || '—'} | Statut: ${c.statut_client || '—'} | Ville: ${c.ville || '—'} | Téléphone: ${c.telephone || '—'}`);
    doc.moveDown(0.2);
  });
  doc.end();
});

// ─── NOUVEAU : Rapport CA mensuel XLSX ──────────────────────────────────────
router.get('/rapport-ca.xlsx', async (req, res) => {
  const ca = db.prepare(`
    SELECT
      strftime('%Y-%m', date_emission) AS mois,
      COUNT(*) AS nb_factures,
      ROUND(SUM(montant_ht), 0) AS total_ht,
      ROUND(SUM(montant_ttc), 0) AS total_ttc,
      ROUND(SUM(CASE WHEN statut = 'paye' THEN montant_ttc ELSE 0 END), 0) AS ca_encaisse
    FROM factures
    WHERE type = 'facture'
    GROUP BY mois
    ORDER BY mois DESC
  `).all();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CRM Sudicone';
  const sheet = workbook.addWorksheet('CA Mensuel');

  sheet.columns = [
    { header: 'Mois', key: 'mois', width: 15 },
    { header: 'Nb Factures', key: 'nb_factures', width: 15 },
    { header: 'Total HT (XOF)', key: 'total_ht', width: 20 },
    { header: 'Total TTC (XOF)', key: 'total_ttc', width: 20 },
    { header: 'CA Encaissé (XOF)', key: 'ca_encaisse', width: 22 }
  ];

  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A6B' } };
    cell.alignment = { horizontal: 'center' };
  });

  ca.forEach(row => sheet.addRow(row));

  const totalRow = sheet.addRow({
    mois: 'TOTAL',
    nb_factures: ca.reduce((s, r) => s + r.nb_factures, 0),
    total_ht: ca.reduce((s, r) => s + r.total_ht, 0),
    total_ttc: ca.reduce((s, r) => s + r.total_ttc, 0),
    ca_encaisse: ca.reduce((s, r) => s + r.ca_encaisse, 0)
  });
  totalRow.eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=rapport-ca.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

// ─── NOUVEAU : Rapport Pipeline XLSX ────────────────────────────────────────
router.get('/rapport-pipeline.xlsx', async (req, res) => {
  const opportunites = db.prepare(`
    SELECT
      o.titre AS nom,
      o.etape,
      o.montant,
      o.probabilite,
      o.date_cloture_prevue AS date_cloture,
      o.etape AS statut,
      c.nom AS contact_nom,
      c.entreprise AS contact_entreprise,
      u.nom AS commercial_nom
    FROM opportunites o
    LEFT JOIN contacts c ON c.id = o.contact_id
    LEFT JOIN users u ON u.id = o.owner_id
    ORDER BY o.etape, o.montant DESC
  `).all();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CRM Sudicone';
  const sheet = workbook.addWorksheet('Pipeline');

  sheet.columns = [
    { header: 'Opportunité', key: 'nom', width: 30 },
    { header: 'Étape', key: 'etape', width: 20 },
    { header: 'Montant (XOF)', key: 'montant', width: 20 },
    { header: 'Probabilité (%)', key: 'probabilite', width: 18 },
    { header: 'Date clôture prévue', key: 'date_cloture', width: 22 },
    { header: 'Contact', key: 'contact_nom', width: 25 },
    { header: 'Entreprise', key: 'contact_entreprise', width: 25 },
    { header: 'Commercial', key: 'commercial_nom', width: 25 }
  ];

  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A6B' } };
    cell.alignment = { horizontal: 'center' };
  });

  opportunites.forEach(row => sheet.addRow(row));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=rapport-pipeline.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

// ─── NOUVEAU : Rapport Performance Commerciaux XLSX ─────────────────────────
router.get('/rapport-commerciaux.xlsx', async (req, res) => {
  const perf = db.prepare(`
    SELECT
      u.nom AS commercial,
      COUNT(DISTINCT c.id) AS nb_contacts,
      COUNT(DISTINCT o.id) AS nb_opportunites,
      ROUND(SUM(CASE WHEN o.etape = 'gagne' THEN o.montant ELSE 0 END), 0) AS montant_gagne,
      COUNT(DISTINCT CASE WHEN o.etape = 'gagne' THEN o.id END) AS nb_gagnes,
      COUNT(DISTINCT CASE WHEN o.etape = 'perdu' THEN o.id END) AS nb_perdus,
      COUNT(DISTINCT t.id) AS nb_taches
    FROM users u
    LEFT JOIN contacts c ON c.owner_id = u.id
    LEFT JOIN opportunites o ON o.owner_id = u.id
    LEFT JOIN taches t ON t.assigned_to = u.id
    WHERE u.role IN ('commercial', 'manager', 'admin')
    GROUP BY u.id, u.nom
    ORDER BY montant_gagne DESC
  `).all();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CRM Sudicone';
  const sheet = workbook.addWorksheet('Commerciaux');

  sheet.columns = [
    { header: 'Commercial', key: 'commercial', width: 25 },
    { header: 'Contacts', key: 'nb_contacts', width: 15 },
    { header: 'Opportunités', key: 'nb_opportunites', width: 18 },
    { header: 'Montant Gagné (XOF)', key: 'montant_gagne', width: 22 },
    { header: 'Opportunités Gagnées', key: 'nb_gagnes', width: 22 },
    { header: 'Opportunités Perdues', key: 'nb_perdus', width: 22 },
    { header: 'Tâches assignées', key: 'nb_taches', width: 20 }
  ];

  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A6B' } };
    cell.alignment = { horizontal: 'center' };
  });

  perf.forEach(row => sheet.addRow(row));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=rapport-commerciaux.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

// ─── RAPPORT ANALYTIQUE PDF MENSUEL ─────────────────────────────────────────
router.get('/rapport-analytique.pdf', (req, res) => {

  // ── Collecte des données ──────────────────────────────────────────────────
  const stats = {
    totalContacts:    db.prepare('SELECT COUNT(*) as c FROM contacts').get().c,
    totalClients:     db.prepare("SELECT COUNT(*) as c FROM contacts WHERE type='client'").get().c,
    totalProspects:   db.prepare("SELECT COUNT(*) as c FROM contacts WHERE type='prospect'").get().c,
    totalOpportunites:db.prepare('SELECT COUNT(*) as c FROM opportunites').get().c,
    oppEnCours:       db.prepare("SELECT COUNT(*) as c FROM opportunites WHERE etape NOT IN ('gagne','perdu')").get().c,
    oppGagnees:       db.prepare("SELECT COUNT(*) as c FROM opportunites WHERE etape='gagne'").get().c,
    oppPerdues:       db.prepare("SELECT COUNT(*) as c FROM opportunites WHERE etape='perdu'").get().c,
    caTotal:          db.prepare("SELECT COALESCE(SUM(montant_ttc),0) as t FROM factures WHERE statut='paye'").get().t,
    facturesEnRetard: db.prepare("SELECT COUNT(*) as c FROM factures WHERE statut='en_retard'").get().c,
    montantRetard:    db.prepare("SELECT COALESCE(SUM(montant_ttc),0) as t FROM factures WHERE statut='en_retard'").get().t,
    tachesActives:    db.prepare("SELECT COUNT(*) as c FROM taches WHERE statut IN ('a_faire','en_cours')").get().c,
  };

  const tauxConversion = stats.totalOpportunites > 0
    ? Math.round((stats.oppGagnees / stats.totalOpportunites) * 100) : 0;

  const caMensuel = db.prepare(`
    SELECT strftime('%Y-%m', date_emission) as mois,
           COALESCE(SUM(montant_ttc),0) as total,
           COUNT(*) as nb
    FROM factures WHERE statut='paye'
    AND date_emission >= date('now','-12 months')
    GROUP BY mois ORDER BY mois ASC
  `).all();

  const pipeline = db.prepare(`
    SELECT etape, COUNT(*) as count,
           COALESCE(SUM(montant),0) as montant
    FROM opportunites GROUP BY etape
  `).all();

  const commerciaux = db.prepare(`
    SELECT u.nom,
      COUNT(DISTINCT o.id) as nb_opps,
      COUNT(DISTINCT CASE WHEN o.etape='gagne' THEN o.id END) as nb_gagnes,
      COALESCE(SUM(CASE WHEN o.etape='gagne' THEN o.montant ELSE 0 END),0) as ca_gagne
    FROM users u
    LEFT JOIN opportunites o ON o.owner_id = u.id
    WHERE u.actif = 1
    GROUP BY u.id, u.nom
    ORDER BY ca_gagne DESC
    LIMIT 8
  `).all();

  const topOpps = db.prepare(`
    SELECT o.titre, o.etape, o.montant, o.probabilite,
           o.date_cloture_prevue, o.created_at,
           c.nom as contact_nom
    FROM opportunites o
    LEFT JOIN contacts c ON c.id = o.contact_id
    WHERE o.etape NOT IN ('gagne','perdu')
    ORDER BY o.probabilite DESC, o.montant DESC
    LIMIT 5
  `).all();

  const alertes = db.prepare(`
    SELECT * FROM factures
    WHERE statut = 'en_retard'
    ORDER BY date_echeance ASC
    LIMIT 5
  `).all();

  // ── Helpers PDF ───────────────────────────────────────────────────────────
  const BLEU  = '#0b2545';
  const OR    = '#c9a84c';
  const GRIS  = '#6b7280';
  const ROUGE = '#dc2626';
  const VERT  = '#16a34a';
  const BLANC = '#ffffff';

  function fmt(n) {
    return Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' XOF';
  }
  function fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR');
  }

  // Régression linéaire pour prévision
  const series = caMensuel.map(d => Number(d.total) || 0);
  let predictedCA = 0;
  if (series.length >= 2) {
    const n = series.length;
    const x = series.map((_, i) => i + 1);
    const sumX  = x.reduce((s, v) => s + v, 0);
    const sumY  = series.reduce((s, v) => s + v, 0);
    const sumXY = x.reduce((s, v, i) => s + v * series[i], 0);
    const sumXX = x.reduce((s, v) => s + v * v, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    predictedCA = Math.max(0, intercept + slope * (n + 1));
  }

  // ── Création du document PDF ──────────────────────────────────────────────
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: {
    Title: 'Rapport Analytique Mensuel — SUDICONE',
    Author: 'CRM Sudicone',
    Subject: 'Analyse de données commerciales'
  }});

  const now   = new Date();
  const moisAn = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const dateGen = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=rapport-analytique-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}.pdf`);
  doc.pipe(res);

  const W = doc.page.width;
  const M = 40; // marge

  // ════════════════════════════════════════════════════════════════════
  // PAGE 1 — EN-TÊTE + RÉSUMÉ EXÉCUTIF
  // ════════════════════════════════════════════════════════════════════

  // Header bleu
  doc.rect(0, 0, W, 130).fill(BLEU);

  // Logo SUDICONE
  doc.fillColor(BLANC).font('Helvetica-Bold').fontSize(28)
     .text('SUDICONE', M, 32);
  doc.font('Helvetica').fontSize(10).fillColor('rgba(255,255,255,0.7)')
     .text('Communication & Digital — Burkina Faso', M, 66);
  doc.text('sudicone@gmail.com  ·  20 20 20 20', M, 82);
  doc.text('Trame d\'accueil, 2ème étage, Immeuble Le Privilège, Ouagadougou', M, 98);

  // Titre rapport (droite)
  doc.rect(W - 220, 20, 180, 90).fill('rgba(255,255,255,0.1)').stroke('rgba(255,255,255,0.2)');
  doc.fillColor(OR).font('Helvetica-Bold').fontSize(11)
     .text('RAPPORT ANALYTIQUE', W - 210, 32, { width: 160, align: 'center' });
  doc.fillColor(BLANC).font('Helvetica').fontSize(9)
     .text(moisAn.toUpperCase(), W - 210, 52, { width: 160, align: 'center' });
  doc.fillColor('rgba(255,255,255,0.7)').fontSize(8)
     .text(`Généré le ${dateGen}`, W - 210, 70, { width: 160, align: 'center' });
  doc.text(`Période : 12 derniers mois`, W - 210, 84, { width: 160, align: 'center' });

  let y = 148;

  // ── Titre section ─────────────────────────────────────────────────────────
  function sectionTitle(titre, yPos) {
    doc.rect(M, yPos, W - M*2, 22).fill('#f0f4f8');
    doc.rect(M, yPos, 4, 22).fill(BLEU);
    doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(10)
       .text(titre, M + 12, yPos + 6);
    return yPos + 32;
  }

  // ── KPI card ──────────────────────────────────────────────────────────────
  function kpiCard(x, yPos, titre, valeur, sous, couleur) {
    const w = 115, h = 64;
    doc.rect(x, yPos, w, h).fill(BLANC).stroke('#e5e7eb');
    doc.rect(x, yPos, w, 3).fill(couleur);
    doc.fillColor(GRIS).font('Helvetica').fontSize(7.5)
       .text(titre.toUpperCase(), x + 8, yPos + 10, { width: w-16 });
    doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(13)
       .text(valeur, x + 8, yPos + 22, { width: w-16 });
    doc.fillColor(GRIS).font('Helvetica').fontSize(7.5)
       .text(sous, x + 8, yPos + 42, { width: w-16 });
  }

  // ── Ligne de tableau ──────────────────────────────────────────────────────
  function tableHeader(cols, yPos, bgColor = BLEU) {
    const totalW = W - M * 2;
    doc.rect(M, yPos, totalW, 20).fill(bgColor);
    let x = M;
    cols.forEach(col => {
      doc.fillColor(BLANC).font('Helvetica-Bold').fontSize(8)
         .text(col.label, x + 4, yPos + 6, { width: col.width - 8, align: col.align || 'left' });
      x += col.width;
    });
    return yPos + 20;
  }

  function tableRow(cols, data, yPos, isEven) {
    const totalW = W - M * 2;
    if (isEven) doc.rect(M, yPos, totalW, 18).fill('#f7f8fa');
    let x = M;
    cols.forEach(col => {
      doc.fillColor('#111827').font('Helvetica').fontSize(8)
         .text(String(data[col.key] || '—'), x + 4, yPos + 5,
               { width: col.width - 8, align: col.align || 'left' });
      x += col.width;
    });
    return yPos + 18;
  }

  // ── SECTION 1 : Résumé exécutif ───────────────────────────────────────────
  y = sectionTitle('1. RÉSUMÉ EXÉCUTIF', y);

  kpiCard(M,       y, 'CA Encaissé',         fmt(stats.caTotal),         `${stats.facturesEnRetard} facture(s) en retard`, BLEU);
  kpiCard(M+120,   y, 'Taux de conversion',  `${tauxConversion}%`,       `${stats.oppGagnees} / ${stats.totalOpportunites} opps`, VERT);
  kpiCard(M+240,   y, 'Contacts totaux',     String(stats.totalContacts),`${stats.totalClients} clients actifs`, OR);
  kpiCard(M+360,   y, 'Impayés',             fmt(stats.montantRetard),   `${stats.facturesEnRetard} facture(s)`, ROUGE);

  y += 80;

  // Indicateurs secondaires
  doc.rect(M, y, W-M*2, 36).fill('#f7f8fa');
  const indics = [
    { label: 'Opportunités actives', val: stats.oppEnCours },
    { label: 'Opportunités gagnées', val: stats.oppGagnees },
    { label: 'Opportunités perdues', val: stats.oppPerdues },
    { label: 'Tâches actives',       val: stats.tachesActives },
    { label: 'Prospects',            val: stats.totalProspects },
    { label: 'CA prévisionnel',      val: fmt(predictedCA) },
  ];
  const indW = (W - M*2) / indics.length;
  indics.forEach((ind, i) => {
    doc.fillColor(GRIS).font('Helvetica').fontSize(7)
       .text(ind.label.toUpperCase(), M + i*indW + 4, y + 5, { width: indW-8, align: 'center' });
    doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(10)
       .text(String(ind.val), M + i*indW + 4, y + 17, { width: indW-8, align: 'center' });
  });
  y += 52;

  // ── SECTION 2 : CA mensuel ────────────────────────────────────────────────
  y = sectionTitle('2. CHIFFRE D\'AFFAIRES MENSUEL (12 DERNIERS MOIS)', y);

  const colsCA = [
    { key: 'mois',  label: 'Mois',       width: 90 },
    { key: 'nb',    label: 'Nb factures', width: 90, align: 'center' },
    { key: 'total', label: 'CA encaissé (XOF)', width: 180, align: 'right' },
    { key: 'pct',   label: '% du total', width: 90, align: 'right' },
    { key: 'barre', label: 'Visualisation', width: W-M*2-450, align: 'left' }
  ];

  y = tableHeader(colsCA, y);

  const caMax = Math.max(...caMensuel.map(d => d.total), 1);
  const caGlobal = caMensuel.reduce((s, d) => s + d.total, 0);

  caMensuel.forEach((d, i) => {
    const pct   = caGlobal > 0 ? Math.round((d.total / caGlobal) * 100) : 0;
    const barW  = Math.round(((W-M*2-450) - 8) * (d.total / caMax));
    const isEven = i % 2 === 0;
    if (isEven) doc.rect(M, y, W-M*2, 18).fill('#f7f8fa');

    let x = M;
    doc.fillColor('#111827').font('Helvetica').fontSize(8);
    doc.text(d.mois,                       x+4,  y+5, { width: 86 });           x += 90;
    doc.text(String(d.nb),                 x+4,  y+5, { width: 86, align:'center' }); x += 90;
    doc.text(fmt(d.total),                 x+4,  y+5, { width: 176, align:'right' }); x += 180;
    doc.text(`${pct}%`,                    x+4,  y+5, { width: 86, align:'right' }); x += 90;

    // Barre
    if (barW > 0) {
      doc.rect(x+4, y+5, barW, 8).fill(BLEU);
    }
    y += 18;
  });

  // Total
  doc.rect(M, y, W-M*2, 20).fill('#e8eef7');
  doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(8)
     .text('TOTAL', M+4, y+6, { width: 86 });
  doc.text(fmt(caGlobal), M+360, y+6, { width: 176, align: 'right' });
  y += 30;

  // ── SECTION 3 : Pipeline ──────────────────────────────────────────────────
  y = sectionTitle('3. ÉTAT DU PIPELINE COMMERCIAL', y);

  const etapeLabels = {
    nouveau: 'Nouveau', qualification: 'Qualification',
    proposition: 'Proposition', negociation: 'Négociation',
    gagne: 'Gagné', perdu: 'Perdu'
  };
  const etapeCouleurs = {
    nouveau: '#6b7280', qualification: '#f59e0b',
    proposition: '#3b82f6', negociation: '#7c3aed',
    gagne: '#16a34a', perdu: '#dc2626'
  };

  const colsPipeline = [
    { key: 'etape',   label: 'Étape',         width: 130 },
    { key: 'count',   label: 'Nb opps',        width: 80, align: 'center' },
    { key: 'montant', label: 'Montant total (XOF)', width: 180, align: 'right' },
    { key: 'pct',     label: '% nb',           width: 80, align: 'center' },
    { key: 'barre',   label: 'Visualisation',  width: W-M*2-470 },
  ];
  y = tableHeader(colsPipeline, y);

  const totalOppsAll = pipeline.reduce((s, d) => s + d.count, 0);
  const maxCount     = Math.max(...pipeline.map(d => d.count), 1);

  pipeline.forEach((d, i) => {
    const pct  = totalOppsAll > 0 ? Math.round((d.count / totalOppsAll) * 100) : 0;
    const barW = Math.round(((W-M*2-470) - 8) * (d.count / maxCount));
    const clr  = etapeCouleurs[d.etape] || BLEU;
    const isEven = i % 2 === 0;
    if (isEven) doc.rect(M, y, W-M*2, 18).fill('#f7f8fa');

    let x = M;
    // Point coloré + label étape
    doc.circle(x+10, y+9, 4).fill(clr);
    doc.fillColor('#111827').font('Helvetica').fontSize(8)
       .text(etapeLabels[d.etape] || d.etape, x+20, y+5, { width: 106 });
    x += 130;
    doc.text(String(d.count),  x+4, y+5, { width: 76, align:'center' }); x += 80;
    doc.text(fmt(d.montant),   x+4, y+5, { width: 176, align:'right' }); x += 180;
    doc.text(`${pct}%`,        x+4, y+5, { width: 76, align:'center' }); x += 80;
    if (barW > 0) doc.rect(x+4, y+5, barW, 8).fill(clr);
    y += 18;
  });
  y += 10;

  // ════════════════════════════════════════════════════════════════════
  // PAGE 2
  // ════════════════════════════════════════════════════════════════════
  doc.addPage({ margin: 0 });
  y = M;

  // Mini header page 2
  doc.rect(0, 0, W, 36).fill(BLEU);
  doc.fillColor(BLANC).font('Helvetica-Bold').fontSize(11)
     .text('SUDICONE — Rapport Analytique', M, 12);
  doc.fillColor('rgba(255,255,255,0.6)').font('Helvetica').fontSize(9)
     .text(moisAn, W - 130, 14);
  y = 52;

  // ── SECTION 4 : Performances commerciaux ─────────────────────────────────
  y = sectionTitle('4. PERFORMANCES COMMERCIALES', y);

  const colsComm = [
    { key: 'nom',      label: 'Commercial',       width: 140 },
    { key: 'nb_opps',  label: 'Opportunités',      width: 90,  align: 'center' },
    { key: 'nb_gagnes',label: 'Gagnées',           width: 80,  align: 'center' },
    { key: 'taux',     label: 'Taux réussite',     width: 90,  align: 'center' },
    { key: 'ca_gagne', label: 'CA gagné (XOF)',    width: 155, align: 'right' },
  ];
  y = tableHeader(colsComm, y);

  commerciaux.forEach((c, i) => {
    const taux = c.nb_opps > 0 ? Math.round((c.nb_gagnes / c.nb_opps) * 100) : 0;
    const tauxColor = taux >= 50 ? VERT : taux >= 25 ? OR : ROUGE;
    const isEven = i % 2 === 0;
    if (isEven) doc.rect(M, y, W-M*2, 18).fill('#f7f8fa');

    let x = M;
    // Rang
    doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(7.5)
       .text(`#${i+1}`, x+4, y+5, { width: 20 });
    doc.fillColor('#111827').font('Helvetica').fontSize(8)
       .text(c.nom, x+22, y+5, { width: 114 });
    x += 140;
    doc.text(String(c.nb_opps),   x+4, y+5, { width: 86, align:'center' }); x += 90;
    doc.text(String(c.nb_gagnes), x+4, y+5, { width: 76, align:'center' }); x += 80;

    // Badge taux
    doc.rect(x+20, y+3, 50, 12).fill(tauxColor + '20');
    doc.fillColor(tauxColor).font('Helvetica-Bold').fontSize(8)
       .text(`${taux}%`, x+20, y+5, { width: 50, align:'center' });
    x += 90;

    doc.fillColor('#111827').font('Helvetica').fontSize(8)
       .text(fmt(c.ca_gagne), x+4, y+5, { width: 151, align:'right' });
    y += 18;
  });
  y += 14;

  // ── SECTION 5 : Top opportunités ─────────────────────────────────────────
  y = sectionTitle('5. TOP 5 OPPORTUNITÉS PRIORITAIRES', y);

  topOpps.forEach((o, i) => {
    // Calcul score simplifié
    const ptEtape = { nouveau:10, qualification:25, proposition:45, negociation:65, gagne:100, perdu:0 };
    const jours   = o.created_at
      ? Math.floor((new Date() - new Date(o.created_at)) / (1000*60*60*24)) : 0;
    let score = (ptEtape[o.etape] || 0) + Math.round((o.probabilite||0)/10);
    if (jours > 60) score -= 20;
    else if (jours > 30) score -= 10;
    if ((o.montant||0) >= 500000) score += 10;
    score = Math.max(0, Math.min(100, score));
    const sColor = score >= 70 ? VERT : score >= 40 ? OR : ROUGE;
    const emoji  = score >= 70 ? '🔥' : score >= 40 ? '⚡' : '❄️';

    doc.rect(M, y, W-M*2, 44).fill(i%2===0 ? '#f7f8fa' : BLANC)
       .stroke('#e5e7eb');
    doc.rect(M, y, 3, 44).fill(sColor);

    // Score cercle
    doc.circle(M+22, y+22, 16).fill(sColor+'20').stroke(sColor);
    doc.fillColor(sColor).font('Helvetica-Bold').fontSize(9)
       .text(String(score), M+10, y+17, { width: 24, align:'center' });

    // Contenu
    doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(9)
       .text(o.titre, M+44, y+6, { width: W-M*2-160 });
    doc.fillColor(GRIS).font('Helvetica').fontSize(7.5)
       .text(`Contact : ${o.contact_nom || '—'}  ·  Étape : ${etapeLabels[o.etape] || o.etape}  ·  Probabilité : ${o.probabilite||0}%  ·  Clôture : ${fmtDate(o.date_cloture_prevue)}`, M+44, y+20, { width: W-M*2-160 });

    // Montant
    doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(10)
       .text(fmt(o.montant), W-M-120, y+14, { width: 110, align:'right' });
    doc.fillColor(GRIS).font('Helvetica').fontSize(7.5)
       .text(emoji + ' Priorité ' + (score>=70?'haute':score>=40?'moyenne':'faible'), W-M-120, y+28, { width: 110, align:'right' });

    y += 48;
  });
  y += 8;

  // ── SECTION 6 : Alertes ───────────────────────────────────────────────────
  y = sectionTitle('6. ALERTES — FACTURES EN RETARD', y);

  if (alertes.length === 0) {
    doc.rect(M, y, W-M*2, 30).fill('#dcfce7');
    doc.fillColor(VERT).font('Helvetica-Bold').fontSize(9)
       .text('✓ Aucune facture en retard — situation saine !', M+12, y+10);
    y += 40;
  } else {
    const colsAlertes = [
      { key: 'numero',        label: 'N° Facture',     width: 120 },
      { key: 'date_echeance', label: 'Échéance',       width: 100 },
      { key: 'jours',         label: 'Jours retard',   width: 90, align: 'center' },
      { key: 'montant_ttc',   label: 'Montant TTC',    width: 155, align: 'right' },
    ];
    y = tableHeader(colsAlertes, y, ROUGE);

    alertes.forEach((f, i) => {
      const jours = Math.floor(
        (new Date() - new Date(f.date_echeance)) / (1000*60*60*24)
      );
      if (i%2===0) doc.rect(M, y, W-M*2, 18).fill('#fff5f5');
      let x = M;
      doc.fillColor(ROUGE).font('Helvetica-Bold').fontSize(8)
         .text(f.numero, x+4, y+5, { width: 116 }); x += 120;
      doc.fillColor('#111827').font('Helvetica').fontSize(8)
         .text(fmtDate(f.date_echeance), x+4, y+5, { width: 96 }); x += 100;
      doc.fillColor(ROUGE).font('Helvetica-Bold').fontSize(8)
         .text(`${jours} jours`, x+4, y+5, { width: 86, align:'center' }); x += 90;
      doc.fillColor('#111827').font('Helvetica').fontSize(8)
         .text(fmt(f.montant_ttc), x+4, y+5, { width: 151, align:'right' });
      y += 18;
    });

    // Total impayés
    doc.rect(M, y, W-M*2, 20).fill('#fee2e2');
    doc.fillColor(ROUGE).font('Helvetica-Bold').fontSize(8)
       .text('TOTAL IMPAYÉS', M+4, y+6, { width: 300 });
    doc.text(fmt(stats.montantRetard), M+310, y+6, { width: 155+90+100+120-310-8, align:'right' });
    y += 30;
  }

  // ── SECTION 7 : Prévisions ────────────────────────────────────────────────
  y = sectionTitle('7. PRÉVISIONS & RECOMMANDATIONS', y);

  doc.rect(M, y, W-M*2, 80).fill('#f0f4f8');
  doc.rect(M, y, 3, 80).fill(BLEU);

  doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(10)
     .text('CA prévisionnel (mois prochain)', M+12, y+10);
  doc.fillColor(BLEU).font('Helvetica-Bold').fontSize(18)
     .text(fmt(predictedCA), M+12, y+24);
  doc.fillColor(GRIS).font('Helvetica').fontSize(8)
     .text(`Calculé par régression linéaire sur ${series.length} mois de données`, M+12, y+50);

  const tendance = series.length >= 2
    ? series[series.length-1] > series[series.length-2] ? '↑ Croissante' : '↓ Décroissante'
    : 'Données insuffisantes';
  const tendColor = tendance.includes('↑') ? VERT : ROUGE;

  doc.fillColor(GRIS).font('Helvetica').fontSize(8)
     .text('Tendance :', M+12, y+62);
  doc.fillColor(tendColor).font('Helvetica-Bold').fontSize(8)
     .text(tendance, M+70, y+62);

  // Recommandations
  const recoms = [];
  if (stats.facturesEnRetard > 0)
    recoms.push(`⚠️ ${stats.facturesEnRetard} facture(s) en retard à relancer — montant total : ${fmt(stats.montantRetard)}`);
  if (tauxConversion < 30)
    recoms.push(`📊 Taux de conversion faible (${tauxConversion}%) — renforcer la qualification des leads`);
  if (stats.oppEnCours > 20)
    recoms.push(`🎯 ${stats.oppEnCours} opportunités actives — prioriser les plus scorées`);
  recoms.push(`💡 CA prévisionnel : ${fmt(predictedCA)} — tendance ${tendance}`);

  y += 90;

  if (recoms.length > 0) {
    recoms.forEach(r => {
      doc.rect(M, y, W-M*2, 20).fill(BLANC).stroke('#e5e7eb');
      doc.fillColor('#111827').font('Helvetica').fontSize(8.5)
         .text(r, M+10, y+6, { width: W-M*2-20 });
      y += 22;
    });
  }

  // ── PIED DE PAGE ──────────────────────────────────────────────────────────
  y = doc.page.height - 40;
  doc.moveTo(M, y).lineTo(W-M, y).stroke('#e5e7eb');
  doc.fillColor(GRIS).font('Helvetica').fontSize(7.5)
     .text(
       `SUDICONE — Rapport généré automatiquement le ${dateGen} · sudicone@gmail.com · 20 20 20 20`,
       M, y + 8, { width: W-M*2, align: 'center' }
     );

  doc.end();
});

module.exports = router;