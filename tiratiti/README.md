# Tiratiti — site avec pot 3D

L’accueil attend la préparation de la 3D derrière un écran de chargement. Le visiteur peut passer l’attente ; une erreur ou un délai de 35 secondes libère automatiquement la page. Les modèles continuent à charger après une entrée anticipée. Le mobile dispose de zones tactiles élargies et d’un cadrage dédié au paysage.

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
- `scene.js` : rendu, lumière et poses des modèles 3D.
- `blender-opening.js` : lecture réversible du clip Blender, synchronisée au scroll ; conservation des matériaux et du reste du modèle.
- `assets/classique.glb` : nouveau modèle fourni dans `Tiratiti_Classique_stickers_PDF.blend`, avec les six stickers du PDF, les nouveaux boudoirs et la crème. Les matières procédurales sont converties en textures embarquées pour le navigateur.
- `assets/ouverture-classique.glb` : dessus articulé du même fichier Blender, avec rebord fixe et opercule déformable. Le clip `Tiratiti_Ouverture` dure 3,2 secondes. La copie Blender préparée pour l’export et ses rapports sont conservés dans `../exports/stickers-pdf/`.
- `site-interactions.js` et `.css` : sélection locale et menu mobile.
- `assets/logo-tiratiti.svg` et `assets/logo-tiratiti-ink.svg` : tracé original du logo, en crème et en chocolat.
- `assets/special.webp` : photo détourée du Spécial, conservée telle qu'elle était dans le projet précédent.
- `assets/` : modèles, photos et décors locaux.

Les versions précédentes du code sont conservées dans `version-1/`, `version-2/` et `version-3-colors/`. Les anciennes feuilles `style.css`, `experience.css`, `refinements.css` et `palette.css` ne sont plus chargées. Les fichiers de référence sous `sources/` restent inchangés.

Three.js r160 et les polices sont chargés en ligne. Une connexion est donc nécessaire au premier chargement.

Le Classique et son ouverture utilisent la compression Draco. La géométrie de base détaillée de la crème est conservée, sans ajouter sa subdivision supplémentaire au modèle web. Le modèle du Spéculos reste inchangé. Aucun modèle 3D du Spécial n'a été fourni. Voir `VERIFICATION.md` pour les contrôles et les limites.

