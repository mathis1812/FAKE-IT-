/**
 * lib/share-utils.ts
 *
 * Extracted share-button handlers for the Bluminoo web app.
 * Keeping them here (rather than inline in app/page.tsx) lets Vitest import
 * the exact production functions — no duplication, no drift.
 *
 * Imported by:
 *   - app/page.tsx  (production React component)
 *   - __tests__/share-button.test.tsx  (Vitest regression suite)
 */

// ── Constants ────────────────────────────────────────────────────────────────

export const SNAP_SHARE_MAX_DIMENSION = 1600;
export const SNAP_SHARE_JPEG_QUALITY = 0.85;

/**
 * Official Snapchat "Camera Roll" lens — opens directly in Snapchat's camera
 * on mobile, letting the user pick a photo from their library and apply it as
 * a filter without having to search manually.
 */
export const SNAP_UPLOAD_LENS_URL =
  "https://www.snapchat.com/lens/a9cd4b5d2687457eb0be82bd332a2a74";

// ── prepareShareFile ─────────────────────────────────────────────────────────

/**
 * Converts the result (often a high-resolution PNG) into a resized JPEG before
 * passing it to navigator.share(). Snapchat share-extensions on iOS have very
 * limited memory and display a black screen / crash with large PNGs; a lighter
 * JPEG fixes the problem.
 */
export async function prepareShareFile(blob: Blob): Promise<File> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image illisible."));
      image.src = objectUrl;
    });

    const { width, height } = img;
    const longSide = Math.max(width, height);
    const scale =
      longSide > SNAP_SHARE_MAX_DIMENSION
        ? SNAP_SHARE_MAX_DIMENSION / longSide
        : 1;
    const targetW = Math.round(width * scale);
    const targetH = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Préparation du partage impossible.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const shareBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", SNAP_SHARE_JPEG_QUALITY),
    );
    if (!shareBlob) throw new Error("Préparation du partage impossible.");

    return new File([shareBlob], "bluminoo-result.jpg", {
      type: "image/jpeg",
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// ── Shared types ─────────────────────────────────────────────────────────────

/** Injectable dependencies — swap out heavy browser APIs in tests. */
export interface ShareDeps {
  /** Convert the raw result blob to the final File to share. Defaults to prepareShareFile. */
  prepareFile?: (blob: Blob) => Promise<File>;
  /** Override window.location.href assignment (used by sendAsRedSnap). */
  redirect?: (url: string) => void;
}

// ── shareToSnapchat ──────────────────────────────────────────────────────────

export interface ShareToSnapchatState {
  sharing: boolean;
  error: string;
}

/**
 * Fetches the generated result, converts it to a share-friendly JPEG, and
 * opens the native share sheet. Intended for sharing directly to Snapchat.
 *
 * Design notes (from hard-won testing on iOS):
 * - Only pass `files`; adding `title`/`text` causes Snapchat's share extension
 *   to render a black screen (known iOS compositing bug with captions).
 * - Use a JPEG ≤ 1600 px on the long side — Snapchat extensions OOM on large PNGs.
 */
export async function shareToSnapchat(
  result: string,
  setState: (patch: Partial<ShareToSnapchatState>) => void,
  { prepareFile = prepareShareFile }: ShareDeps = {},
): Promise<void> {
  if (!result) return;
  if (!navigator.share) {
    setState({
      error:
        "Le partage direct est disponible depuis un téléphone compatible. Téléchargez l'image si nécessaire.",
    });
    return;
  }

  setState({ sharing: true, error: "" });
  try {
    const response = await fetch(result);
    if (!response.ok) {
      throw new Error("Le résultat ne peut pas être préparé pour le partage.");
    }
    const blob = await response.blob();
    const file = await prepareFile(blob);

    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      throw new Error(
        "Le partage de fichiers n'est pas pris en charge par ce navigateur.",
      );
    }

    // Pass files only — no title/text (Snapchat iOS share-extension bug).
    await navigator.share({ files: [file] });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    setState({
      error:
        err instanceof Error
          ? err.message
          : "Le partage de la photo est impossible pour le moment.",
    });
  } finally {
    setState({ sharing: false });
  }
}

// ── sendAsRedSnap ────────────────────────────────────────────────────────────

export interface SendAsRedSnapState {
  sendingRedSnap: boolean;
  error: string;
}

/**
 * Two-step "Snap Rouge" flow:
 *   1. Opens the native share sheet so the user can save the image to their camera roll.
 *   2. Deep-links directly to the Snapchat "Camera Roll" lens so the user can
 *      pick the saved photo without searching for the filter manually.
 *
 * Note: no Web API can save directly to the camera roll — Apple/Google block it
 * for privacy reasons, so step 1 always requires a user action.
 */
export async function sendAsRedSnap(
  result: string,
  setState: (patch: Partial<SendAsRedSnapState>) => void,
  {
    prepareFile = prepareShareFile,
    redirect = (url) => {
      window.location.href = url;
    },
  }: ShareDeps = {},
): Promise<void> {
  if (!result) return;
  if (!navigator.share) {
    setState({
      error: "Cette fonction est disponible depuis un téléphone compatible.",
    });
    return;
  }

  setState({ sendingRedSnap: true, error: "" });
  try {
    const response = await fetch(result);
    if (!response.ok) {
      throw new Error("Le résultat ne peut pas être préparé.");
    }
    const blob = await response.blob();
    const file = await prepareFile(blob);

    if (navigator.canShare && !navigator.canShare({ files: [file] })) {
      throw new Error(
        "Le partage de fichiers n'est pas pris en charge par ce navigateur.",
      );
    }

    await navigator.share({ files: [file] });

    // Step 2: jump directly to the Snapchat Camera Roll lens.
    redirect(SNAP_UPLOAD_LENS_URL);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    setState({
      error:
        err instanceof Error
          ? err.message
          : "L'envoi en Snap Rouge est impossible pour le moment.",
    });
  } finally {
    setState({ sendingRedSnap: false });
  }
}
