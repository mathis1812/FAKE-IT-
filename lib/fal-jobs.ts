const FAL_QUEUE_BASE = "https://queue.fal.run";

type FalSubmitResponse = {
  request_id?: string;
  status_url?: string;
  response_url?: string;
};

type FalStatusResponse = {
  status?: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED";
};

type FalResultResponse = {
  images?: { url?: string }[];
  video?: { url?: string };
};

export type FalTask = {
  statusUrl: string;
  responseUrl: string;
};

/**
 * Lit une réponse fal.ai en JSON. Si le corps n'est pas du JSON valide (page
 * d'erreur HTML, corps vide…), l'erreur inclut le code HTTP et un extrait du
 * corps brut plutôt qu'un message générique "illisible" qui masquerait la
 * vraie cause (mauvaise clé, requête invalide…).
 */
async function parseFalJson<T>(res: Response, context: string): Promise<T> {
  const raw = await res.text();
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      `Réponse fal.ai illisible ${context} (HTTP ${res.status}) : ${raw.slice(0, 300) || "(corps vide)"}`,
    );
  }
}

/**
 * Soumet une tâche à la queue fal.ai. Renvoie les URLs de statut/résultat
 * fournies par fal.ai lui-même (plutôt que de les reconstruire à partir du
 * modelPath) : le sous-chemin d'un endpoint (ex. "/edit") ne fait pas partie
 * du chemin de statut/résultat, seule la réponse de soumission donne les
 * bonnes URLs de façon fiable.
 */
export async function createFalTask(
  apiKey: string,
  modelPath: string,
  input: Record<string, unknown>,
): Promise<FalTask> {
  const res = await fetch(`${FAL_QUEUE_BASE}/${modelPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify(input),
  });

  const json = await parseFalJson<FalSubmitResponse>(
    res,
    "à la création de la tâche",
  );

  if (!res.ok || !json.request_id || !json.status_url || !json.response_url) {
    throw new Error(`Erreur fal.ai (${res.status}) à la création de la tâche.`);
  }
  return { statusUrl: json.status_url, responseUrl: json.response_url };
}

/**
 * Interroge une tâche fal.ai jusqu'à succès/délai et renvoie l'URL du
 * premier résultat. Lance une Error("TIMEOUT") si le délai est dépassé.
 */
export async function pollFalTask(
  apiKey: string,
  task: FalTask,
  options: { intervalMs: number; timeoutMs: number },
): Promise<string> {
  const deadline = Date.now() + options.timeoutMs;
  const headers = { Authorization: `Key ${apiKey}` };

  while (Date.now() < deadline) {
    const statusRes = await fetch(task.statusUrl, { headers });

    const statusJson = await parseFalJson<FalStatusResponse>(
      statusRes,
      "en interrogeant la tâche",
    );

    if (!statusRes.ok) {
      throw new Error(
        `Erreur fal.ai (${statusRes.status}) en interrogeant la tâche.`,
      );
    }

    if (statusJson.status === "COMPLETED") {
      const resultRes = await fetch(task.responseUrl, { headers });
      const resultJson = await parseFalJson<FalResultResponse>(
        resultRes,
        "en récupérant le résultat",
      );
      if (!resultRes.ok) {
        throw new Error(
          `Erreur fal.ai (${resultRes.status}) en récupérant le résultat.`,
        );
      }
      const url = resultJson.images?.[0]?.url ?? resultJson.video?.url;
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
