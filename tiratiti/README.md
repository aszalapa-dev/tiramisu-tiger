# Tiratiti — site avec pot 3D

Page Tiratiti reconstruite à partir de l'observation directe de la page d'accueil Hungry Tiger. Elle en reprend les grandes compositions, le parcours de rotation et la présentation des sections. La direction artistique utilise désormais les couleurs des étiquettes Tiratiti fournies en PDF.

## Ouvrir

Ouvrir ce dossier dans VS Code. Depuis le terminal : `npm.cmd run dev` (ou `node server.cjs`), puis ouvrir http://127.0.0.1:4173.

Pour Vercel, suivre **[DEPLOIEMENT.md](DEPLOIEMENT.md)**. La configuration est incluse : `npm run build` prépare les fichiers publics dans `dist`. Le code source et les images se modifient dans ce dossier, pas dans `dist`.

## Présentation et mouvement

- Palette Tiratiti : chocolat `#2b1611`, rouge profond `#86221c`, blanc cassé `#f0efee` et bleu pervenche `#7ea0e3`. Voir `DIRECTION-ARTISTIQUE.md` pour les usages et les photos harmonisées.
- Navigation en pastilles, titres très larges, lignes de losanges, texture de grain et décor de cafés et de boudoirs.
- Parcours de 800svh sur ordinateur et 650svh sur mobile, suivant le rythme de la référence. Le pot entre depuis le bas puis pivote au centre. Un tour complet montre le couvercle, le dos et le dessous ; il termine debout avec le couvercle légèrement soulevé.
- Une seule progression lissée synchronise la rotation, le défilement des titres et leur apparition lettre par lettre. Les positions de la page sont mises en cache ; la 3D cesse de se redessiner lorsqu'elle est immobile ou hors écran.
- Éclairage de studio, reflets sur le contenant et le métal, environnement lumineux précalculé.
- Sections en deux colonnes, photos d'atelier décalées avec rotation légère, présentation du contenant en trois colonnes, photo produit pleine largeur, parfums et newsletter blanc cassé/bleu.
- Adaptation mobile, commande de pause, respect de la préférence de réduction des animations et photo de repli si la 3D ne charge pas.

## Interactions

- Menu mobile et navigation vers les sections.
- Fiches des deux parfums avec vue 3D manipulable à la souris, au toucher et au clavier.
- Panier local : ajout, quantité, retrait et conservation sur ce navigateur.
- Mini-jeu de 20 secondes : cafés et boudoirs à attraper, pause, reprise et record local.

Le paiement et l'inscription à la newsletter sont désactivés et indiqués comme bientôt disponibles. Aucun service externe de commande ou de collecte d'adresses n'est configuré. Les pages secondaires de Hungry Tiger ne sont pas copiées : la navigation mène aux sections Tiratiti. Les textes restent des propositions à personnaliser.

## Fichiers actifs

- `index.html` : structure et contenus.
- `redesign.css` : présentation, palette et adaptation mobile.
- `interface.js` : défilement, apparitions et fiches des parfums.
- `scene.js` : rendu, lumière et poses des modèles 3D.
- `site-interactions.js` et `.css` : panier, menu et mini-jeu.
- `assets/` : modèles, photos et décors locaux.

Les versions précédentes du code sont conservées dans `version-1/` et `version-2/`. Les anciennes feuilles `style.css`, `experience.css`, `refinements.css` et `palette.css` ne sont plus chargées. Les fichiers de référence sous `sources/` restent inchangés.

Three.js r160 et les polices sont chargés en ligne. Une connexion est donc nécessaire au premier chargement.

Les modèles d'origine restent utilisés : environ 54,5 Mo pour le Classique et 12,2 Mo pour le Spéculoos. Leur simplification est à prévoir avant une publication publique, notamment pour les téléphones peu puissants. Voir `VERIFICATION.md` pour les contrôles et les limites.

