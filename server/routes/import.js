// server/routes/import.js
// Import CSV/Excel de contacts et opportunités

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../db/connection');
const { logActivite } = require('../utils/activite');

const router = express.Router();

// ── Configuration multer ──────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/imports');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `import-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.csv', '.xlsx', '.xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez CSV ou Excel.'));
    }
  }
});

// ── Parser CSV simple ─────────────────────────────────────────────────────────
function parseCSV(contenu) {
  const lignes = contenu
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lignes.length < 2) return [];

  // Détecter le séparateur (virgule ou point-virgule)
  const separateur = lignes[0].includes(';') ? ';' : ',';

  const headers = lignes[0]
    .split(separateur)
    .map(h => h.trim().toLowerCase()
      .replace(/[éèê]/g, 'e')
      .replace(/[àâ]/g, 'a')
      .replace(/\s+/g, '_')
    );

  return lignes.slice(1).map(ligne => {
    const valeurs = ligne.split(separateur).map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = valeurs[i] || ''; });
    return obj;
  });
}

// ── Mapper une ligne CSV vers un contact ──────────────────────────────────────
function mapperContact(ligne) {
  // Accepte différents noms de colonnes
  const nom         = ligne.nom || ligne.name || ligne.prenom_nom || ligne['nom complet'] || '';
  const entreprise  = ligne.entreprise || ligne.company || ligne.societe || '';
  const email       = ligne.email || ligne.mail || ligne.courriel || '';
  const telephone   = ligne.telephone || ligne.tel || ligne.phone || ligne.mobile || '';
  const ville       = ligne.ville || ligne.city || ligne.localite || '';
  const pays        = ligne.pays || ligne.country || 'Burkina Faso';
  const type        = ['prospect', 'client', 'partenaire'].includes(ligne.type?.toLowerCase())
                      ? ligne.type.toLowerCase() : 'prospect';
  const secteur     = ligne.secteur || ligne.sector || ligne.activite || '';
  const notes       = ligne.notes || ligne.note || ligne.commentaire || '';
  const site_web    = ligne.site_web || ligne.site || ligne.website || '';
  const adresse     = ligne.adresse || ligne.address || '';

  return { nom, entreprise, email, telephone, ville, pays, type, secteur, notes, site_web, adresse };
}

// ── POST /api/import/contacts ─────────────────────────────────────────────────
router.post('/contacts', upload.single('fichier'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier requis.' });

  try {
    const ext     = path.extname(req.file.originalname).toLowerCase();
    let lignes    = [];

    if (ext === '.csv') {
      const contenu = fs.readFileSync(req.file.path, 'utf8');
      lignes = parseCSV(contenu);
    } else {
      // Excel
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();

      // Synchrone via readFileSync n'existe pas dans ExcelJS — on retourne une erreur
      return res.status(400).json({
        error: 'Pour Excel, utilisez le format CSV. Sauvegardez votre fichier Excel en CSV (UTF-8).'
      });
    }

    if (!lignes.length) {
      return res.status(400).json({ error: 'Fichier vide ou format invalide.' });
    }

    // Résultats
    const resultats = { crees: 0, ignores: 0, erreurs: [] };
    const userId    = req.session.userId;

    const insertContact = db.prepare(`
      INSERT INTO contacts (type, nom, entreprise, email, telephone, adresse,
        ville, pays, secteur, site_web, statut_client, notes, owner_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'actif', ?, ?)
    `);

    for (const ligne of lignes) {
      const contact = mapperContact(ligne);

      if (!contact.nom) {
        resultats.ignores++;
        continue;
      }

      // Vérifier doublon par email
      if (contact.email) {
        const existing = db.prepare(
          'SELECT id FROM contacts WHERE email = ?'
        ).get(contact.email);
        if (existing) {
          resultats.ignores++;
          resultats.erreurs.push(`${contact.nom} — email déjà existant (${contact.email})`);
          continue;
        }
      }

      try {
        const result = insertContact.run(
          contact.type, contact.nom, contact.entreprise || null,
          contact.email || null, contact.telephone || null,
          contact.adresse || null, contact.ville || null,
          contact.pays || 'Burkina Faso', contact.secteur || null,
          contact.site_web || null, contact.notes || null, userId
        );

        logActivite(
          'contact_importe',
          `Contact importé via CSV : "${contact.nom}"`,
          result.lastInsertRowid, userId
        );

        resultats.crees++;
      } catch (err) {
        resultats.ignores++;
        resultats.erreurs.push(`${contact.nom} — ${err.message}`);
      }
    }

    // Supprimer le fichier temporaire
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `Import terminé : ${resultats.crees} contact(s) créé(s), ${resultats.ignores} ignoré(s).`,
      ...resultats
    });

  } catch (err) {
    console.error('Erreur import:', err);
    res.status(500).json({ error: 'Erreur lors de l\'import : ' + err.message });
  }
});

// ── GET /api/import/template ──────────────────────────────────────────────────
// Télécharger un fichier CSV modèle
router.get('/template', (req, res) => {
  const template = [
    'nom,entreprise,email,telephone,ville,pays,type,secteur,notes',
    'Amadou Traoré,BizConnect,amadou@biz.bf,+226 70 00 00 00,Ouagadougou,Burkina Faso,prospect,Digital,Premier contact salon',
    'Fatoumata Diallo,AfriVision,fato@afri.bf,+226 71 00 00 00,Bobo-Dioulasso,Burkina Faso,client,Communication,',
    'Ibrahim Sawadogo,,ibrahim@gmail.com,+226 72 00 00 00,Ouagadougou,Burkina Faso,prospect,Événementiel,'
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=modele-import-contacts.csv');
  res.send('\uFEFF' + template); // BOM UTF-8 pour Excel
});

module.exports = router;