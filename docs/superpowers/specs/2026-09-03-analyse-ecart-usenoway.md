# Pourquoi usenoway.com rend mieux et charge plus vite — analyse et refonte

**Date** : 2026-09-03
**Statut** : analyse terminée, première tranche de refonte implémentée

---

## Ce qui a été mesuré, et ce qui ne l'a pas été

Tout ce qui concerne **notre** code a été mesuré sur ce dépôt : build Next.js
réel, tailles gzip des chunks, comptage des fichiers de police, lecture du
chemin de génération de bout en bout.

Ce qui concerne **usenoway.com** ne l'a pas été. Le proxy réseau de cette
session bloque `usenoway.com`, `fal.ai` et `apps.apple.com` par politique
d'egress — je n'ai pas pu ouvrir le site, mesurer son chargement, ni lire sa
fiche App Store. Ce qui suit à leur sujet vient donc de résultats de
recherche et de l'architecture de leur parcours, pas d'une mesure. **La
comparaison chiffrée avec eux reste à faire** : lancer un PageSpeed Insights
sur les deux sites depuis un poste non restreint prendrait cinq minutes et
transformerait ces hypothèses en faits.

Le seul élément solide sur eux, et il est décisif :

> **NoWay — « Choisis un style, prends une photo, découvre le résultat. »**

L'ordre des trois verbes est toute l'analyse qui suit.

---

## Partie 1 — La qualité : ce n'est pas le modèle, c'est le prompt

### Le constat

Nous utilisons **le même modèle qu'eux ou un équivalent direct**
(`gemini-3-pro-image`, Nano Banana Pro). Si leurs rendus sont meilleurs, la
différence ne vient pas des poids du modèle. Elle vient de ce qu'on lui
envoie.

Et sur ce point l'écart est structurel, pas cosmétique :

| | NoWay | Bluminoo (avant cette refonte) |
| --- | --- | --- |
| Origine du prompt | Un style choisi dans une liste | Rédigé à la volée par un modèle vision |
| Reproductibilité | Identique pour tous | Différent à chaque génération |
| Testable | Oui, style par style | Non — aucun prompt n'est réutilisé |
| Corrigeable | Oui, on édite le style | Non — il n'y a rien à éditer |
| Ce que l'utilisateur fournit | Une photo de lui | Une photo de lui **+ 1 à 3 photos du lieu** |

Le point aveugle était `lib/place-prompt.ts`. Le flux était :

```
photos du lieu → modèle vision (kie.ai gpt-5-2) → un paragraphe anglais
              → Nano Banana Pro
```

Ce paragraphe était **différent à chaque appel**. Deux utilisateurs demandant
la même chose obtenaient deux prompts distincts, donc deux niveaux de qualité.
Il n'existait aucun moyen de dire « ce rendu rooftop est raté, corrigeons le
prompt rooftop » — il n'y avait pas de prompt rooftop, il y en avait un
nouveau à chaque fois.

C'est exactement le contraire de ce que fait un catalogue de styles. Chez eux,
un style raté se corrige une fois et le correctif profite à tout le monde. La
qualité s'accumule. Chez nous elle repartait de zéro à chaque génération.

### Ce que le prompt généré ne disait jamais

En relisant les instructions envoyées au modèle vision, trois consignes
manquaient — et ce sont précisément celles qui séparent une photo d'une image
IA reconnaissable :

1. **Interdire le lissage de peau.** Le réflexe par défaut de Nano Banana Pro
   est d'embellir : peau lissée, teint uniformisé, symétrie corrigée, dents
   blanchies. C'est le premier détail qui trahit une image générée aux yeux
   d'un tiers — et c'est aussi ce qui casse la ressemblance, donc l'intérêt
   du produit. Rien ne l'interdisait.
