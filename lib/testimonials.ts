// Témoignages clients réels, affichés sur /landing (section "Ce qu'ils en disent").
//
// Ne JAMAIS inventer de témoignage ici. Chaque entrée doit correspondre à un
// retour authentique d'un(e) utilisateur(rice) de Bluminoo Studio, avec son
// consentement explicite à être cité(e) publiquement (nom/pseudo + citation).
//
// Tant que ce tableau est vide, la section témoignages ne s'affiche pas sur la
// landing page : celle-ci retombe sur les sections stats / différenciateurs
// existantes. Dès qu'un vrai témoignage a été recueilli (et son consentement
// obtenu), ajoute une entrée ici et la section apparaîtra automatiquement.

export type Testimonial = {
  /** Prénom ou pseudo de la personne, tel qu'elle a accepté d'être citée. */
  name: string;
  /** Rôle / contexte facultatif (ex: "Créatrice de contenu"). */
  role?: string;
  /** Citation exacte, éventuellement légèrement raccourcie avec son accord. */
  quote: string;
  /** Note optionnelle sur 5, si l'utilisateur en a laissé une. */
  rating?: number;
};

export const TESTIMONIALS: Testimonial[] = [];
