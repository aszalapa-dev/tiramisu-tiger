# Direction artistique Tiratiti

Référence : `D:/SITE TIRATITI/Stickers_Tiratiti-4-6.pdf`, trois pages observées le 22 septembre 2026. Les couleurs ci-dessous proviennent du rendu du PDF, sans changement des fichiers de référence.

| Couleur | Valeur écran | Rôle |
| --- | --- | --- |
| Chocolat | #2b1611 | Hero, footer, texte, éléments profonds |
| Rouge profond | #86221c | Ingrédients, parfums, accents, grand visuel produit |
| Blanc cassé | #f0efee | Titres sur fond sombre, boutons, atelier, contenant, newsletter |
| Bleu pervenche | #7ea0e3 | Fonds photo, détails et contrastes doux |

La palette est centralisée au début de `redesign.css`. Les anciennes variables sont des alias vers ces quatre couleurs. Le menu, le panier, les fiches produit, le mini-jeu, les contours, les décors SVG, les survols et le favicon sont harmonisés.

## Visuels intégrés

Six nouvelles versions ont été réalisées avec l'outil intégré **imagegen**, puis vérifiées visuellement. Les compositions principales et l'aspect naturel des ingrédients sont conservés ; une retouche générative peut modifier des détails fins. Les fichiers originaux restent disponibles.

- [Bocal tenu dans la main — fond bleu](assets/da/hand-jar.png)
- [Trois bocaux — fond rouge](assets/da/trio-jars.png)
- [Canette — fond bleu](assets/da/newsletter-can.png)
- [Atelier — préparation de la crème](assets/da/atelier-creme.png)
- [Atelier — trempage dans le café](assets/da/atelier-cafe.png)
- [Atelier — montage](assets/da/atelier-montage.png)

Chemin du dossier final : `C:/Users/alexi/.codex/.chatgpt-projects/g-p-6aa120376e788191976a929eed685b5a/tiratiti-scroll/assets/da/`.

Prompts exacts et contrôles : [photos produit](assets/da/product-prompts.md) et [photos atelier](assets/da/workshop-prompts.md).

Les rendus des pots et les modèles 3D gardent leur étiquetage Tiratiti chocolat/rouge et leurs couleurs alimentaires naturelles. Les fonds autour des produits utilisent désormais la nouvelle palette.

## Vérification

- Quatre couleurs de marque effectivement présentes dans les styles calculés du navigateur.
- Anciennes teintes jaune/orange/rose éliminées des fichiers actifs de l'interface.
- Treize références d'images locales présentes sur disque, dont les six nouvelles versions.
- Scripts de navigation et d'interaction valides ; mouvement 3D conservé.
- Contrastes : chocolat/blanc cassé 14,92:1 ; chocolat/bleu 6,55:1 ; rouge/blanc cassé 8,09:1.
- Contrôle visuel du hero, des fonds produit et de la newsletter dans l'aperçu.

La version précédente des couleurs est conservée dans `version-3-colors/`.