2. **Demander les défauts du capteur.** Grain, bruit dans les ombres, hautes
   lumières écrêtées, aberration chromatique en bord de cadre, compression
   JPEG. Sans ça le rendu est trop propre pour passer pour une photo de
   téléphone. Le prompt demandait « ultra-realistic », ce qui produit
   l'inverse : une image parfaite, donc fausse.
3. **Verrouiller l'identité en détail.** « Keep the subject identical » est
   trop abstrait. Un modèle d'édition tient bien mieux une liste concrète :
   écartement des yeux, forme du nez, ligne de mâchoire, grains de beauté,
   implantation des cheveux.

### Ce qui a été fait

Création de `lib/scenes.ts` : **12 scènes au prompt figé, écrit et testable**
(rooftop, table gastronomique, jet privé, voiture de sport, villa avec
piscine, concert, plage, ski, yacht, rue parisienne, salle de sport, club).

Chaque prompt est assemblé en 6 blocs, dans un ordre délibéré — le modèle
pondère davantage le début :

1. **Verrou d'identité** (commun) — la liste concrète de ce qui ne bouge pas.
2. **Décor** (par scène) — lieu, heure, météo, matériaux.
3. **Lumière** (par scène) — direction, température en kelvins, contraste, et
   l'ordre explicite de ré-éclairer le sujet en conséquence.
4. **Caméra** (par scène) — focale équivalente, ouverture, hauteur, cadrage.
5. **Imperfections** (commun) — grain, bruit, écrêtage, compression.
6. **Interdits** (commun) — dont `Do not smooth, retouch, slim or beautify`.

Les blocs 1, 5 et 6 sont partagés : corriger le verrou d'identité une fois
améliore les douze scènes d'un coup.

Un détail qui compte : la note libre de l'utilisateur est insérée **entre** le
bloc 5 et le bloc 6, et présentée comme *« préférence secondaire, à honorer
seulement si elle n'entre pas en conflit avec les règles ci-dessus »*. Sans ce
cadrage, une note du type « rends-moi plus mince » écrasait le verrou
d'identité — c'est-à-dire exactement la chose qu'on ne veut jamais laisser
négocier. Un test verrouille ce comportement.

### Le flux « lieu perso » n'a pas été supprimé

C'est notre différenciateur : personne d'autre ne permet de fournir les photos
d'un vrai lieu. Il est simplement **replié derrière la grille de scènes** au
lieu de lui faire concurrence. Le parcours par défaut devient « je choisis une
scène », comme chez eux ; le lieu perso reste à un clic pour ceux qui le
veulent, et peut même se combiner à une scène (les photos servent alors de
référence visuelle, sans coûter l'appel d'analyse).

---

## Partie 2 — La vitesse

Deux vitesses différentes se cachent derrière « le site charge lentement ».
Les deux étaient dégradées, pour des raisons sans rapport.

### 2.1 — Le chargement de la page

Mesuré sur le build de production, avant modification :

| Poste | Coût | Détail |
| --- | --- | --- |
| **three.js** | **140 Ko gzip** (560 Ko bruts) | Deux chunks, pour le fond animé `ColorBends` |
| JS partagé | 87,5 Ko gzip | Framework + Supabase |
| Page studio `/` | 175 Ko gzip au total | |
| Polices | 292 Ko | 9 graisses déclarées |
| Mosaïque du hero | ~1,2 Mo d'images | **108 balises `<img>`** dans le DOM |

Le poste le plus lourd du premier chargement était donc un **élément purement
décoratif**. Pire, son timing était le pire possible : `dynamic()` déclenche
le téléchargement dès l'hydratation, donc en concurrence directe avec le
JavaScript dont la page a réellement besoin pour devenir utilisable.

Trois autres coûts s'ajoutaient :

- **Le middleware tournait sur toutes les pages.** Il rafraîchit la session
  Supabase, ce qui coûte un aller-retour réseau **avant** que la page puisse
  répondre. Sur la landing, les CGV ou les mentions légales — qui ne lisent
  aucune session — c'était du délai pur ajouté au TTFB.
