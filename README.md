# Starship V3

Site vitrine immersif et non officiel consacré à Starship V3, inspiré de l'affiche « Limited 02 · Starship V3 » d'Arte Collective.

## Contenu
- **Affiche** : fusée 3D en acier inoxydable (Three.js), « 3 » chromé irisé, annotations qui suivent le modèle, version noire ou blanche.
- **Anatomie** : visite guidée en 11 étapes, de la coiffe aux 33 Raptor 3, caméra pilotée par le défilement.
- **Lancement** : compte à rebours, allumage, fumée, ascension, hot staging, boostback, avec HUD de télémétrie simulée.
- **Raptor 3**, **profil de mission** (défilement horizontal), **échelle** comparative, **V1 / V2 / V3**, et Mars en rendu procédural.

## Lancer en local
Le site est statique, sans étape de build. Les modules ES exigent un serveur HTTP :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Bibliothèques chargées par CDN : Three.js 0.160, GSAP 3.12 + ScrollTrigger, Lenis 1.1.

Chiffres arrondis issus de sources publiques ; le modèle 3D et la télémétrie sont simulés. Starship est un véhicule développé par SpaceX ; ce site n'y est pas affilié.
