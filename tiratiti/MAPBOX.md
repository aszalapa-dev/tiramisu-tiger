# Carte Mapbox

Dans Vercel, ajouter `MAPBOX_PUBLIC_TOKEN` dans Settings → Environment Variables
pour Production et Preview, puis redéployer. Utiliser uniquement le jeton public
`pk.` du propriétaire du site.

En local, créer `tiratiti/.env.local` avec `MAPBOX_PUBLIC_TOKEN=…`, puis lancer
`node tiratiti/build.cjs`. Le fichier `mapbox-config.js` est généré pour le serveur
local et dans `dist`. Ces fichiers et `.env.local` restent hors de Git.

Ce jeton public sera visible par les visiteurs, comme requis par Mapbox GL JS.
Les adresses des revendeurs restent masquées. La molette défile dans la page ;
les boutons de la carte permettent de zoomer. Sur mobile, déplacer la carte
avec deux doigts pour conserver le défilement de la page avec un seul doigt.
