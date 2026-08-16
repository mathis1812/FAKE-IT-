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
      throw new Error(
        `Erreur fal.ai (${statusRes.status}) en interrogeant la tâche.`,
      );
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
        throw new Error(
          `Erreur fal.ai (${resultRes.status}) en récupérant le résultat.`,
        );
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