- **La grille de la mosaïque du hero** répétait 18 vignettes trois fois, en
  double exemplaire par rangée : 108 nœuds pour une largeur que 72 couvraient
  déjà.
- **Les polices** déclaraient 9 graisses. Un `grep` sur le code montre que la
  police display n'est jamais utilisée qu'en `font-semibold` : trois graisses
  sur quatre étaient téléchargées pour rien.

**Ce qui a été fait**

- `ColorBends` + `DotField` ne se chargent plus qu'**après inactivité du
  navigateur** (`requestIdleCallback`), et **seulement si l'appareil peut se
  le permettre** : pas en mode économie de données, pas en 2G/3G, pas sous
  4 Go de RAM, pas sous 4 cœurs, pas sous `prefers-reduced-motion`. Un dégradé
  CSS statique qui reprend le rendu au repos tient la place — sur un téléphone
  d'entrée de gamme, il la tient définitivement. Sur ces appareils, 140 Ko de
  JS et un shader plein écran permanent disparaissent complètement.
- Middleware restreint à `/`, `/galerie`, `/compte`, `/tarifs` — les seules
  routes dont un Server Component lit la session.
- Polices : **292 Ko → 248 Ko** (mesuré sur build propre, avant/après).
- Mosaïque : 108 → 72 nœuds, et `fetchPriority="low"` pour qu'un décor posé
  derrière le titre cesse de disputer la bande passante au texte, qui porte
  le LCP.

### 2.2 — Le temps de génération

Le chemin d'une image, avant :

```
navigateur ──1── kie.ai (photo sujet)
           ──2── kie.ai (lieu 1)      ⎫ en série,
           ──3── kie.ai (lieu 2)      ⎬ l'un après
           ──4── kie.ai (lieu 3)      ⎭ l'autre
           ──5── /api/generate
                   ├─ 6. auth + profil + débit crédits
                   ├─ 7. analyse vision kie.ai      ← jusqu'à 45 s, en série
                   ├─ 8. re-télécharge les 4 images depuis kie.ai
                   │     puis les ré-encode en base64 (+33 % de volume)
                   ├─ 9. Gemini génère               ← 9 à 40 s
                   └─ 10. upload vers Supabase
           ←─11── URL du PNG pleine résolution
```

Trois anomalies :

1. **Les uploads étaient en série.** Avec trois photos de lieu, quatre
   allers-retours l'un après l'autre avant que la génération commence. Ils
   sont indépendants.
2. **L'analyse vision était en série avant la génération**, avec un timeout à
   45 s — sur un parcours qui dure déjà une minute.
3. **Les images font un aller-retour pour rien.** Le navigateur détient déjà
   les octets. Il les envoie à kie.ai, obtient une URL, et notre fonction
   Vercel **re-télécharge ces mêmes octets** pour les ré-encoder en base64 et
   les envoyer à Google. Les octets voyagent : navigateur → Vercel → kie.ai →
   Vercel → Google → Vercel → Supabase → navigateur.

**Ce qui a été fait**

- Uploads **parallélisés** (avec le contrôle de taille déplacé *avant* le
  premier envoi, pour ne plus pousser des fichiers avant de découvrir un
  dépassement).
- L'analyse vision **disparaît du chemin principal** : une scène porte son
  prompt, il n'y a plus rien à analyser. kie.ai n'est plus appelé que sur le
  flux « lieu perso », et sa clé n'est désormais vérifiée que là — une
  génération par scène ne peut plus échouer sur une clé dont elle n'a pas
  l'usage.

