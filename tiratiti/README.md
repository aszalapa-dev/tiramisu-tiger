# Tiratiti — site avec pot 3D

## Chargement mobile — 26 octobre 2026

La 3D démarre automatiquement dès l’arrivée de chaque visiteur, y compris en économie de données et sur une connexion lente. Le visuel produit WebP de 68 Ko reste affiché pendant son chargement, et la page reste utilisable. La préférence de réduction des animations conserve une vue 3D fixe. L’ouverture animée n’est téléchargée qu’en avançant dans la séquence ; les photos d’atelier et la carte se chargent à l’approche de leur section. Un bouton de nouvelle tentative apparaît uniquement en cas d’échec de la 3D.

Le Classique utilise deux exports : `assets/classique-mobile.glb` (6 956 940 octets, −72 % par rapport à l’export HD) jusqu’à 760 px, ou jusqu’à 1 024 px avec pointeur tactile ; `assets/classique.glb` (11 232 816 octets, −54 %) ailleurs. Une visite ne télécharge qu’une variante. Les étiquettes restent identiques et le cacao conserve ses UV dédiées. La crème est simplifiée avec une erreur géométrique maximale mesurée de 20,71 µm ; les textures sont adaptées au format d’affichage. L’export HD de référence est conservé dans `../tmp/performance-26/reference-hd.glb`.

Contrôles : règles de sélection, budget des modèles, réimport Blender, comparaison visuelle et page mobile avec téléchargement 3D bloqué. Scripts et preuves : `../tmp/performance-26/` et `../tmp/performance-loading-26/`. Aucun délai universel n’est garanti : le résultat dépend de la connexion et du téléphone. Ces changements sont locaux, sans déploiement.

## Netteté intérieure — 26 octobre 2026

Le Classique conserve les étiquettes d'impression du 22 octobre. Le dessus cacao est recuit depuis le matériau Blender original sur des UV dédiées : environ 1 999 texels utiles sur sa largeur dans la référence HD, contre 421 auparavant. Le mélange spéculaire crème/cacao est conservé via `KHR_materials_specular`. Cet export HD de référence pèse 24 483 956 octets ; les variantes publiques allégées sont décrites ci-dessus.

`clear-pet.js` conserve les reflets et l'IOR du PET fin tout en évitant le lissage supplémentaire du buffer de transmission de Three r160. La mire de régression est dans `qa-pet-detail-test.html` ; les contrôles visuels dans `qa-food-detail.html`. Ces pages et leurs fichiers de référence ne figurent pas dans le manifeste public. Scripts de préparation et preuves : `../tmp/food-detail-26/` ; état antérieur et mesures du PET : `../tmp/render-detail-26/`. Cette correction est locale, sans déploiement.

L’accueil reste accessible sans attendre la 3D. Une erreur conserve la photo et propose une nouvelle tentative. Le mobile dispose de zones tactiles élargies et d’un cadrage dédié au paysage.

