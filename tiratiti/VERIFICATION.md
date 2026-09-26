# Vérifications Tiratiti

## Animation toupie — 26 septembre 2026

Deux tours sur l’axe vertical, oscillation progressive de 0 à 8° puis retour droit et face caméra avant l’ouverture. Accélération et ralentissement continus, arrêt à 82 % du parcours. 2 001 poses vérifiées : rotation monotone, dessous jamais face caméra, fin verticale et retour reproductible. Les matériaux, l’éclairage, le cadrage et le décapsulage restent inchangés. Construction du site validée. Cette chorégraphie remplace celle du 25 septembre qui gardait la face visible pendant tout le parcours.

## Version du 25 septembre 2026

- Remarques du document utilisateur appliquées : logo vectoriel original et proportions natives, menu L’histoire / Les goûts / Où nous trouver, récit de Timoty, quatre ingrédients, mode d’emploi Ouvre / Plonge / Savoure et trois goûts. Le jeu et la newsletter sont retirés. La photo réelle du Spécial et les coordonnées des étiquettes officielles remplacent les éléments manquants ; aucun revendeur fictif n’est affiché.
- Syntaxe des quatre modules validée, ancres et fichiers locaux vérifiés. Navigation ordinateur et menu mobile testés ; le focus suit la section choisie. Fiche du Spécial, ajout du bon goût et retrait de la sélection vérifiés ; la sélection de test est remise vide. Vue 3D du Spéculos chargée sans avertissement.
- Rendu contrôlé à 1280 × 720 et 390 × 844 : vrai logo, accroche, récit et photo d’atelier, ouverture, fiches produits, absence de débordement horizontal. Le bouton d’accueil mobile a été replacé sous le sous-titre pour éviter son recouvrement par la canette.
- Rotation modérée avec face visible : 2 001 poses finies, interpolation sans dépassement et retour exact. Les bornes analytiques couvrent toutes les poses interpolées : ni le dessous ni l’arrière ne se présentent à la caméra. La vue produit à 360° reste librement manipulable.
- Ouverture inversée par un pivot appliqué uniquement à la fermeture, sans tourner le corps ni l’étiquette. Le clip se déroule entre 82 % et 98 % du parcours. Un léger recul de 14 % avant l’ouverture ménage la place de la languette tout en conservant le centre de la canette.
- Neuf contrôles sur le vrai GLB : les trois pièces du rebord sont immobiles sur les 121 images ; le demi-tour conserve leurs surfaces à moins de 0,9 micromètre. Le déplacement horizontal de l’opercule est inversé, sa hauteur conservée ; le dégagement final dépasse de 65,8 mm le rebord opposé. Retour ouvert → fermé exact.
- Contrôle navigateur de l’ouverture : pli intermédiaire, rebord continu, intérieur dégagé et retour exact ; corps, étiquettes et matériaux inchangés par l’animation. Aucun matériau sans correspondance. Les rapports locaux sont sous `../tmp/realism-25/`.
- Éclairage de studio rééquilibré, rendu ACES et plastique avec transmission/réfraction ; contrôle visuel avant/après. La géométrie et les textures alimentaires du modèle fourni restent conservées. Il s’agit toujours d’un rendu 3D, pas d’une vidéo photographique.
- Comparaison du Blender actuel avec sa sauvegarde : géométrie, transformations, matériaux affectés et animation identiques. Seuls douze matériaux inutilisés ont été supprimés dans la source ; les exports existants restent valides.
- Construction Vercel réussie : 26 fichiers publics, environ 61,36 Mo. Les modèles Blender, sauvegardes et pages QA sont exclus. Aucun déploiement externe effectué.

Limites actuelles : points de vente, horaires et modalités professionnelles non fournis ; la rubrique permet de contacter `contact@tiratiti.be`. Aucun paiement en ligne ni modèle 3D du Spécial. Performances sur un téléphone physique peu puissant et préférence système de réduction des animations non mesurées ; cette dernière reste prise en charge par le code.

Les sections suivantes conservent l’historique des versions précédentes ; les comportements retirés ne décrivent pas la version actuelle.

## Vérification initiale du 21 septembre 2026

## Contrôles réalisés

