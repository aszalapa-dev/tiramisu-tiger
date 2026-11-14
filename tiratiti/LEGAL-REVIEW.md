# Site vitrine Tiratiti — vérification du 14 novembre 2026

## État

Protections techniques et pages d'information ajoutées. **Les mentions obligatoires et la politique de confidentialité ne sont pas encore entièrement finalisées : les éléments ci-dessous nécessitent une réponse de l'exploitant.** Ne pas présenter cette livraison comme une certification de conformité générale.

## Informations attendues de l'exploitant

- Nom complet de l'entrepreneur ou dénomination sociale, forme juridique le cas échéant, adresse professionnelle, numéro BCE et statut / numéro TVA. Le prénom Timoty et la marque Tiratiti ne suffisent pas à identifier le responsable. Ne pas inventer ces informations.
- Confirmer l'adresse figurant dans les anciennes étiquettes du projet (Rue de Bruxelles 13, 4130 Esneux). Elle n'est pas publiée comme siège sans confirmation. Confirmer le téléphone de contact et les éventuelles mentions de registre liées à la forme juridique.
- Confirmer le prestataire de contact@tiratiti.be, les personnes ayant accès aux messages et les conditions de traitement/transfert applicables. La catégorie « prestataire de messagerie » est indiquée en attendant son identification.
- Appliquer la règle proposée de suppression des demandes sans suite après 12 mois suivant le dernier échange, ou corriger le texte avant de l'adopter. Le site statique ne peut pas supprimer les messages dans la boîte mail. Les durées des dossiers contractuels et comptables doivent correspondre aux obligations réellement applicables.
- Vérifier dans le compte Vercel le projet effectivement publié, les journaux activés et leur rétention ; vérifier les accords de sous-traitance / garanties de transfert effectivement applicables avec les prestataires. Le connecteur Vercel n'a exposé aucune équipe accessible ; le tableau de bord n'a donc pas été audité. Les textes ne donnent pas de durée fictive pour ces journaux.
- Si une autorisation d'activité alimentaire est applicable, confirmer les mentions d'autorité de contrôle requises (AFSCA) et les informations exactes avant publication. Aucun numéro d'agrément n'a été inventé.

Les pages d’identification et de confidentialité signalent cette information incomplète visiblement. Le code source de mentions-legales.html comporte un repère LEGAL-IDENTITY-PENDING pour compléter le bloc « Éditeur et contact ». Le même responsable doit être identifié dans confidentialite.html.

## Périmètre et observations

- Site de présentation sans compte, vente, paiement ni commande en ligne. Conditions d'utilisation simples intégrées dans les mentions ; pas de fausses CGV de vente à distance ni de lien vers l'ancienne plateforme européenne RLL fermée.
- Formulaire revendeur : préparation d'un mailto dans le navigateur. Pas de POST, service de formulaire, journalisation des champs ou enregistrement de leur contenu dans le stockage local. Les champs sont désactivés tant que le gestionnaire JavaScript qui annule l'envoi HTML n'est pas prêt ; cela évite un envoi GET involontaire dans l'URL. Le visiteur décide lui-même d'envoyer le mail depuis sa messagerie.
- Adresses cartographiques : six exemples fictifs, identifiés comme tels dans la liste, les infobulles et l'avertissement. Les remplacer par des adresses vérifiées avant de les présenter comme de vrais revendeurs.
- Aucun outil d'audience ou publicitaire trouvé dans les ressources effectivement publiées. Les anciens fichiers de QA et scene.js (CDN Three.js) ne sont pas dans la chaîne de chargement du site actuel. L'animation et les photos restent locales.
- Google Fonts retiré des deux pages ; Inter Tight et Barlow Condensed servis localement, sous licence SIL OFL. Conserver les licences et vérifier que les droits sur les photos, logos et modèles fournis sont détenus par l'exploitant ; ce changement ne constitue pas un audit de droits d'auteur.

## Consentement, version 2026-11-14.1