Le point 3 (l'aller-retour des octets) reste ouvert — voir « suite » plus bas.

### 2.3 — L'affichage du résultat : le plus gros angle mort

Gemini renvoie du **PNG**. Nous le stockons tel quel et le servons tel quel.

| Palier | Résolution | PNG typique |
| --- | --- | --- |
| Découverte | 1K | ~2 Mo |
| Essentiel | 2K | ~6 Mo |
| Ultimate | 4K | **15 à 25 Mo** |

Un abonné Ultimate attend donc la génération… puis attend encore le
téléchargement de 20 Mo avant de voir quoi que ce soit. En WebP qualité 82, la
même image pèse 5 à 10 fois moins **sans différence visible à l'écran**.

Et surtout — le défaut le plus coûteux trouvé dans cette revue :

> **La galerie affichait la vignette carrée de chaque entrée en téléchargeant
> le fichier pleine résolution.** Vingt générations en 2K, c'était ~120 Mo
> téléchargés pour afficher une grille de carrés de 300 px. Les vidéos de la
> grille étaient mises en mémoire tampon toutes en parallèle, sans
> `preload="none"`.

**Ce qui a été fait** — chargement différé et `decoding="async"` sur les
vignettes, `preload="none"` sur les vidéos de la grille, `fetchPriority="high"`
sur l'image que l'utilisateur vient d'ouvrir et sur le résultat du studio.
C'est déjà l'essentiel du gain sur la galerie.

**Ce qui reste** — la conversion en WebP. Elle demande `sharp`, une dépendance
native que je n'ai pas voulu ajouter sans pouvoir valider le déploiement dans
cette session : une dépendance native qui casse au build se découvre en
production. C'est le premier chantier de la suite, et de loin le plus
rentable.

---

## Partie 3 — fal.ai, AI Studio : le même modèle donne-t-il le même résultat ?

C'est la question la plus intéressante des trois, et la réponse est en deux
temps.

### Non, le fournisseur ne change pas le modèle

Les poids de Nano Banana Pro **ne sont pas publiés**. Personne d'autre que
Google ne peut le faire tourner. Quand fal.ai, kie.ai, Replicate ou OpenRouter
proposent `nano-banana-pro`, ils **relaient l'API de Google**. Il n'y a qu'un
seul modèle, sur les machines de Google, dans tous les cas.

Corollaires directs :

- La qualité intrinsèque est **la même partout**. Un fournisseur ne peut pas
  « mieux » faire tourner un modèle auquel il n'a accès que par API.
- Le filigrane **SynthID est présent dans tous les cas** — il est appliqué par
  Google, pas par le relais. Changer de fournisseur ne l'enlève pas.
- Un fournisseur ne peut jouer que sur ce qu'il y a **autour** : sa file
  d'attente, sa latence réseau, son prix, son hébergement de fichiers.

### Oui, le rendu peut quand même différer — pour quatre raisons

C'est là que se loge l'illusion « fal.ai rend mieux ».

**1. Les paramètres par défaut ne sont pas les mêmes.**
fal.ai expose `aspect_ratio` (défaut `auto`), `output_format` (souvent
`jpeg`), `resolution` (défaut `1K`), `safety_tolerance`, `num_images`. L'API
Gemini directe expose `imageConfig.aspectRatio` et `imageConfig.imageSize`.
Si un appel demande 2K en PNG et l'autre 1K en JPEG, la comparaison ne porte
pas sur le fournisseur mais sur les réglages. C'est de très loin la cause la
plus fréquente d'un écart constaté.

**2. Le prétraitement des images d'entrée diffère.**
Nous envoyons des URLs ; le relais les télécharge et les transmet. Rien ne
garantit qu'il ne les redimensionne ni ne les ré-encode au passage. Une photo
de visage passée en JPEG de qualité moyenne avant d'atteindre le modèle perd
précisément le détail dont dépend la ressemblance. Notre propre chaîne fait
déjà ça une fois : compression client à 1536 px en JPEG 0.9.

**3. Le post-traitement diffère.**
Le format de sortie (PNG contre JPEG) et son taux de compression sont des
choix du relais. Deux images identiques en sortie de modèle peuvent arriver
avec des niveaux d'artefacts différents.

**4. Le modèle n'est pas déterministe.**
Sans graine fixée, deux appels **strictement identiques** au **même**
fournisseur donnent deux images différentes. Une comparaison sur un seul essai
par fournisseur ne mesure rien d'autre que cette variance.

### Ce qu'il faut en conclure pour le produit

Changer de fournisseur pour améliorer la qualité est une fausse piste : il n'y
a rien à gagner sur le rendu, parce que c'est le même modèle. Les vrais
leviers, dans l'ordre de rentabilité :

1. **Le prompt** — ce qu'a fait la partie 1. C'est le seul levier qui change
   vraiment le rendu.
2. **Les paramètres explicites** — résolution, ratio, format. Ne jamais
   laisser un défaut de fournisseur décider à notre place.
3. **La qualité de l'image d'entrée** — notre compression client à 1536 px est
   probablement trop agressive pour la préservation du visage. À tester.
4. **Le fournisseur** — uniquement pour la latence, le prix et la fiabilité.
   Jamais pour la qualité.

Et si on veut malgré tout trancher par la mesure, le protocole est simple, et
c'est le seul qui vaille : **même prompt, même image, mêmes paramètres
explicites, 10 générations par fournisseur**, puis comparaison des
distributions — pas des exemplaires. Un essai contre un essai ne mesure que le
hasard.

> Note : je n'ai pas pu ouvrir `fal.ai` depuis cette session (bloqué par la
> politique d'egress), donc les paramètres cités viennent de résultats de
> recherche et non de leur documentation lue directement. À revérifier avant
> de s'appuyer dessus pour un chiffrage.

---

## Un point hors sujet, mais à ne pas laisser passer

Le bucket Supabase `gallery` est servi en **URL publique**
(`getPublicUrl`). La RLS protège la *table* `gallery_entries`, mais pas les
*fichiers* : toute personne connaissant l'URL d'une image peut l'ouvrir, sans
compte.

Or la FAQ de la landing affirme : « Ta Galerie est privée et rattachée à ton
seul compte. » Sur un produit qui manipule des photos de visages, l'écart
entre les deux mérite d'être corrigé — en URLs signées à durée limitée — ou
la promesse d'être reformulée. Les URLs contiennent un UUID aléatoire, donc
elles ne sont pas devinables ; mais « non devinable » n'est pas « privé », et
ce n'est pas ce qui est promis.

---

## Suite — par rentabilité décroissante

1. **Sortie WebP** (`sharp` côté serveur, ou transformations Supabase
   Storage). Divise par 5 à 10 le poids de chaque résultat et de chaque
   vignette. Le plus gros gain restant sur « ça charge lentement ».
2. **Supprimer l'aller-retour kie.ai des octets** — uploader directement du
   navigateur vers Supabase Storage via URL signée. Retire deux traversées
   réseau complètes du parcours, et une dépendance externe.
3. **Vignettes de galerie dédiées** — stocker une miniature de 400 px à la
   génération, au lieu de servir le fichier maître.
4. **Mesurer réellement contre usenoway.com** — PageSpeed Insights sur les
   deux, depuis un poste non restreint. Cinq minutes, et ça remplace toutes
   les hypothèses de la partie 2.1 par des chiffres.
5. **Élargir le catalogue** à partir des données d'usage : quelles scènes sont
   choisies, lesquelles sont régénérées (signal d'un prompt à corriger).
6. **Le faux chargement de 6 secondes du paywall** (`PAYWALL_PREVIEW_DELAY_MS`)
   fait attendre un visiteur pour lui montrer une image d'exemple floutée qui
   n'est pas la sienne. À reconsidérer : une première génération réelle
   offerte convertit généralement mieux qu'un aperçu simulé — mais c'est une
   décision produit, pas technique.
7. **URLs signées** pour le bucket galerie (voir ci-dessus).