- Syntaxe des trois scripts : interface.js, scene.js et site-interactions.js validée par Node.
- Aperçu réel dans le navigateur intégré : 1280 × 720 et 390 × 844.
- Hero : chargement de la 3D, centrage au milieu du parcours, inclinaison, dessous visible, retour debout et couvercle soulevé à la fin.
- Pause du hero : la progression reste figée pendant le défilement de la page, puis reprend avec le bouton.
- Titres : apparition progressive et déplacement synchronisés avec la même progression que le modèle.
- Trois photos de l'atelier : chargées, sur trois lignes décalées, sans découpe latérale sur mobile.
- Newsletter : image chargée, formulaire explicitement désactivé, disposition mobile sans débordement.
- Menu mobile : ouverture, fermeture après choix et focus transféré au titre de la section.
- Fiche Spéculoos : rendu 3D et ajout du bon produit au panier.
- Panier : ajout, augmentation, diminution, retrait, conservation après rechargement et présentation mobile. Panier remis vide après les essais.
- Jeu : démarrage, capture, score, pause conservant le temps, reprise, fin à zéro et enregistrement du record.
- Aucun débordement horizontal observé dans les vues vérifiées.

## Limites

- La réduction des animations est implémentée dans le style et la scène, sans émulation de cette préférence système dans le navigateur de test.
- Les modèles d'origine sont conservés : Classique 54,5 Mo et Spéculoos 12,2 Mo. L'outil de simplification nécessaire n'a pas pu être installé ; aucune copie optimisée n'a été intégrée. Les animations sont rendues à la demande, mais le chargement et les performances sur un téléphone peu puissant restent à mesurer.
- Le paiement et la newsletter attendent leur service. Le panier et le record du jeu sont locaux à ce navigateur.
- Reprise de la page d'accueil et des principes visuels, adaptée aux contenus Tiratiti ; pas de copie des pages secondaires ou de l'infrastructure commerciale de Hungry Tiger.

## Ouverture de l'opercule corrigée

- Découpe du maillage du couvercle à la rainure de rayon 25,5 mm : le panneau central se retire ; toute la jupe extérieure, le bourrelet et les sertissages restent sur la canette.
- Tranche de l'opercule d'environ 0,584 mm au bord. Languette articulée autour du rivet, puis bascule du panneau et retrait latéral. La rainure reste sur le rebord fixe.
- Contrôle sur le GLB réel : 16 vérifications réussies. Conservation des surfaces et des attributs du métal ; 1 152 points de contrôle du dessous du rebord et 192 rayons du dessus sans trou. Les 37 maillages fixes gardent exactement leurs matrices.
- Retour 0 → 1 → 0 exact ; géométries originales et cache des fiches produits inchangés.
- Vérification visuelle de l'ouverture à plusieurs étapes sur ordinateur et du cadrage à 390 × 844. Aucun avertissement ni erreur de rendu. Le cadrage, l'éclairage, les matériaux existants et le contenu du site sont conservés.
- La page locale qa-opening.html contient ces contrôles et est exclue du déploiement. La version Vercel inclut le nouveau module can-opening.js.
- Contrôle complémentaire avec le contour rouge fourni : la limite correspond à la rainure de diamètre 51 mm. Comparaison fermé/ouvert réalisée de dessus, avec le même modèle et le même éclairage ; crème visible au centre, couronne métallique inchangée. Le retrait emporte désormais l'opercule entièrement hors de l'ouverture. Dix-sept contrôles réussis, dont le dégagement complet ; modules de l'ouverture versionnés et onglets du site actualisés pour remplacer l'ancienne animation restée en mémoire.

## Animation révisée le 22 septembre 2026

- Modèle 3D rechargé après redémarrage du serveur local ; le précédent chargement avait échoué et laissé la photo de repli.
- Tour complet réparti jusqu'à 65 % du parcours, puis pivot diagonal et retour debout à 96 % avant l'ouverture.
- Suppression du plateau de rotation entre 77 % et 89 %.
- Lissage du scroll adouci et vitesse de rattrapage plafonnée après un geste rapide ou une pause.
- Chargement du hero asynchrone pour laisser les fiches des parfums disponibles. État de chargement accessible et bouton de relance en cas d'échec.
- Syntaxe validée ; 2 001 poses numériques finies et fin à un tour complet. Parcours visuel aller/retour, cadrage, ouverture et pause vérifiés dans le navigateur. Aucun nouvel avertissement ou erreur dans l'aperçu de test.
- Cadrage mobile vérifié pendant le retournement. La scène utilise désormais overflow:clip pour empêcher un défilement interne de déplacer le modèle lors de la mise au point d'une commande.

## Direction artistique du 22 septembre 2026

Palette du PDF appliquée à toute l'interface : chocolat #2b1611, rouge #86221c, blanc cassé #f0efee, bleu #7ea0e3. Favicon, fonds SVG, panneaux, navigation, boutons, panier et jeu harmonisés. Six photos retouchées via imagegen et intégrées ; références locales vérifiées. Contrôle visuel de la nouvelle palette et de la newsletter ; aucun avertissement/erreur dans l'aperçu de vérification. Détails et prompts dans DIRECTION-ARTISTIQUE.md et assets/da/.

## Décollement d’après la vidéo du 22 septembre 2026

