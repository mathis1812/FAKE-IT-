# Remplacer kie.ai par fal.ai pour la génération photo (test de rapidité)

**Date**: 2026-08-10
**Statut**: Approuvé, prêt pour planification

## Contexte

L'utilisateur veut comparer la rapidité de génération photo entre kie.ai
(fournisseur actuel, `app/api/generate/route.ts`) et fal.ai, en gardant le
même modèle sous-jacent (nano-banana-pro / Gemini 3 Pro Image). C'est un
test, pas une bascule permanente décidée à l'avance — mais la demande
explicite est un **remplacement direct** de la route photo (pas un
toggle/flag entre providers), pour simplicité. La route vidéo
(`app/api/generate-video/route.ts`) n'est pas concernée et reste sur
kie.ai.

Le projet a déjà utilisé fal.ai par le passé (avant la migration vers
kie.ai du 2026-08-07, qui a retiré le package npm `@fal-ai/client` et tout
le code fal.ai du repo — `git log`, commit "Nettoyage fal.ai du repo").
Ce chantier ne réutilise pas ce SDK : il suit le pattern déjà en place
pour kie.ai (`lib/kie-jobs.ts`), du `fetch` brut sans dépendance
supplémentaire.

## Schéma fal.ai confirmé

Recherche faite via docs.fal.ai et la page modèle fal.ai (contrairement à
la tentative video-to-video du 2026-07-29, ici le schéma a pu être
confirmé sans blocage 429/403) :

- **Endpoint** : `fal-ai/nano-banana-pro/edit` (édition d'image avec
  référence(s), correspond à notre usage image source + objet optionnel).
- **Soumission** : `POST https://queue.fal.run/fal-ai/nano-banana-pro/edit`
  Header : `Authorization: Key {FAL_API_KEY}`
  Body : `{ prompt: string, image_urls: string[], resolution?: "1K"|"2K"|"4K", output_format?: "jpeg"|"png"|"webp", aspect_ratio?: string }`
  Réponse : `{ request_id: string, status_url, response_url, ... }`
- **Statut** : `GET https://queue.fal.run/fal-ai/nano-banana-pro/edit/requests/{request_id}/status`
  Réponse contient un champ `status` (`IN_QUEUE` | `IN_PROGRESS` | `COMPLETED` selon la doc).
- **Résultat** : `GET https://queue.fal.run/fal-ai/nano-banana-pro/edit/requests/{request_id}`
  Réponse : `{ images: [{ url, content_type, file_name, file_size, width, height }], description }`

## Décisions validées avec l'utilisateur

- **Remplacement direct**, pas de toggle entre providers — YAGNI, c'est un
  test explicitement cadré comme un remplacement.
- **Photo uniquement** — `app/api/generate-video/route.ts` reste
  inchangé, toujours kie.ai.
- **Résolution dynamique par palier conservée** — la logique existante
  (`PLANS[planId]?.imageResolution`) ne change pas, seul le provider
  destinataire de cette valeur change.
- **Variable d'environnement** : `FAL_API_KEY` — nouvelle, à ajouter par
  l'utilisateur (jamais manipulée par Claude, ni en local ni sur Vercel).

## Design

### 1. Nouveau fichier `lib/fal-jobs.ts`

Miroir de `lib/kie-jobs.ts` (même style : `fetch` brut, pas de SDK, deux
fonctions exportées avec un contrat équivalent pour que la route n'ait
presque rien à changer) :

