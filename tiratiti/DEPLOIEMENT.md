# Publication Tiratiti

Le site est statique. `build.cjs` copie uniquement les fichiers de `public-files.json` dans `dist`. Les tests, pages QA, références Blender, anciennes versions et modèles 3D inutilisés ne sont pas dans le dossier publié.

## Vérification locale

Depuis le dossier `tiratiti` du dépôt :

```sh
npm test
npm run build
npm run preview
```

Le dernier aperçu ouvre la version construite sur http://127.0.0.1:4174. Sous PowerShell, utiliser `npm.cmd` si nécessaire. Ces commandes ne publient pas le site.

## Configuration Vercel existante

Le dépôt contient deux configurations, selon le dossier racine choisi pour le projet :

| Dossier racine Vercel | Commande de construction | Dossier de sortie |
| --- | --- | --- |
| Racine du dépôt | `node tiratiti/build.cjs` | `tiratiti/dist` |
| `tiratiti` | `npm run build` | `dist` |

Conserver la configuration correspondant au projet existant. Le serveur `server.cjs` sert uniquement aux aperçus locaux ; il n’est pas nécessaire à l’hébergement statique. Un push sur la branche configurée déclenche la publication si l’intégration Git de Vercel est activée.

## Carte et variables

Pour afficher la carte Mapbox, configurer `MAPBOX_PUBLIC_TOKEN` avec un jeton public commençant par `pk.`. En local, cette valeur peut être placée dans `.env.local`. La construction produit `mapbox-config.js`, ignoré par Git. Ne jamais y mettre un jeton secret.

Sans jeton public, le site conserve le lien de carte OpenStreetMap. L’accueil et l’animation fonctionnent sans cette variable. Les adresses présentes sont des démonstrations fictives.

## Fichiers publiés

La version du 27 octobre 2026 contient 316 fichiers publics, environ 18,32 Mo. L’animation utilise 180 angles de rotation et 95 poses d’ouverture transparents, chargés progressivement. Aucun GLB ni moteur 3D n’est requis par cette version.

Après l’ajout d’un fichier utilisé par le site, ajouter son chemin à `public-files.json`, puis reconstruire. Le manifeste de l’animation contient une empreinte de révision pour éviter de réutiliser des images périmées dans le cache du navigateur.

La construction affiche les nombres exacts de fichiers et d’octets. Le paiement reste désactivé et les demandes de contact utilisent la messagerie du visiteur.