- Référence locale : 2026-09-22 13-57-12.mp4. Les images montrent le soulèvement de la languette, un pli arrondi de la tôle, une dernière attache, puis le retrait de l’opercule plié. L’anneau serti reste complet.
- Le panneau central est subdivisé pour représenter une courbure progressive. Positions et normales se déforment ensemble ; la tranche et la nervure suivent le même pli, le rivet et la languette suivent sa tangente.
- La languette se relève avant le pli. La moitié encore scellée reste fixe, puis l’opercule se rabat davantage et bascule autour de sa dernière attache. Le retrait libre commence seulement après 87 % du geste d’ouverture.
- Les 27 contrôles géométriques réussissent sur le véritable GLB : 44 étapes, 37 maillages fixes, 2 898 paires de sommets pour l’épaisseur, remise à zéro exacte et 43 géométries originales intactes. Aucun trou dans le rebord ; ouverture finale entièrement dégagée.
- Le cadrage debout a été contrôlé à 88 positions avant détachement : la languette et l’opercule restent dans l’image. Le cadrage, la lumière, les matériaux, le contenu et le reste du mouvement ne changent pas.
- Contrôle visuel sur ordinateur et à 390 × 844, avec le module versionné opercule-video-4. Aucun avertissement/erreur dans le navigateur, aucun débordement horizontal sur mobile.
- Syntaxe validée et construction Vercel réussie : 22 fichiers publics. Les deux pages QA restent exclues de la publication.

## Animation Blender du 22 septembre 2026

- Nouveau fichier éditable : exports/blender-ouverture/Tiratiti_Classique_ouverture.blend, construit depuis Tiratiti_Classique_ameliore.blend. Le SHA-256 du fichier source reste inchangé.
- Armature de 52 os, 121 images à 30 i/s : languette articulée, pelage progressif, dernière attache puis retrait. Le GLB de 8,2 Mo exporte 11 maillages et un clip unique Tiratiti_Ouverture, sans image ni ressource externe supplémentaire.
- 11 contrôles Blender réussis sur les 121 images : 29 objets fixes et 7 surfaces de sertissage invariants, ancrage conservé avant rupture, pli réel, retrait complet et remise à zéro exacte.
- Le site utilise désormais AnimationMixer et SkeletonUtils pour lire ce clip. L’ancien module can-opening.js reste uniquement comme archive locale, exclue de la construction publique.
- Comparaison navigateur : fermé conforme au modèle original, matériaux tous reconnus, corps/étiquette inchangés, 8 anciennes pièces remplacées, retour 0 → 1 → 0 exact. Les tranches nouvelles sans UV utilisent le métal sans normal map pour éviter une erreur de shader.
- Surface de dessin transparente agrandie autour du hero, avec compensation exacte de la projection : taille et position de la canette conservées, languette visible au-dessus de l’ancien bord du canvas.
- Aperçu de quatre secondes produit depuis 61 vrais rendus Blender. Contrôle visuel sur ordinateur et mobile 390 × 844, sans débordement horizontal.

## Modèle avec stickers PDF du 24 septembre 2026

- Remplacement du Classique depuis le fichier fourni `Tiratiti_Classique_stickers_PDF.blend` ; original intact. Les 12 pièces d’étiquette utilisent les six images PDF embarquées. Nouveaux boudoirs et nouvelle crème conservés.
- Matières alimentaires converties en huit textures de couleur sans éclairage, normales et rugosité. Aucun chevauchement UV après correction ; géométrie de la copie de préparation identique à la source. Normal map du métal préparée sur un atlas commun au corps et à l’opercule.
- Export Draco : Classique 28,12 Mo, ouverture 1,59 Mo. La crème conserve ses 314 156 sommets de base ; la subdivision supplémentaire est omise uniquement dans le GLB web. Dimensions identiques : 65,22 × 92 × 65,22 mm.
- 26 contrôles indépendants des exports réussis. Les 156 pistes d’animation gardent exactement leurs valeurs et leurs temps. Rebord non articulé, ouverture à 52 os, textures toutes embarquées et canaux UV vérifiés.
- Contrôle navigateur fermé, pli intermédiaire, ouverture complète et retour 0 → 1 → 0 : aucun écart de pose, aucune modification du corps par l’ouverture, huit anciennes pièces du dessus remplacées. Aucun matériau manquant ni erreur de rendu.
- Cadrage et ouverture vérifiés sur ordinateur et mobile 390 × 844, sans débordement horizontal. Éclairage, poses de défilement et présentation du site conservés. Image de repli mise à jour avec un rendu transparent du nouveau fichier.
- Construction Vercel réussie : 23 fichiers publics, 61,32 Mo. Modèles Blender, sauvegardes et pages de contrôle exclus du déploiement.
