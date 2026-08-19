"use client";

    /**
    * Chime de révélation — léger, cristallin, cohérent avec l'univers luxe.
    * Généré via Web Audio (aucun asset à charger) : petit arpège E6 → B6 → E7
    * en sinusoïdes avec décroissance exponentielle, comme un carillon en verre.
    *
    * Best-effort : ne doit jamais casser le flux de génération. Tout est
    * enveloppé dans un try/catch et silencieux si l'audio est indisponible
    * (autoplay bloqué, navigateur sans AudioContext, etc.).
    */

    let sharedCtx: AudioContext | null = null;

    function getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    const AC: typeof AudioContext | undefined =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!sharedCtx) sharedCtx = new AC();
    return sharedCtx;
    }

    /**
    * À appeler dans le handler du bouton « Générer » (geste utilisateur direct).
    *
    * Sur iOS Safari, l'AudioContext reste "suspended" tant qu'il n'a pas été
    * démarré dans un geste utilisateur. Le chime joue ~15-90 s plus tard
    * (fin du polling), hors geste — il serait silencieux sans cet amorçage.
    *
    * Cette fonction :
    * 1. Crée le contexte partagé s'il n'existe pas encore.
    * 2. Appelle resume() pour sortir de l'état "suspended".
    * 3. Joue un buffer silencieux d'une frame (technique recommandée par Apple
    *    pour déverrouiller l'AudioContext sur iOS).
    */
    export function unlockAudioContext(): void {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const resumePromise = ctx.resume();
      if (resumePromise) void resumePromise.catch(() => undefined);
      // Buffer silencieux d'une frame : déverrouille l'AudioContext sur iOS Safari.
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      // Silencieux : le son est un bonus, jamais un bloqueur.
    }
    }

    export function playRevealChime(): void {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => undefined);
      }

      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.value = 0.14;
      master.connect(ctx.destination);

      // E6, B6, E7 — arpège ascendant, timbre clochette.
      const notes = [1318.51, 1975.53, 2637.02];
      notes.forEach((freq, i) => {
        const start = now + i * 0.09;

        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;

        // Harmonique douce une octave au-dessus pour le côté "cristal".
        const shimmer = ctx.createOscillator();
        shimmer.type = "sine";
        shimmer.frequency.value = freq * 2;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(1, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.5);

        const shimmerGain = ctx.createGain();
        shimmerGain.gain.value = 0.25;

        osc.connect(gain);
        shimmer.connect(shimmerGain);
        shimmerGain.connect(gain);
        gain.connect(master);

        osc.start(start);
        shimmer.start(start);
        osc.stop(start + 1.6);
        shimmer.stop(start + 1.6);
      });
    } catch {
      // Silencieux : le son est un bonus, jamais un bloqueur.
    }
    }
    