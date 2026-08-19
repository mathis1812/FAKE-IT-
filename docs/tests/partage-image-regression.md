# Checklist de régression — Bouton de partage image (iOS)

> **Contexte**  
> Les fonctions `shareToSnapchat` et `sendAsRedSnap` dans `app/page.tsx` doivent gérer  
> correctement tous les cas d'échec de l'API Web Share (iOS + Android).  
> Dans chaque cas d'erreur, le bouton doit se déverrouiller (`sharing` / `sendingRedSnap`  
> revient à `false`) et un message actionnable s'affiche — ou rien si l'utilisateur a  
> simplement annulé.

---

## Pré-requis

| Élément | Valeur attendue |
|---|---|
| Appareil | iPhone (iOS 14+) ou simulateur Safari |
| Navigateur | Safari (seul navigateur iOS supportant `navigator.share`) |
| Résultat généré | Une photo résultat doit être présente dans l'UI avant de tester |

---

## Cas 1 — Annulation par l'utilisateur (AbortError)

**Scénario** : L'utilisateur appuie sur « Partager sur Snapchat » ou « Envoyer en Snap Rouge »,  
puis ferme la fiche de partage iOS sans choisir d'application.

**Étapes** :
1. Générer une photo résultat.
2. Appuyer sur **Partager sur Snapchat** (ou **Envoyer en Snap Rouge**).
3. La fiche de partage iOS s'ouvre → faire glisser vers le bas pour l'annuler.

**Résultats attendus** :
- [ ] Le bouton redevient cliquable immédiatement après la fermeture.
- [ ] **Aucun** message d'erreur n'est affiché (l'annulation est silencieuse).
- [ ] L'état `sharing` / `sendingRedSnap` est `false` (pas de spinner bloqué).

---

## Cas 2 — Permission refusée (NotAllowedError)

**Scénario** : L'OS refuse l'opération de partage (ex : permission révoquée, appel hors  
geste utilisateur sur certaines versions iOS).

**Simulation (DevTools Safari)** :
```javascript
// Dans la console, avant de cliquer :
const orig = navigator.share;
navigator.share = () => Promise.reject(
  Object.assign(new DOMException('Permission denied', 'NotAllowedError'))
);
// Cliquer sur le bouton, puis remettre l'original :
navigator.share = orig;
```

**Résultats attendus** :
- [ ] Le bouton redevient cliquable.
- [ ] Un message d'erreur apparaît (ex : *« Le partage de la photo est impossible pour le moment. »*).
- [ ] Le message n'est **pas** vide et n'est **pas** silencieux (≠ AbortError).

---

## Cas 3 — Partage non supporté (NotSupportedError)

**Scénario** : Le navigateur ou la version iOS ne supporte pas le partage de fichiers.

**Simulation** :
```javascript
const orig = navigator.share;
navigator.share = () => Promise.reject(
  Object.assign(new DOMException('Not supported', 'NotSupportedError'))
);
// Cliquer sur le bouton, puis remettre l'original :
navigator.share = orig;
```

**Résultats attendus** :
- [ ] Le bouton redevient cliquable.
- [ ] Un message d'erreur actionnable s'affiche.
- [ ] L'état n'est pas bloqué.

---

## Cas 4 — Fetch échoue (lien expiré / réseau)

**Scénario** : L'URL du résultat est invalide ou a expiré (erreur réseau lors du  
téléchargement de l'image avant partage).

**Simulation** :
```javascript
const origFetch = window.fetch;
window.fetch = () => Promise.resolve(new Response(null, { status: 404 }));
// Cliquer sur le bouton, puis remettre l'original :
window.fetch = origFetch;
```

**Résultats attendus** :
- [ ] Le bouton redevient cliquable.
- [ ] Le message *« Le résultat ne peut pas être préparé pour le partage. »* (ou équivalent) s'affiche.
- [ ] Pas de spinner bloqué.

---

## Cas 5 — Flux nominal (régression)

**Scénario** : Partage réussi — vérifier qu'aucune régression n'a été introduite.

**Étapes** :
1. Générer une photo résultat.
2. Appuyer sur **Partager sur Snapchat**.
3. Choisir une application dans la fiche de partage.

**Résultats attendus** :
- [ ] La fiche de partage iOS s'ouvre avec l'image.
- [ ] Après sélection d'une app, le bouton revient à son état normal.
- [ ] Aucun message d'erreur.

---

## Matrice de couverture

| Cas | `shareToSnapchat` | `sendAsRedSnap` |
|---|---|---|
| Annulation (AbortError) | ✅ à tester | ✅ à tester |
| NotAllowedError | ✅ à tester | ✅ à tester |
| NotSupportedError | ✅ à tester | ✅ à tester |
| Fetch échoue (404) | ✅ à tester | ✅ à tester |
| Flux nominal | ✅ à tester | ✅ à tester |

---

## Implémentation de référence (`app/page.tsx`)

Les deux fonctions partagent la même structure de gestion d'erreur :

```typescript
} catch (err) {
  // Annulation silencieuse — ne pas afficher de message
  if (err instanceof DOMException && err.name === 'AbortError') return;
  // Toute autre erreur → message actionnable
  setError(
    err instanceof Error
      ? err.message
      : 'Le partage de la photo est impossible pour le moment.',
  );
} finally {
  // Toujours déverrouiller le bouton
  setSharing(false); // ou setSendingRedSnap(false)
}
```

---

*Mis à jour le : 2026-08-19*
