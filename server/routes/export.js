const express = require('express');
const db = require('../db/connection');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const router = express.Router();

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

module.exports = router;
