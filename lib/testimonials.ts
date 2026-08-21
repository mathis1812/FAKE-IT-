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

export const TESTIMONIALS: Testimonial[] = [
  { name: "ARTHUR_M78", quote: "Cette IA met une tempête aux autres je vous recommande!" },
  { name: "SARAH_SHY", quote: "Super réaliste, j'étais un peu sceptique au début mais c'est absolument parfait." },
  { name: "NEXTAZ_GOAT", quote: "Merci beaucoup vous avez fait un super travail. Et cest un des meilleurs sites que j'ai eu" },
  { name: "MARC_ANT75", quote: "Site très sérieux qui ne cesse de s'améliorer de jour en jour, merci de votre travail et investissement!" },
  { name: "LUC_SKY01", quote: "Clair net et précis continuer d'améliorer les points et réduire un peu les prix" },
  { name: "VIDEO_MAKER", quote: "Très bien mais continuer de travailler dessus et si possible mettre une fonctionnalité vidéo" },
  { name: "JOURDAN", quote: "C'était juste pour vous faire part de mon avis vis à vis du site, je le trouve franchement magnifique, et les images sont réalistes !" },
  { name: "RWAN", quote: "J'ai discuté avec le service client et tout c'est super bien passé le problème a était résolu rapidement" },
  { name: "AYMAN", quote: "Merci de vos efforts pour rendre l'ia vraiment amusante on a bien rigoler entre colleges mais il manque une catégorie supérieur illimité" },
  { name: "METII", quote: "force a vous les gars vous avez dead ça" },
  { name: "TOOKIE", quote: "Cette IA a énormément de potentiel et mérite les 5 étoiles" },
  { name: "ALESS", quote: "c'est super continuez comme ça et continuez d'améliorer l'IA" },
  { name: "WASSIM", quote: "je trouve le site super manque juste un peu pour arriver à un développement parfait" },
  { name: "RESULY", quote: "Magnifique franchement j'ai tout compris et prix raisonnable" },
  { name: "T57", quote: "site très bien et complet" },
  { name: "ADAMBEK", quote: "C'est super cool juste les crédits s'utilisent trop vite comme le prix" },
  { name: "ERWEAN87", quote: "J'avais peur que ce soit une arnaque mais sah banger foncez les mecs" },
  { name: "ENDWINGIRARD", quote: "j'hésitais carrément au début mais ça valait vrm le coup les frères" },
  { name: "FLAVI", quote: "franchement vous faites un boulot incroyable continuer comme ça c'est grave à vous qu'on aura accès à des trucs de fou furieux" },
  { name: "THOMASGUI", quote: "Très bien, IA au top" },
  { name: "G_PLAYER_X", quote: "Enfin un outil qui respecte les textures et la lumière naturelle." },
  { name: "LORYS_VIBE", quote: "Bluffé par la précision du Snap Rouge. C'est propre et rapide." },
  { name: "ZEN_USER_99", quote: "Continuer ce que vous faites, vous faites un travail extraordinaire. En plus vous êtes réactif quand il y a un problème. Merci!" },
  { name: "TOM_RIDER", quote: "vous êtes top les mec continuez sur ce chemin je l'espère pour vous, vous pourriez allez loin" },
  { name: "GIRAFE93FANTE", quote: "si seulement j'avais eu ça plus tôt mon pote croit à tout grâce au truc snap rouge 🤣" },
  { name: "ENTIFACHO", quote: "merci d'avoir mis la tech snap rouge intégrée dans l'abonnement essentiel vous gérer 🙏" },
  { name: "PEPITRDOR999", quote: "je regrette tellement pas mon achat j'ai évité de manger un kebab et je me retrouve avce ce banger 😭🙏" },
  { name: "MASKEYTV", quote: "pour un début je vous donne la note de 4.5 car rien n'y personne n'est parfait mais c'est extrêmement quali" },
  { name: "PAYXLANPY", quote: "Bravo pour votre travail de nombreuse personne adore le site, c'est du très bon boulot !" },
];
