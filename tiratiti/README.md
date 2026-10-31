# Tiratiti

Site de présentation du tiramisu artisanal Tiratiti : histoire, trois goûts, carte des commerces et page professionnelle.

## Animation Blender — 31 octobre 2026

La canette utilise les matériaux, la caméra et les éclairages Blender d’origine. L’accueil privilégie un flux H.264 indexé : WebCodecs décode au maximum deux poses par déplacement sur téléphone, six sur ordinateur, puis un shader WebGL restitue la transparence à partir du masque placé à côté des couleurs prémultipliées. Aucun modèle GLB, Three.js ou décodeur Draco n’est chargé.

- Les 275 poses gardent un seul tour, l’ouverture réversible et le départ vertical du couvercle. La languette conserve son orientation à 180°.
- Deux profils vidéo sont disponibles : 5,62 Mo sur téléphone et 7,36 Mo sur ordinateur. L’appareil ne charge que son profil. Le cadrage logique est de 512 × 608 ou 800 × 950 ; une marge haute transparente porte le rendu à 512 × 1216 ou 800 × 1900 afin que le couvercle reste entier pendant sa montée. Le profil mobile conserve les 275 poses et réduit de 36 % les pixels à décoder par image. Le canevas couvre l’écran et reprend la taille et la position du visuel de référence.
- Le cadrage compact dépend de la hauteur du cadre produit, calculée depuis la scène en svh. Le masquage de la barre Safari ne peut donc plus supprimer sa réduction et faire grossir la canette. Les petits écrans et les changements d’orientation gardent leur adaptation.
- La photo apparaît immédiatement et la lecture démarre automatiquement dès les premiers paquets disponibles. Le téléchargement continue en arrière-plan ; une plage prioritaire peut charger le groupe visé par un geste rapide.
- Un tampon de 60 ms interpole les positions horodatées du défilement natif, sans prédire ni dépasser le geste. Son retard est plafonné à 0,025 de la progression ; les grands sauts ne créent pas plusieurs secondes de rattrapage. Il s’arrête exactement à la pose demandée, puis ne consomme aucun RAF au repos.
- Le lecteur vidéo garde un seul tampon compressé et au maximum deux images de présentation. Les sorties intermédiaires des groupes sont fermées sans dessin. Les dessins et téléchargements sont suspendus hors écran et dans les onglets masqués.
- Si le codec ou le rendu GPU ne fonctionne pas, le site remplace automatiquement le canevas et utilise le lecteur WebP existant. La photo reste visible pendant ce remplacement, sans bouton d’activation.
- Le repli WebP garde 32 images compressées et six images décodées sur téléphone, vingt sur ordinateur. La fiche du Classique réutilise ce lecteur au toucher, à la souris et au clavier.
- La densité de dessin reste limitée à 1,5×. La chronologie repose sur la hauteur stable de la scène afin que la barre Safari ne recale pas l’animation.
- Les titres hors écran ne sont pas mesurés à chaque geste ; la carte attend 180 ms sans défilement près de sa section sur mobile.

Les poses ne sont pas mélangées : aucun fondu entre deux angles ne brouille l’étiquette. Le masque vidéo est légèrement compressé ; les photos et les WebP d’origine restent disponibles en repli. Les sources 3D sont exclues du dossier publié.

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
- `sequence-playback.js`, `native-video-sequence.js`, `scroll-playhead.js` : sélection du lecteur, décodage vidéo/GPU et suivi visuel.
- `rendered-sequence.js` : lecteur WebP de compatibilité et fiches produit.
- `sequence-timeline.js` : nombre de tours défini par le manifeste, ouverture et compensation de taille.
- `assets/rendered-video-mobile/`, `assets/rendered-video-desktop/` : flux vidéo et index versionnés.
- `assets/rendered-one-turn/` : images et manifeste du repli ordinateur.
- `assets/rendered-one-turn-mobile/` : mêmes poses et matériaux, adaptées au téléphone.
- `home-map.css`, `store-map.js` : carte et liste des commerces ; la carte attend l’approche de sa section.
- `revendeurs.html`, `revendeurs.css`, `revendeurs.js` : page professionnelle, avec navigation et pied de page communs.
- `tests/` : tests automatisés, exclus du site publié.
- `public-files.json`, `build.cjs` : liste explicite des fichiers publiés et préparation de `dist`.

Les polices du premier écran et les visuels sont locaux. Les polices complémentaires viennent de Google Fonts ; la carte utilise Mapbox lorsqu’un jeton public est configuré. Les commerces affichés sont des exemples fictifs. Les contacts ouvrent la messagerie du visiteur ; aucun service de paiement ou d’envoi d’e-mails n’est configuré.

Le dossier publié comprend les deux profils d’images ; chaque appareil en utilise un seul. Toutes les poses ne sont pas nécessaires à l’arrivée. Le poids exact du dossier est affiché à chaque construction.

Voir [DEPLOIEMENT.md](DEPLOIEMENT.md) pour les paramètres Vercel. Modifier les sources et reconstruire ; ne pas modifier `dist` directement.