```ts
const FAL_QUEUE_BASE = "https://queue.fal.run";

type FalSubmitResponse = {
  request_id?: string;
};

type FalStatusResponse = {
  status?: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
};

type FalResultResponse = {
  images?: { url?: string }[];
};

/** Soumet une tâche à la queue fal.ai et renvoie son request_id. */
export async function createFalTask(
  apiKey: string,
  modelPath: string,
  input: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${FAL_QUEUE_BASE}/${modelPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify(input),
  });

  let json: FalSubmitResponse;
  try {
    json = await res.json();
  } catch {
    throw new Error("Réponse illisible de fal.ai à la création de la tâche.");
  }

  if (!res.ok || !json.request_id) {
    throw new Error(`Erreur fal.ai (${res.status}) à la création de la tâche.`);
  }
  return json.request_id;
}

/**
 * Interroge une tâche fal.ai jusqu'à succès/délai et renvoie l'URL du
 * premier résultat. Lance une Error("TIMEOUT") si le délai est dépassé.
 */
export async function pollFalTask(
  apiKey: string,
  modelPath: string,
  requestId: string,
  options: { intervalMs: number; timeoutMs: number },
): Promise<string> {
  const deadline = Date.now() + options.timeoutMs;
  const headers = { Authorization: `Key ${apiKey}` };

  while (Date.now() < deadline) {
    const statusRes = await fetch(
      `${FAL_QUEUE_BASE}/${modelPath}/requests/${requestId}/status`,
      { headers },
    );

    let statusJson: FalStatusResponse;
    try {
      statusJson = await statusRes.json();
    } catch {
      throw new Error("Réponse de statut fal.ai illisible.");
    }

    if (!statusRes.ok) {
      throw new Error(`Erreur fal.ai (${statusRes.status}) en interrogeant la tâche.`);
    }

    if (statusJson.status === "COMPLETED") {
      const resultRes = await fetch(
        `${FAL_QUEUE_BASE}/${modelPath}/requests/${requestId}`,
        { headers },
      );
      let resultJson: FalResultResponse;
      try {
        resultJson = await resultRes.json();
      } catch {
        throw new Error("Réponse de résultat fal.ai illisible.");
      }
      if (!resultRes.ok) {
        throw new Error(`Erreur fal.ai (${resultRes.status}) en récupérant le résultat.`);
      }
      const url = resultJson.images?.[0]?.url;
      if (!url) {
        throw new Error("La tâche a réussi mais aucun résultat n'a été renvoyé.");
      }
      return url;
    }

    // "IN_QUEUE" | "IN_PROGRESS" (ou tout autre état en cours) : on continue.
    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  }

  throw new Error("TIMEOUT");
}
```

### 2. `app/api/generate/route.ts`

Changements ciblés (le reste du fichier — auth, crédits, résolution
dynamique par palier, `persistImageResult`, gestion d'erreur — reste
identique) :

- Import : `import { createFalTask, pollFalTask } from "@/lib/fal-jobs";`
  (remplace l'import de `lib/kie-jobs`).
- `const MODEL_ID = "fal-ai/nano-banana-pro/edit";` (remplace
  `"nano-banana-pro"`).
- Lecture de la clé : `const apiKey = process.env.FAL_API_KEY?.trim();`
  (remplace `KIE_API_KEY`), même message d'erreur adapté : "Clé API
  manquante. Définissez FAL_API_KEY dans vos variables d'environnement."
- Appel de création de tâche :
  ```ts
  const requestId = await createFalTask(apiKey, MODEL_ID, {
    prompt: finalPrompt,
    image_urls: imageInput,
    resolution,
    output_format: "png",
  });
  const resultUrl = await pollFalTask(apiKey, MODEL_ID, requestId, {
    intervalMs: POLL_INTERVAL_MS,
    timeoutMs: POLL_TIMEOUT_MS,
  });
  ```
  (remplace l'appel à `createKieTask`/`pollKieTask` — noter que
  `pollFalTask` prend un paramètre `requestId` séparé, contrairement à
  `pollKieTask` qui prenait `taskId` en 2e position ; adapter l'appel en
  conséquence, pas juste renommer la fonction).
- Pas de champ `aspect_ratio` envoyé (comportement par défaut `auto` côté
  fal.ai, cohérent avec l'absence de choix explicite côté kie.ai
  aujourd'hui).

### Data flow

Inchangé au-delà du provider : `resolution` reste calculée depuis
`PLANS[planId]?.imageResolution` (feature déjà en place), `imageInput`
reste le tableau `[sourceImageUrl, objectImageUrl?]` déjà construit plus
haut dans la route.

### Gestion d'erreur

Même structure qu'aujourd'hui : le `catch` englobant reste inchangé
(rembourse les crédits, distingue `TIMEOUT` d'une autre erreur), seul le
message d'erreur générique mentionne "fal.ai" au lieu de "kie.ai" pour
rester honnête sur l'origine de l'erreur.

## Hors scope

- Route vidéo — reste 100% kie.ai.
- Tout mécanisme de bascule/comparaison A/B entre providers.
- Suppression de `lib/kie-jobs.ts` — reste utilisé par la route vidéo,
  ne pas y toucher.
- Ajout du package `@fal-ai/client` — fetch brut uniquement.

## Fichiers concernés

- Créer : `lib/fal-jobs.ts`.
- Modifier : `app/api/generate/route.ts`.