La page `revendeurs.html` réunit la carte OpenStreetMap et le formulaire professionnel dans la direction artistique du site. Les adresses restent masquées jusqu’à confirmation. Le formulaire prépare un e-mail à relire et envoyer dans la messagerie du visiteur ; aucun service d’envoi serveur n’est configuré. Carte : [Leaflet](https://leafletjs.com/examples/quick-start/), tuiles et attribution selon la [politique OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/).

Site de présentation Tiratiti, avec une canette animée au défilement. La version du 25 septembre 2026 conserve les grandes compositions inspirées de Hungry Tiger et les adapte aux produits, à l'histoire de Timoty et aux couleurs des étiquettes Tiratiti.

## Ouvrir

Ouvrir ce dossier dans VS Code. Depuis le terminal : `npm.cmd run dev` (ou `node server.cjs`), puis ouvrir http://127.0.0.1:4173.

Pour Vercel, suivre **[DEPLOIEMENT.md](DEPLOIEMENT.md)**. La configuration est incluse : `npm run build` prépare les fichiers publics dans `dist`. Le code source et les images se modifient dans ce dossier, pas dans `dist`.

## Présentation et mouvement

- Palette Tiratiti : chocolat `#2b1611`, rouge profond `#86221c`, blanc cassé `#f0efee` et bleu pervenche `#7ea0e3`. Voir `DIRECTION-ARTISTIQUE.md` pour les usages et les photos harmonisées.
- Logo vectoriel original extrait du document de marque, sans étirement ni police de remplacement. Voir [PROVENANCE-ASSETS.md](PROVENANCE-ASSETS.md) pour les sources et les proportions.
- Navigation principale en trois entrées : L'histoire, Les goûts et Où nous trouver. Titres larges, texture de grain et décor de cafés et de boudoirs.
- Parcours de 650svh sur ordinateur et 550svh sur mobile. La canette reste centrée et fait deux tours sur son axe vertical comme une toupie, avec une oscillation maximale de 8°. Elle ralentit et revient droite, étiquette de face, à 82 % du parcours, avant l’ouverture. Le dessous reste masqué.
- L'ouverture occupe 16 % du parcours, de 82 % à 98 %. La fermeture est orientée dans le sens opposé pour inverser le côté de traction. La languette et l'opercule se plient simultanément, puis se détachent ensemble ; le rebord serti du contenant reste fixé. Le défilement en sens inverse referme le pot.
- Une seule progression lissée synchronise la rotation, le défilement des titres et leur apparition lettre par lettre. Les positions de la page sont mises en cache ; la 3D cesse de se redessiner lorsqu'elle est immobile ou hors écran.
- Éclairage de studio et rendu ACES, reflets sur le métal, environnement lumineux précalculé et matériau PET physique transparent avec transmission et réfraction.
- Histoire de Timoty illustrée par les photos d'atelier, ingrédients du Classique, mode d'emploi de la canette, photo produit pleine largeur et trois goûts : Le Classique, Le Spéculos et Le Spécial aux biscuits Pane di Stelle.
- Section Où nous trouver et liens de contact pour les revendeurs et les événements. L'adresse `contact@tiratiti.be` provient des étiquettes fournies ; aucune adresse de revendeur non confirmée n'est affichée.
- Adaptation mobile, commande de pause, respect de la préférence de réduction des animations et photo de repli si la 3D ne charge pas.

## Interactions

- Menu mobile et navigation vers les sections.
- Fiches du Classique et du Spéculos avec vue 3D manipulable à la souris, au toucher et au clavier.
- Fiche du Spécial avec la photo détourée récupérée dans l'ancien projet. Le même visuel est utilisé dans la carte et la sélection ; aucun modèle 3D n'est attribué à ce goût.
- Sélection locale des trois goûts : ajout, quantité, retrait et conservation sur ce navigateur.
- Liens `mailto:` vers le contact Tiratiti pour les disponibilités, les revendeurs et les événements.

Le paiement reste désactivé et aucun service externe de commande n'est configuré. Le mini-jeu et la newsletter ont été retirés. Les liens de contact ouvrent l'application de messagerie du visiteur : le site n'envoie ni ne collecte directement de messages.

## Fichiers actifs

- `index.html` : structure et contenus.
- `redesign.css` : présentation, palette et adaptation mobile.
- `interface.js` : défilement, apparitions et fiches des parfums.
- `loading.js` et `delivery-policy.js` : démarrage automatique, photo immédiate et choix de la variante mobile.
- `scene.js` : rendu, lumière et poses des modèles 3D.
- `blender-opening.js` : lecture réversible du clip Blender, synchronisée au scroll ; conservation des matériaux et du reste du modèle.
- `assets/classique.glb` et `assets/classique-mobile.glb` : variantes allégées du Classique, avec étiquettes d’impression et textures alimentaires corrigées. Les matériaux Blender sont convertis en textures embarquées. Le PET reste physique et conserve le correctif de netteté de `clear-pet.js`. Les originaux Blender restent inchangés.
- `assets/ouverture-classique.glb` : dessus articulé conservé, avec rebord fixe et opercule déformable. Le clip `Tiratiti_Ouverture` dure 3,2 secondes. Les douze pièces de fermeture du nouveau corps ont été comparées à l’ancien export : transformations, sommets et dimensions compatibles. Les animations du site restent inchangées.
- `assets/classique.png` : nouveau rendu transparent du fichier fourni pour le chargement et le secours sans WebGL. Export GLB réimporté et rendu dans Blender ; dimensions vérifiées : environ 65,22 × 65,22 × 92 mm. Scripts et rapports locaux dans `../tmp/cacao-plus/`. Vérification navigateur non effectuée le 11 octobre : l’outil d’aperçu ne démarrait pas.
- `site-interactions.js` et `.css` : sélection locale et menu mobile.
- `assets/logo-tiratiti.svg` et `assets/logo-tiratiti-ink.svg` : tracé original du logo, en crème et en chocolat.
- `assets/special.webp` : photo détourée du Spécial, conservée telle qu'elle était dans le projet précédent.
- `assets/` : modèles, photos et décors locaux.

Les versions précédentes du code sont conservées dans `version-1/`, `version-2/` et `version-3-colors/`. Les anciennes feuilles `style.css`, `experience.css`, `refinements.css` et `palette.css` ne sont plus chargées. Les fichiers de référence sous `sources/` restent inchangés.

Three.js r160 et les polices complémentaires sont chargés en ligne. La police Inter Tight Black du premier écran est locale et utilise `font-display:swap`.

Le Classique et son ouverture utilisent la compression Draco. La crème utilise une géométrie simplifiée, vérifiée contre la référence détaillée. Le modèle du Spéculos reste inchangé. Aucun modèle 3D du Spécial n'a été fourni. Voir `VERIFICATION.md` pour les contrôles et les limites historiques, et les rapports du 26 octobre pour les variantes actuelles.