- Stockage local `tiratiti.privacy.v1`, décision explicite, version, date et expiration à 180 jours. Aucun identifiant visiteur ajouté pour enregistrer cette décision. Un stockage invalide, expiré ou d'une autre version ne vaut pas accord.
- Bannière avec refus, acceptation et personnalisation au même niveau. Aucune case Mapbox cochée par défaut, aucune acceptation par défilement, aucun mur de cookies. Préférences rouvrables dans tous les pieds de page, dialogue accessible au clavier.
- Sans accord : aucune feuille de style, script, donnée de carte ou préconnexion Mapbox. Service bloqué aussi si privacy.js est absent ou échoue. Après accord : chargement à proximité de la carte, conservant la temporisation de défilement sur mobile.
- Mapbox GL JS 3.32.0 : `performanceMetricsCollection:false`, `collectResourceTiming:false`. Les opérations de comptage/facturation du service ne sont pas contournées. Aucun appel à la géolocalisation et permission géolocalisation désactivée par en-tête.
- Inspection du SDK officiel : clés `mapbox.eventData:…`, `.uuid:…`, `.uuidTimestamp:…`. UUID renouvelé après environ 24 heures lors de son utilisation (`Date.now()-864e5`). Le stockage local n'a pas de TTL natif. Nettoyage ciblé au refus et au prochain passage après expiration ; aucun effacement global des autres données de site.
- Retrait après démarrage du SDK : suppression des clés ciblées puis rechargement de page avec refus enregistré, afin de décharger aussi le logiciel tiers. Vérification supplémentaire avant initialisation pour un retrait survenant pendant le téléchargement. Synchronisation des préférences entre onglets.
- Ne pas prétendre effacer les données déjà reçues par Mapbox ni les stockages d'autres origines ; la politique explique cette limite.
- Conserver cette version des textes et du mécanisme dans Git pour documenter la configuration de consentement. Tout nouveau traceur/service impose une révision de l'inventaire et, si nécessaire, de la version pour redemander l'accord. Aucun backend de journalisation nominative du consentement n'a été ajouté.

## Vérifications

- 173 tests passent, dont refus initial, préférences expirées/invalides, refus en cours de téléchargement, révocation, synchronisation entre onglets, stockage bloqué et sécurité du formulaire.
- Build : 856 fichiers, 110,20 Mo (environ 0,25 Mo ajouté, essentiellement les polices locales).
- Aperçu navigateur : aucun script/stylesheet tiers ni canevas de carte avant accord ; carte prête après accord ; zéro élément tiers/canevas après retrait et rechargement. Aucun message d'erreur observé pendant ce parcours.
- Affichage mobile vérifié à 390 px : pages sans débordement horizontal, dialogue de préférences défilable, formulaire préparant le message localement sans navigation ni envoi.
- Les en-têtes de sécurité sont configurés dans les deux vercel.json. Leur présence sur le domaine publié reste à vérifier après déploiement ; le serveur local ne les simule pas.

## Sources officielles consultées

- SPF Économie, informations obligatoires y compris pour un site sans vente : https://news.economie.fgov.be/203681-informations-obligatoires-sur-le-site-web-de-votre-entreprise/
- SPF Économie, obligations d'information : https://economie.fgov.be/fr/themes/entreprises/guidance/pratiques-commerciales/obligations-dinformation-dans/questions-frequemment-posees
- APD, cookies et autres traceurs : https://www.autoriteprotectiondonnees.be/cookies-et-autres-traceurs
- APD, checklist : https://www.autoriteprotectiondonnees.be/publications/checklist-cookies.pdf
- RGPD, notamment articles 6, 12–22, 28 et chapitre V : https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32016R0679
- APD, plainte : https://www.autoriteprotectiondonnees.be/citoyen/agir/introduire-une-plainte
- Mapbox : https://www.mapbox.com/legal/privacy ; https://www.mapbox.com/legal/dpa ; https://docs.mapbox.com/mapbox-gl-js/api/map/
- SDK inspecté : https://api.mapbox.com/mapbox-gl-js/v3.32.0/mapbox-gl.js
- Vercel : https://vercel.com/legal/privacy-notice ; https://vercel.com/legal/dpa

Document interne non inclus dans public-files.json et non copié vers dist.
