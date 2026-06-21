# Lancer le CRM sur Windows — Guide simple

## Étape 1 — Installer Node.js (une seule fois)

1. Va sur **https://nodejs.org**
2. Télécharge la version **LTS** (le gros bouton vert, recommandé pour la plupart des utilisateurs)
3. Lance l'installeur, clique "Suivant" partout (les options par défaut suffisent)
4. Redémarre ton PC une fois l'installation terminée (recommandé, pas toujours obligatoire)

Pour vérifier que c'est bien installé : ouvre l'invite de commande (touche Windows, tape `cmd`, Entrée) et tape :
```
node -v
```
Si ça affiche un numéro de version (ex: `v22.x.x`), c'est bon.

## Étape 2 — Lancer le CRM

1. Dézippe le dossier `crm` quelque part sur ton PC (ex: `C:\CRM\`)
2. Double-clique sur **`lancer-crm.bat`**
3. Une fenêtre noire s'ouvre — laisse-la tourner, c'est le serveur
4. La première fois : ça installe les dépendances (1-2 min), crée la base de données, et affiche les identifiants admin par défaut — **note-les**
5. Ton navigateur s'ouvre automatiquement sur la page de connexion

## Pour les fois suivantes

Double-clique juste sur `lancer-crm.bat` — tout est déjà installé, ça démarre en quelques secondes.

## Pour arrêter le CRM

Ferme simplement la fenêtre noire (ou `Ctrl+C` dedans).

## Si ça bloque à l'installation des dépendances

`better-sqlite3` (le module de base de données) a parfois besoin d'outils de compilation sur Windows. Si `npm install` échoue avec une erreur mentionnant `node-gyp` ou `python`, fais ceci dans l'invite de commande, dans le dossier du projet :

```
npm install --global windows-build-tools
```
*(ancienne méthode)* ou plus simplement, assure-toi d'avoir une connexion internet stable au premier lancement — `better-sqlite3` télécharge normalement un binaire déjà compilé pour Windows et n'a pas besoin de compiler quoi que ce soit dans l'immense majorité des cas avec les versions récentes de Node.

## Important — usage local vs réseau

Par défaut, lancé comme ça, le CRM n'est accessible **que depuis ton propre PC** (`localhost:4000`). C'est parfait pour tester ou pour un usage perso. Pour que d'autres personnes y accèdent depuis leurs PC, il faut soit :
- le déployer sur ton VPS (comme prévu initialement), soit
- configurer ton PC en serveur sur le réseau local (plus contraignant, pas recommandé pour du multi-utilisateur sérieux)

Pour BF1, KASSCO ou tout client avec plusieurs commerciaux, le VPS reste la bonne option à terme.
