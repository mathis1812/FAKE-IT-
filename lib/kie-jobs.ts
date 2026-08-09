const KIE_API_BASE = "https://api.kie.ai/api/v1";

type KieCreateTaskResponse = {
  code: number;
  msg?: string;
  data?: { taskId?: string };
};

type KieTaskStatusResponse = {
  code: number;
  msg?: string;
  data?: {
    state?: "waiting" | "queuing" | "generating" | "success" | "fail";
    resultJson?: string;
    failMsg?: string;
  };
};

type KieResult = { resultUrls?: string[] };

/** Crée une tâche asynchrone kie.ai (createTask) et renvoie son taskId. */
export async function createKieTask(
  apiKey: string,
  model: string,
  input: Record<string, unknown>,
): Promise<string> {
  const res = await fetch(`${KIE_API_BASE}/jobs/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, input }),
  });

  let json: KieCreateTaskResponse;
  try {
    json = await res.json();
  } catch {
    throw new Error("Réponse illisible de kie.ai à la création de la tâche.");
  }

  if (!res.ok || json.code !== 200 || !json.data?.taskId) {
    throw new Error(
      json.msg || `Erreur kie.ai (${res.status}) à la création de la tâche.`,
    );
  }
  return json.data.taskId;
}

/**
 * Interroge une tâche kie.ai (recordInfo) jusqu'à succès/échec/délai et
 * renvoie l'URL du premier résultat (image ou vidéo selon le modèle).
 * Lance une Error("TIMEOUT") si le délai est dépassé.
 */
export async function pollKieTask(
  apiKey: string,
  taskId: string,
  options: { intervalMs: number; timeoutMs: number },
): Promise<string> {
  const deadline = Date.now() + options.timeoutMs;

  while (Date.now() < deadline) {
    const res = await fetch(
      `${KIE_API_BASE}/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    let json: KieTaskStatusResponse;
    try {
      json = await res.json();
    } catch {
      throw new Error("Réponse illisible de kie.ai en interrogeant la tâche.");
    }

    if (!res.ok || json.code !== 200) {
      throw new Error(
        json.msg || `Erreur kie.ai (${res.status}) en interrogeant la tâche.`,
      );
    }

    if (json.data?.state === "success") {
      let result: KieResult;
      try {
        result = JSON.parse(json.data.resultJson ?? "{}");
      } catch {
        throw new Error("Réponse de résultat kie.ai illisible.");
      }
      const url = result.resultUrls?.[0];
      if (!url) {
        throw new Error("La tâche a réussi mais aucun résultat n'a été renvoyé.");
      }
      return url;
    }

    if (json.data?.state === "fail") {
      throw new Error(json.data.failMsg || "La génération a échoué côté kie.ai.");
    }

    // "waiting" | "queuing" | "generating" (ou tout autre état en cours) :
    // on continue d'interroger.
    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  }

  throw new Error("TIMEOUT");
}
