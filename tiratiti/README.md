# Tiratiti

Site de présentation du tiramisu artisanal Tiratiti : histoire, trois goûts, carte des commerces et page professionnelle.

## Animation Blender — 31 octobre 2026

La canette utilise les matériaux, la caméra et les éclairages Blender d’origine. L’accueil privilégie un flux H.264 indexé : WebCodecs décode au maximum six poses par groupe sur téléphone, quatre sur ordinateur, puis un shader WebGL restitue la transparence à partir du masque placé à côté des couleurs prémultipliées. Aucun modèle GLB, Three.js ou décodeur Draco n’est chargé.

- La vidéo comporte 1 100 poses : 720 angles pour un seul tour et 380 poses d’ouverture. Les positions intermédiaires sont rendues dans Blender ; elles réduisent les paliers visibles au défilement lent. L’ouverture reste réversible, avec le départ vertical du couvercle et la languette orientée à 180°.
- Deux profils vidéo sont disponibles : 13,05 Mo sur téléphone et 32,20 Mo sur ordinateur. L’appareil ne charge que son profil et la lecture commence avant son téléchargement complet. Le cadrage logique est de 512 × 608 ou 800 × 950 ; une marge haute transparente porte le rendu à 512 × 1216 ou 800 × 1900 afin que le couvercle reste entier pendant sa montée. Le canevas couvre l’écran et reprend la taille et la position du visuel de référence.
- Le cadrage compact dépend de la hauteur du cadre produit, calculée depuis la scène en svh. Le masquage de la barre Safari ne peut donc plus supprimer sa réduction et faire grossir la canette. Les petits écrans et les changements d’orientation gardent leur adaptation.
- La photo apparaît immédiatement et la lecture démarre automatiquement dès les premiers paquets disponibles. En avançant, une plage prioritaire prépare jusqu’à six groupes dans une fenêtre de 512 Kio, avant l’épuisement des groupes déjà reçus. Le téléchargement du début du fichier lui cède temporairement la bande passante, puis reprend automatiquement depuis le préfixe disponible. Un retour en arrière demande le groupe courant en premier ; une plage partiellement reçue reste utile tant qu’elle couvre la cible. Les images futures ne sont pas décodées à l’avance.
- La canette suit la position brute du défilement avec un mouvement amorti calculé à chaque rafraîchissement. Les gestes changent la cible sans déplacer directement l’image : la vitesse reste continue entre deux événements et la canette ralentit brièvement après le dernier geste, puis s’arrête à la pose demandée. La réponse s’adapte aux gestes rapides ; aucun RAF ne reste actif au repos. Les textes conservent leur propre timing. Le lecteur se suspend hors écran et en arrière-plan, puis se réaligne au retour, sans rattrapage invisible.
- Le lecteur vidéo garde un seul tampon compressé et au maximum deux images de présentation. Les sorties intermédiaires des groupes sont fermées sans dessin. Les dessins et téléchargements sont suspendus hors écran et dans les onglets masqués.
- Si le codec ou le rendu GPU ne fonctionne pas, le site remplace automatiquement le canevas et utilise le lecteur WebP existant. La photo reste visible pendant ce remplacement, sans bouton d’activation.
- Le repli WebP conserve les 275 poses précédentes, avec 32 images compressées et six images décodées sur téléphone, vingt sur ordinateur. La fiche du Classique réutilise ce lecteur au toucher, à la souris et au clavier.
- La densité de dessin reste limitée à 1,5×. La chronologie repose sur la hauteur stable de la scène afin que la barre Safari ne recale pas l’animation.
- Les titres hors écran ne sont pas mesurés à chaque geste ; la carte attend 180 ms sans défilement près de sa section sur mobile.

Les poses ne sont pas mélangées : aucun fondu entre deux angles ne brouille l’étiquette. Le masque vidéo est légèrement compressé ; les photos et les WebP d’origine restent disponibles en repli. Les sources 3D sont exclues du dossier publié.

## Rendu Blender à 120 images/s — 1er novembre 2026

Le [master MP4 à 120 images/s](assets/rendered-120fps/Tiratiti_Classique_120fps.mp4?v=c8ae0397fda10d48) est disponible séparément, avec ses [données de vérification](assets/rendered-120fps/render-info.json?v=c8ae0397fda10d48). Il contient 4 400 images natives : 2 880 pour la rotation et 1 520 pour l’ouverture, soit 36,667 secondes et 21,75 Mo. Le fond brun et le cadrage constant servent au visionnage ; la marge haute conserve le couvercle pendant son départ vertical. Le compositing restaure l’opacité du cacao pour garder son grain RGB Blender, avec une compression CRF18 ; le verre et le contour restent intacts.

L’accueil conserve son flux indexé de 1 100 poses. Les nouveaux candidats web de 4 400 poses améliorent certains défilements lents, mais la simulation à froid sur mobile à 20 Mbit/s montre une régression lors d’un geste rapide : 144 à 100 changements affichés, avec un intervalle P95 de 16,7 à 83,3 ms. Le master est donc archivé sans être ajouté au préchargement de la page. Ces mesures concernent le banc réseau, pas les FPS d’un iPhone physique.

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

## Essai du nouveau motion — 10 novembre 2026

L’accueil reprend les 240 images transparentes de l’aperçu fourni (version 14, source eab2ff6). La canette bascule, s’ouvre puis la cuillère prélève une bouchée. Le défilement, les titres, le décor et la transition vers les ingrédients restent ceux du site. Les images sont chargées à la demande, sans charger les anciens flux H.264 dans l’accueil. La vidéo HD du bouton Lire du visualiseur n’est pas nécessaire au défilement.

Le cadrage suit les limites de chaque pose et de l’image encore affichée pendant un chargement : le couvercle, la cuillère et leur ombre restent dans le cadre. Six images décodées maximum sur mobile, neuf sur ordinateur. La fiche produit conserve sa rotation à 360 degrés.

L’ancienne animation et ses ressources sont conservées. La branche Git backup/hero-before-motion-20261110 conserve le site complet juste avant cet essai ; annuler le commit de cet essai suffit à rétablir l’accueil précédent sans toucher aux autres changements antérieurs.
