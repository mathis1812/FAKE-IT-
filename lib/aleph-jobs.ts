const KIE_API_BASE = "https://api.kie.ai/api/v1";

type AlephCreateResponse = {
  code?: number;
  msg?: string;
  data?: { taskId?: string };
};

type AlephRecordResponse = {
  code?: number;
  msg?: string;
  errorCode?: number;
  errorMessage?: string;
  data?: {
    successFlag?: number;
    errorCode?: number;
    errorMessage?: string;
    response?: { resultVideoUrl?: string };
  };
};

/** Formats d'image acceptés par l'endpoint Aleph de kie.ai. */
const SUPPORTED_ASPECT_RATIOS: { label: string; value: number }[] = [
  { label: "21:9", value: 21 / 9 },
  { label: "16:9", value: 16 / 9 },
  { label: "4:3", value: 4 / 3 },
  { label: "1:1", value: 1 },
  { label: "3:4", value: 3 / 4 },
  { label: "9:16", value: 9 / 16 },
];

/**
 * Choisit le format Aleph le plus proche de celui de la vidéo source. Sans
 * ça, Aleph appliquerait son format par défaut et recadrerait une vidéo
 * verticale en paysage (perte de cadrage et de qualité perçue).
 */
export function nearestAspectRatio(width: number, height: number): string {
  if (!width || !height) return "16:9";
  const source = width / height;
  return SUPPORTED_ASPECT_RATIOS.reduce((best, candidate) =>
    Math.abs(candidate.value - source) < Math.abs(best.value - source)
      ? candidate
      : best,
  ).label;
}

async function parseKieJson<T>(
  res: Response,
  context: string,
): Promise<{ json: T; raw: string }> {
  const raw = await res.text();
  try {
    return { json: JSON.parse(raw) as T, raw };
  } catch {
    throw new Error(
      `Réponse kie.ai illisible ${context} (HTTP ${res.status}) : ${raw.slice(0, 300) || "(corps vide)"}`,
    );
  }
}

/** Lance une génération Runway Aleph (video-to-video) et renvoie son taskId. */
export async function createAlephTask(
  apiKey: string,
  input: {
    prompt: string;
    videoUrl: string;
    referenceImage?: string;
    aspectRatio?: string;
  },
): Promise<string> {
  const res = await fetch(`${KIE_API_BASE}/aleph/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: input.prompt,
      videoUrl: input.videoUrl,
      ...(input.referenceImage ? { referenceImage: input.referenceImage } : {}),
      ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
      waterMark: "",
    }),
  });

  const { json, raw } = await parseKieJson<AlephCreateResponse>(
    res,
    "à la création de la tâche Aleph",
  );

  if (!res.ok || json.code !== 200 || !json.data?.taskId) {
    throw new Error(
      `Erreur kie.ai (${res.status}) à la création de la tâche Aleph : ${raw.slice(0, 300)}`,
    );
  }
  return json.data.taskId;
}

/**
 * Interroge une tâche Aleph jusqu'à succès/échec/délai et renvoie l'URL de
 * la vidéo résultat. Lance une Error("TIMEOUT") si le délai est dépassé.
 *
 * `successFlag` vaut 0 aussi bien pour « en cours » que pour « échoué » :
 * seule la présence d'un errorCode/errorMessage distingue les deux, d'où
 * la vérification explicite avant de continuer à attendre.
 */
export async function pollAlephTask(
  apiKey: string,
  taskId: string,
  options: { intervalMs: number; timeoutMs: number },
): Promise<string> {
  const deadline = Date.now() + options.timeoutMs;
  const headers = { Authorization: `Bearer ${apiKey}` };

  while (Date.now() < deadline) {
    const res = await fetch(
      `${KIE_API_BASE}/aleph/record-info?taskId=${encodeURIComponent(taskId)}`,
      { headers },
    );

    const { json, raw } = await parseKieJson<AlephRecordResponse>(
      res,
      "en interrogeant la tâche Aleph",
    );

    if (!res.ok || json.code !== 200) {
      throw new Error(
        `Erreur kie.ai (${res.status}) en interrogeant la tâche Aleph : ${raw.slice(0, 300)}`,
      );
    }

    const errorCode = json.data?.errorCode ?? json.errorCode;
    const errorMessage = json.data?.errorMessage ?? json.errorMessage;
    if ((errorCode && errorCode !== 0) || errorMessage) {
      throw new Error(
        `La génération Aleph a échoué : ${errorMessage || `code ${errorCode}`}`,
      );
    }

    if (json.data?.successFlag === 1) {
      const url = json.data.response?.resultVideoUrl;
      if (!url) {
        throw new Error(
          "La tâche Aleph a réussi mais aucune vidéo n'a été renvoyée.",
        );
      }
      return url;
    }

    await new Promise((resolve) => setTimeout(resolve, options.intervalMs));
  }

  throw new Error("TIMEOUT");
}
