# Sources du logo, du Spécial et des coordonnées

Vérification locale du 25 septembre 2026. Les fichiers originaux ont été lus sans être modifiés. Ce document n'est pas un fichier public du site.

## Logo vectoriel

Source : `D:\SITE TIRATITI\Tiratiti police.pdf`, page 12, document « Tiratiti — Art Direction & Branding ». La copie `C:\Users\alexi\OneDrive\Images\TIRAMISUS\police tiratiti et logo.pdf` présente le même document de marque.

Les contours ont été extraits directement de la police Harabara Mais Bold incorporée au PDF. Les formes des glyphes, leur ordre et les espacements du tableau `TJ` du document sont conservés. Il n'y a ni substitution par une police du navigateur, ni redessin, ni étirement horizontal. Seule la couleur est adaptée aux deux usages de la palette du site.

| Fichier | Couleur | Dimensions du tracé |
| --- | --- | --- |
| `assets/logo-tiratiti.svg` | Crème `#f0efee` | 529,044006 × 161,556030 unités |
| `assets/logo-tiratiti-ink.svg` | Chocolat `#2b1611` | 529,044006 × 161,556030 unités |

Rapport largeur/hauteur : **3,274678:1**. Les deux SVG utilisent le même `viewBox` : `709.60553 450.092407 529.044006 161.55603`. Le bon affichage conserve `height: auto` ou utilise `object-fit: contain`, sans transformation différente selon l'axe. Il s'agit du mot-symbole seul, présenté ainsi à la page 12 ; la mascotte et la signature existent séparément aux pages 13 à 15 du document.

SHA-256 du PDF : `6d12eb1402513ede280d141e8090b24c3b343c1157b33a62e5fa74d58098ceb1`.

La conversion et le rendu de contrôle se trouvent dans `../tmp/brand-assets/`, avec le script `extract_wordmark.py` et le rapport `logo-provenance.json`. Le rendu du SVG a été comparé visuellement à la page originale.

## Visuel du Spécial

Fichier utilisé : `assets/special.webp`, copié sans conversion ni retouche depuis `D:\SITE TIRATITI\BEANRO MODELE\artifacts\maquette-produits\special.webp`.

- Dimensions : **420 × 545 pixels**, fond transparent réel, 25 088 octets.
- SHA-256 identique à la source : `b02c8c434f9ac3271bbce2c7dd00337f2a26b492334ee5f700b9b571187088b0`.
- Le pot et les biscuits proviennent de l'ancien projet local. Ce fichier n'est pas une nouvelle génération.
- Aucun modèle `.blend` ou `.glb` du Spécial n'a été trouvé dans les emplacements recherchés. La fiche utilise donc cette image, sans simuler un modèle différent.

Deux autres copies de référence ont été récupérées, sans être ajoutées aux fichiers publics :

| Copie locale | Original | Détails |
| --- | --- | --- |
| `assets/special.png` | `D:\SITE TIRATITI\BEANRO MODELE\assets\tiramisu-special.jpg` | Fichier réellement au format PNG malgré son extension `.jpg` d'origine ; 1536 × 1024 pixels, fond transparent, grandes marges. Octets inchangés. |
| `assets/pandistelle.png` | `D:\SITE TIRATITI\BEANRO MODELE\assets\pandistelle.png` | Biscuit au cacao avec étoiles ; 500 × 500 pixels, fond transparent. Octets inchangés. |

La photo `C:\Users\alexi\OneDrive\Images\TIRAMISUS\tiramisu-special.jpg` a été écartée : son damier gris est inscrit dans les pixels et son canal alpha est entièrement opaque. Les métadonnées et empreintes des copies retenues figurent dans `../tmp/brand-assets/special-provenance.json`.

## Coordonnées et histoire

Source principale : `D:\SITE TIRATITI\Stickers_Tiratiti-4-6.pdf`. Les trois pages portent les coordonnées suivantes, vérifiées par extraction et lecture du rendu :

- **contact@tiratiti.be** ;
- **Rue de Bruxelles 13, 4130 Esneux** ;
- **www.tiratiti.be**.

L'adresse postale est l'adresse figurant sur l'étiquette. Elle n'établit pas à elle seule un point de vente ouvert au public. Le site utilise le contact e-mail et invite à demander les disponibilités.

La page 1 du PDF correspond au **Special** et mentionne des biscuits au cacao. Le nom **Pane di Stelle** vient de la demande de l'utilisateur et correspond au biscuit étoilé déjà présent dans les visuels de l'ancien projet.

Le document de marque `Tiratiti police.pdf`, page 5, relie le nom à un surnom d'enfance : Titi, Timoty, Tiratiti. Il décrit un tiramisu maison mis en canette transparente. L'histoire visible sur le site reprend la rédaction demandée pour la version du 25 septembre.

Les anciens fichiers HTML comprennent une autre adresse, `hello@tiratiti.be`, ainsi qu'un téléphone de démonstration, `+32 4 00 00 00`. Les coordonnées du PDF fourni ont été retenues à leur place. Le fichier `D:\SITE TIRATITI\BEANRO MODELE\Points de vente.html` indique explicitement « revendeurs Tiratiti à Liège (fictifs) » pour ses données : cette liste n'a pas été réutilisée. Aucun revendeur réel n'est déduit de ces maquettes.
