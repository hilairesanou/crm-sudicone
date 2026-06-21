# CRM — SUDICONE

CRM interne en Node.js + Express + SQLite (better-sqlite3). Aucune dépendance à Django : ce moteur JS gère tout (auth, API, base de données).

## Fonctionnalités

- **Contacts** : prospects, clients, partenaires (CRUD + recherche/filtre)
- **Pipeline** : opportunités en vue Kanban avec drag & drop entre étapes
- **Factures / Devis** : génération avec lignes, calcul HT/TTC automatique, suivi de statut
- **Tâches** : suivi avec priorité, échéance, assignation
- **Dashboard** : stats chiffrées + courbes (CA mensuel, opportunités/mois) + camemberts (pipeline, contacts) via Chart.js
- **Multi-utilisateurs avec rôles** : `admin`, `manager`, `commercial`

## Structure du projet

```
crm/
├── server/
│   ├── app.js              # point d'entrée du moteur (Express)
│   ├── db/
│   │   ├── connection.js   # connexion SQLite
│   │   ├── schema.sql      # schéma complet des tables
│   │   └── init.js         # script d'initialisation (crée tables + admin)
│   ├── middleware/
│   │   └── auth.js         # protection des routes (session + rôles)
│   ├── routes/
│   │   ├── auth.js
│   │   ├── contacts.js
│   │   ├── opportunites.js
│   │   ├── factures.js
│   │   ├── taches.js
│   │   ├── stats.js
│   │   └── users.js
│   └── utils/
│       └── activite.js     # journal d'activité
├── public/                 # tout le frontend (HTML/CSS/JS, pas de framework)
│   ├── login.html
│   ├── css/style.css
│   ├── js/common.js         # client API + sidebar partagée
│   └── pages/
│       ├── dashboard.html
│       ├── contacts.html
│       ├── pipeline.html
│       ├── factures.html
│       ├── taches.html
│       └── utilisateurs.html
├── data/                   # fichier crm.db (généré, ignoré par git)
├── uploads/                 # pour pièces jointes futures
├── package.json
└── .env.example
```

## Installation (en local ou sur le VPS)

```bash
cd crm
npm install
cp .env.example .env
# éditer .env : changer SESSION_SECRET pour une vraie valeur aléatoire

npm run initdb
# Affiche les identifiants du compte admin créé par défaut :
# Email    : admin@sudicone.bf
# Mot de passe : ChangeMoi123!
# -> Connecte-toi puis crée tes vrais comptes, supprime ou modifie celui-ci.

npm start
# Le serveur écoute sur http://localhost:4000 (ou le PORT défini dans .env)
```

## Déploiement sur ton VPS (nginx + PM2, même logique que bf1tv/conosso/jif)

```bash
# Sur le VPS, après avoir copié le dossier crm/ (scp, git clone, etc.)
cd /chemin/vers/crm
npm install --production
cp .env.example .env
nano .env   # configurer SESSION_SECRET, PORT, COOKIE_SECURE=true si HTTPS

npm run initdb

# Démarrage avec PM2
pm2 start server/app.js --name crm-sudicone
pm2 save
```

### Config nginx type (reverse proxy)

```nginx
server {
    listen 80;
    server_name crm.tondomaine.bf;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ensuite `certbot --nginx -d crm.tondomaine.bf` comme pour JIF.

## Notes importantes

- **Base SQLite** : un seul fichier `data/crm.db`. Pense à le sauvegarder régulièrement (`cp data/crm.db backups/crm-$(date +%F).db` en cron).
- **Sécurité** : change impérativement `SESSION_SECRET` dans `.env` avant la mise en prod, et `COOKIE_SECURE=true` si le site est servi en HTTPS (ce qui sera le cas via Certbot).
- **Rôles** : `admin` gère tout y compris les utilisateurs, `manager` voit les utilisateurs en lecture/stats globales, `commercial` gère ses propres contacts/opportunités/tâches.
- **Extensibilité** : la structure REST (`/api/contacts`, `/api/opportunites`, etc.) est volontairement simple à étendre — ajouter une route = un fichier dans `server/routes/` + le déclarer dans `server/app.js`.
