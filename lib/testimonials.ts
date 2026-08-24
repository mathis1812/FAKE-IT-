// Témoignages clients réels, affichés sur /landing (section "Ce qu'ils en disent").
//
// Ne JAMAIS inventer de témoignage ici. Chaque entrée doit correspondre à un
// retour authentique d'un(e) utilisateur(rice) de Bluminoo Studio, avec son
// consentement explicite à être cité(e) publiquement (nom/pseudo + citation).
// Les citations ci-dessous sont traduites de leur langue d'origine (français)
// vers l'anglais ; la traduction doit rester fidèle au sens et au ton exprimés
// par la personne, sans jamais en inventer ni en édulcorer le contenu.
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

export const TESTIMONIALS: Testimonial[] = [
  { name: "ARTHUR_M78", quote: "This AI blows the others away, I recommend it!" },
  { name: "SARAH_SHY", quote: "Super realistic, I was a bit skeptical at first but it's absolutely perfect." },
  { name: "NEXTAZ_GOAT", quote: "Thank you so much, you did a great job. And it's one of the best sites I've used" },
  { name: "MARC_ANT75", quote: "A very serious site that keeps improving day by day, thank you for your work and dedication!" },
  { name: "LUC_SKY01", quote: "Clear and precise, keep improving the details and lower the prices a bit" },
  { name: "VIDEO_MAKER", quote: "Very good, but keep working on it and if possible add a video feature" },
  { name: "JOURDAN", quote: "I just wanted to share my opinion about the site, I find it honestly beautiful, and the images are realistic!" },
  { name: "RWAN", quote: "I talked with customer support and everything went really well, the problem was resolved quickly" },
  { name: "AYMAN", quote: "Thanks for your efforts to make the AI really fun, we had a good laugh with colleagues, but it's missing an unlimited premium tier" },
  { name: "METII", quote: "much respect guys, you nailed it" },
  { name: "TOOKIE", quote: "This AI has huge potential and deserves 5 stars" },
  { name: "ALESS", quote: "it's great, keep it up and keep improving the AI" },
  { name: "WASSIM", quote: "I think the site is great, it's just missing a little something to reach perfect development" },
  { name: "RESULY", quote: "Beautiful, honestly I understood everything and the price is reasonable" },
  { name: "T57", quote: "very good and complete site" },
  { name: "ADAMBEK", quote: "It's super cool, it's just that the credits get used up too fast, same with the price" },
  { name: "ERWEAN87", quote: "I was afraid it was a scam but honestly it's a banger, go for it guys" },
  { name: "ENDWINGIRARD", quote: "I was really hesitant at first but it was totally worth it, brothers" },
  { name: "FLAVI", quote: "honestly you're doing an incredible job, keep it up, it's thanks to you that we'll get access to some seriously crazy stuff" },
  { name: "THOMASGUI", quote: "Very good, top-tier AI" },
  { name: "G_PLAYER_X", quote: "Finally a tool that respects textures and natural light." },
  { name: "LORYS_VIBE", quote: "Blown away by the precision of Red Snap. It's clean and fast." },
  { name: "ZEN_USER_99", quote: "Keep doing what you're doing, you're doing an extraordinary job. Plus you're responsive when there's an issue. Thanks!" },
  { name: "TOM_RIDER", quote: "you guys are the best, keep going on this path, I hope for you, you could go far" },
  { name: "GIRAFE93FANTE", quote: "if only I'd had this sooner, my buddy believes anything thanks to the Red Snap thing 🤣" },
  { name: "ENTIFACHO", quote: "thanks for including Red Snap tech in the Essential plan, you guys rock 🙏" },
  { name: "PEPITRDOR999", quote: "I don't regret my purchase one bit, I skipped a kebab and ended up with this banger instead 😭🙏" },
  { name: "MASKEYTV", quote: "for a start I'll give it a 4.5 rating because nothing and nobody is perfect, but it's extremely high quality" },
  { name: "PAYXLANPY", quote: "Well done for your work, a lot of people love the site, it's really good work!" },
];
