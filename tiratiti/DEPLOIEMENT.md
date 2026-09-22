# Mettre Tiratiti en ligne avec Vercel

Le projet contient le code modifiable, les photos et les deux modèles 3D. La configuration Vercel est déjà fournie. Aucune clé ni variable d'environnement n'est nécessaire.

## Depuis VS Code

1. Ouvre ce dossier dans VS Code : celui qui contient `package.json` et `vercel.json`.
2. Installe [Node.js, version LTS](https://nodejs.org/) si `node` ou `npm` n'est pas reconnu dans ton terminal, puis ferme et rouvre VS Code.
3. Dans **Terminal → Nouveau terminal**, lance :

   ```powershell
   npm.cmd run build
   npx.cmd vercel@latest --prod
   ```

4. Accepte l'installation de l'outil Vercel si elle est proposée, connecte-toi à ton compte et sélectionne ton espace. Pour un nouveau site, crée un projet nommé `tiratiti` (ou le nom de ton choix) et garde `./` comme dossier du code.
5. Garde les réglages du fichier `vercel.json`. Vercel affiche l'adresse du site à la fin.

La deuxième commande publie le site. Pour publier tes prochaines modifications, relance `npx.cmd vercel@latest --prod` depuis ce même dossier. Ces commandes utilisent les exécutables Windows pour éviter les restrictions PowerShell sur les scripts `.ps1`.

Documentation : [déployer avec la commande Vercel](https://vercel.com/docs/cli/deploy).

## Réglages Vercel déjà inclus

| Réglage | Valeur |
| --- | --- |
| Framework Preset | Other |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Variables d'environnement | Aucune |

Ces paramètres sont définis dans `vercel.json`, selon la [configuration officielle Vercel](https://vercel.com/docs/project-configuration/vercel-json). Le petit serveur `server.cjs` sert uniquement à regarder le site sur ton ordinateur ; Vercel héberge directement les fichiers du dossier `dist`.

## Regarder et modifier le site

- `npm.cmd run dev` : ouvre le site sur http://127.0.0.1:4173.
- `npm.cmd run build` puis `npm.cmd run preview` : vérifie la version à publier sur http://127.0.0.1:4174.
- `index.html` : textes et sections ; `redesign.css` : couleurs et mise en page ; `scene.js` : mouvement et éclairage du pot.
- Les images et modèles restent dans `assets/`. Si tu ajoutes un nouveau fichier utilisé par le site, ajoute son chemin à `public-files.json`, puis reconstruis le site.

Le projet n'a pas de dépendances à installer pour ces commandes locales. Three.js et les polices sont chargés en ligne par le navigateur.

## Contenu de cette version

Le site public comprend 21 fichiers, soit environ 87,3 Mo avant compression. Les modèles 3D représentent la majeure partie de ce poids et peuvent demander du temps au premier chargement sur mobile. Le fichier `.vercelignore` exclut les anciennes versions et les doublons de l'envoi à Vercel ; `build.cjs` ne place que les fichiers nécessaires dans `dist`.

Le panier et le jeu fonctionnent dans le navigateur. Le paiement et l'inscription à la newsletter restent désactivés, comme dans la version locale.

L'archive fournie contient uniquement la version active et ses outils de déploiement. Les sauvegardes des anciennes versions restent dans le dossier de travail d'origine.
