# Tiratiti

Site de présentation du tiramisu artisanal Tiratiti : histoire, trois goûts, carte des commerces et page professionnelle.

## Animation Blender — 27 octobre 2026

La canette affiche des rendus transparents calculés dans Blender avec les matériaux, la caméra et les éclairages d’origine. Le navigateur affiche ces images dans un canevas 2D ; aucun modèle GLB, Three.js ou décodeur Draco n’est chargé par la version active.

- Une rotation complète échantillonnée tous les 2° parcourt un seul tour avant l’ouverture.
- L’ouverture utilise 95 poses et reste réversible au défilement.
- La languette et tout le couvercle sont orientés à 180° par rapport à la scène Blender d’origine ; le corps et les étiquettes conservent leur orientation.
- Les 275 images WebP conservent leur transparence en 800 × 950 pixels.
- La photo du produit apparaît immédiatement. L’animation démarre automatiquement, sans attendre toutes les images.
- Le lecteur prépare les images à venir et ignore les décodages périmés qui feraient reculer la pose. Les dessins sont regroupés sur les images du navigateur.
- Le cache conserve au maximum 32 images compressées, avec six images décodées sur téléphone et vingt sur ordinateur. La densité de dessin est limitée à 1,5×. Les dessins et le travail en attente sont suspendus hors écran et dans un onglet masqué.
- La fiche du Classique réutilise cette rotation, à la souris, au toucher ou au clavier. Les autres goûts utilisent leurs photos.

Le rendu Blender reste net : aucune transition floue entre deux poses n’est utilisée. Les anciens fichiers 3D restent dans le dépôt comme références mais sont exclus de `public-files.json` et du dossier publié.

## Commandes

Node.js suffit ; aucune dépendance à installer.

```sh
npm run dev      # aperçu source : http://127.0.0.1:4173
npm test         # contrôles de chargement, chronologie et régressions
npm run build    # construit dist depuis le manifeste public
npm run preview  # aperçu de dist : http://127.0.0.1:4174
```

Sous PowerShell, `npm.cmd` peut être utilisé à la place de `npm`.

## Fichiers actifs

- `index.html`, `redesign.css`, `loading.css` : page principale et adaptation mobile.
- `interface.js`, `smooth-scroll.js`, `heading-scroll.js` : défilement et textes.
- `loading.js` : démarrage automatique, secours photo et fiches produit.
- `rendered-sequence.js` : chargement, caches, dessin et cycle de vie.
- `sequence-timeline.js` : nombre de tours défini par le manifeste, ouverture et compensation de taille.
- `assets/rendered-one-turn/` : images et manifeste versionné par empreinte du contenu.
- `home-map.css`, `store-map.js` : carte et liste des commerces ; la carte attend l’approche de sa section.
- `revendeurs.html`, `revendeurs.css`, `revendeurs.js` : page professionnelle, avec navigation et pied de page communs.
- `tests/` : tests automatisés, exclus du site publié.
- `public-files.json`, `build.cjs` : liste explicite des fichiers publiés et préparation de `dist`.

Les polices du premier écran et les visuels sont locaux. Les polices complémentaires viennent de Google Fonts ; la carte utilise Mapbox lorsqu’un jeton public est configuré. Les commerces affichés sont des exemples fictifs. Les contacts ouvrent la messagerie du visiteur ; aucun service de paiement ou d’envoi d’e-mails n’est configuré.

La version actuelle construit 316 fichiers publics, environ 18,32 Mo au total. Ce total comprend toutes les poses ; elles ne sont pas toutes nécessaires à l’arrivée. Le poids exact est affiché à chaque construction.

Voir [DEPLOIEMENT.md](DEPLOIEMENT.md) pour les paramètres Vercel. Modifier les sources et reconstruire ; ne pas modifier `dist` directement.
