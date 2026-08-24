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
 * Lit une réponse fal.ai en JSON, quel que soit son code HTTP. Si le corps
 * n'est pas du JSON valide (page d'erreur HTML, corps vide…), l'erreur
 * inclut le code HTTP et un extrait du corps brut. Le texte brut est
 * toujours renvoyé aussi, pour que l'appelant puisse l'inclure dans ses
 * propres messages d'erreur (ex. détail d'une validation refusée par
 * fal.ai) plutôt que de se limiter au code HTTP nu.
 */
async function parseFalJson<T>(
  res: Response,
  context: string,
): Promise<{ json: T; raw: string }> {
  const raw = await res.text();
  try {
    return { json: JSON.parse(raw) as T, raw };
  } catch {
    throw new Error(
      `Unreadable fal.ai response ${context} (HTTP ${res.status}): ${raw.slice(0, 300) || "(empty body)"}`,
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

  const { json, raw } = await parseFalJson<FalSubmitResponse>(
    res,
    "creating the task",
  );

  if (!res.ok || !json.request_id || !json.status_url || !json.response_url) {
    throw new Error(
      `fal.ai error (${res.status}) creating the task: ${raw.slice(0, 300)}`,
    );
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

    const { json: statusJson, raw: statusRaw } =
      await parseFalJson<FalStatusResponse>(statusRes, "polling the task");

    if (!statusRes.ok) {
      throw new Error(
        `fal.ai error (${statusRes.status}) polling the task: ${statusRaw.slice(0, 300)}`,
      );
    }

    if (statusJson.status === "COMPLETED") {
      const resultRes = await fetch(task.responseUrl, { headers });
      const { json: resultJson, raw: resultRaw } =
        await parseFalJson<FalResultResponse>(resultRes, "fetching the result");
      if (!resultRes.ok) {
        throw new Error(
          `fal.ai error (${resultRes.status}) fetching the result: ${resultRaw.slice(0, 300)}`,
        );
      }
      const url = resultJson.images?.[0]?.url ?? resultJson.video?.url;
      if (!url) {
        throw new Error("The task succeeded but no result was returned.");
      }
      return url;
    }

    // "IN_QUEUE" | "IN_PROGRESS" (or any other in-progress state): keep polling.
    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  }

  throw new Error("TIMEOUT");
}
