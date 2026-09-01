/**
 * Catalogue de gabarits — structure visible par le client uniquement.
 *
 * Structure relevée sur le produit de référence le 27/08, en parcourant les
 * quatre niveaux en direct :
 *
 *   /                         studio + étagère
 *   /templates                la même page, atteignable par le bouton
 *   /templates/category/<c>   la grille complète d'une catégorie
 *   /templates/<t>            import direct, OU choix de variante
 *   /templates/<t>/<v>        import, quand le gabarit a des variantes
 *
 * Un gabarit porte son prompt et ne le montre jamais. Depuis le
 * découpage anti-fuite, les prompts NE SONT PLUS ICI : ce module est
 * importé par des composants clients (`app/page.tsx`, `TemplateShelf`), et
 * tout ce qu'il exporte finit dans le bundle navigateur. Les prompts vivent
 * dans `lib/template-prompts.ts` (`server-only`), résolus côté serveur par
 * `POST /api/generate`.
 *
 * Ici : slugs, libellés, images, questions de variante. Rien de secret.
 *
 * Tant que `TEMPLATE_CATEGORIES` est vide, l'étagère ne s'affiche pas, le
 * bouton « Templates » reste inactif et toutes les routes répondent 404.
 * Même principe que `lib/testimonials.ts` : pas de contenu inventé.
 *
 * Pour ajouter un gabarit : déposer deux visuels dans `public/templates/` —
 * `<slug>-card.jpg` (vignette de grille, ratio 9/11) et `<slug>.jpg`
 * (l'exemple de résultat, plein cadre) — créer l'entrée ici, PUIS ajouter
 * le prompt correspondant dans `lib/template-prompts.ts` (le test
 * `__tests__/template-prompts.test.ts` échoue tant que les deux ne sont pas
 * alignés).
 */

export type TemplateVariant = {
  /** Identifiant d'URL : la page vit sur /templates/<gabarit>/<variante>. */
  slug: string;
  /**
   * Libellé montré dans la liste de choix. Sur le modèle ce sont des vannes
   * (« L'assurance en sueur »), pas des niveaux techniques : le ton fait
   * partie du produit.
   */
  label: string;
  /**
   * Aperçu affiché sur l'écran de choix quand cette variante est
   * sélectionnée. Distinct de `exampleImage` : le modèle utilise deux
   * fichiers différents pour la même variante — l'aperçu du choix et le
   * résultat montré à l'écran d'import ne sont pas le même rendu.
   */
  choiceImage?: string;
  /** Résultat montré à l'écran d'import, si différent de celui du gabarit. */
  exampleImage?: string;
  /** Photo d'origine du fondu avant/après, si différente de celle du gabarit. */
  beforeImage?: string;
  /**
   * Consignes propres à cette variante, si différentes de celles du gabarit
   * — ex. « Ceiling visible » pour un plafond effondré, « Floor visible »
   * pour un sol effondré. Absentes, elles retombent sur `tips` du gabarit.
   */
  tips?: string[];
};

/**
 * Ce qu'un composant client a le droit de recevoir. Désormais identique au
 * gabarit lui-même : ce module ne porte plus aucun prompt, donc plus rien à
 * retirer. `toTemplateView` reste comme point de passage unique et pour la
 * lisibilité des écrans.
 */
export type TemplateView = TemplateBase;

/** Idem pour une variante. */
export type VariantView = TemplateVariant;

type TemplateBase = {
  /** Identifiant d'URL : la page vit sur /templates/<slug>. */
  slug: string;
  /** Libellé affiché sur les vignettes et en titre d'écran. */
  label: string;
  /** Vignette des grilles et de l'étagère. */
  cardImage: string;
  /** Exemple de résultat, affiché plein cadre. */
  exampleImage: string;
  /**
   * Photo d'origine générique, affichée en fondu alterné avec le résultat.
   * Optionnelle : un gabarit sans elle affiche `exampleImage` seul, fixe.
   */
  beforeImage?: string;
  /**
   * Deux consignes de cadrage, très courtes : elles s'affichent sur une
   * seule ligne, séparées par un point médian. Ce sont les conditions qui
   * font rater un rendu, pas un mode d'emploi.
   */
  tips: string[];
};

/**
 * Un gabarit a soit une liste de variantes, soit rien. Le prompt (unique ou
 * par variante) est porté ailleurs — voir en-tête de fichier.
 */
export type Template =
  | (TemplateBase & {
      variantQuestion?: never;
      variants?: never;
      defaultVariantSlug?: never;
    })
  | (TemplateBase & {
      /** Question posée au-dessus de la liste, ex. « How much damage? ». */
      variantQuestion: string;
      variants: TemplateVariant[];
      /**
       * Variante cochée à l'ouverture de l'écran de choix. Relevé sur le
       * modèle : ce n'est ni toujours la première ni toujours la dernière de
       * la liste — chaque gabarit a la sienne, à décider au cas par cas.
       */
      defaultVariantSlug: string;
    });

export type TemplateCategory = {
  /** Identifiant d'URL : la page vit sur /templates/category/<slug>. */
  slug: string;
  title: string;
  /**
   * Catégorie mise en avant : sa carte occupe toute la largeur en haut de
   * l'étagère, avec un badge « Try it ». Une seule à la fois — au-delà, la
   * mise en avant ne met plus rien en avant.
   */
  featured?: boolean;
  /** Visuel de la carte vedette, plus large que les vignettes de grille. */
  featuredImage?: string;
  templates: Template[];
};

/**
 * Catégorie vedette, relevée sur le modèle : 21 modèles, tous sans variante
 * — le client dépose une photo de son véhicule, choisit un modèle, obtient
 * le remplacement. Les slugs suivent ceux du modèle, y compris l'écart
 * apparent slug/libellé sur « temerario » (Huracán Tecnica) : c'est ainsi
 * qu'il est nommé côté source, laissé tel quel plutôt que corrigé sans
 * certitude.
 *
 * Exporté : `lib/template-prompts.ts` en dérive un `buildVehicleSwapPrompt`
 * par `target`. Les noms de modèles ne sont pas secrets (ils transparaissent
 * déjà dans les libellés) — seul le texte de prompt l'est.
 */
export const VEHICLE_MODELS: { slug: string; label: string; target: string }[] =
  [
    { slug: "aventador-svj", label: "Aventador SVJ", target: "Lamborghini Aventador SVJ" },
    { slug: "gt3-rs", label: "911 GT3 RS", target: "Porsche 911 GT3 RS" },
    { slug: "chiron", label: "Chiron Super Sport", target: "Bugatti Chiron Super Sport" },
    { slug: "revuelto", label: "Revuelto", target: "Lamborghini Revuelto" },
    { slug: "m4", label: "M4 Competition", target: "BMW M4 Competition" },
    { slug: "rs6", label: "RS6 C8", target: "Audi RS6 Avant C8" },
    { slug: "rs3", label: "RS3 8Y", target: "Audi RS3 8Y" },
    { slug: "812-superfast", label: "812 Superfast", target: "Ferrari 812 Superfast" },
    { slug: "amg-gt-black-series", label: "AMG GT Black Series", target: "Mercedes-AMG GT Black Series" },
    { slug: "sf90", label: "SF90 Stradale", target: "Ferrari SF90 Stradale" },
    { slug: "m3", label: "M3 Competition", target: "BMW M3 Competition" },
    { slug: "911-turbo-s", label: "911 Turbo S", target: "Porsche 911 Turbo S" },
    { slug: "huracan-sto", label: "Huracán STO", target: "Lamborghini Huracán STO" },
    { slug: "golf-r", label: "Golf R", target: "Volkswagen Golf R" },
    { slug: "c63-s", label: "C 63 S", target: "Mercedes-AMG C 63 S E Performance" },
    { slug: "a45-s", label: "A 45 S", target: "Mercedes-AMG A 45 S" },
    { slug: "temerario", label: "Huracán Tecnica", target: "Lamborghini Huracán Tecnica" },
    { slug: "gtr-nismo", label: "GT-R Nismo", target: "Nissan GT-R Nismo" },
    { slug: "r8", label: "R8 V10", target: "Audi R8 V10 performance" },
    { slug: "m2", label: "M2", target: "BMW M2" },
    { slug: "720s", label: "720S", target: "McLaren 720S" },
  ];

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    slug: "swap-vehicule",
    title: "Swap vehicle",
    featured: true,
    featuredImage: "/templates/aventador-svj-card.jpg",
    templates: VEHICLE_MODELS.map(({ slug, label }) => ({
      slug,
      label,
      cardImage: `/templates/${slug}-card.jpg`,
      exampleImage: `/templates/${slug}.jpg`,
      beforeImage: `/templates/${slug}-before.jpg`,
      tips: ["Whole car", "Good angle"],
    })),
  },
  {
    slug: "pranks",
    title: "Popular pranks",
    templates: [
      {
        slug: "voiture-accidentee",
        label: "Accident",
        cardImage: "/templates/voiture-accidentee-card.jpg",
        exampleImage: "/templates/voiture-accidentee-fort.jpg",
        beforeImage: "/templates/voiture-accidentee-before.jpg",
        // « Bon angle » sur le modèle, pas « Clear space » : le second
        // conseil portait sur le dégagement autour du véhicule alors qu'il
        // parle du point de vue, comme sur la catégorie Swap vehicle.
        tips: ["Whole car", "Good angle"],
        variantQuestion: "How much damage?",
        // Le cran du milieu, relevé sur le modèle (son écran de choix
        // s'ouvre sur « L'assurance en sueur » et son bouton Continuer
        // pointe vers /fort). Bluminoo ouvrait sur le cran le plus extrême,
        // ce qui poussait par défaut vers le rendu le plus spectaculaire au
        // lieu du plus représentatif.
        defaultVariantSlug: "fort",
        variants: [
          {
            slug: "modere",
            label: "It buffs out",
            choiceImage: "/templates/voiture-accidentee-modere-choice.jpg",
            exampleImage: "/templates/voiture-accidentee-modere.jpg",
          },
          {
            slug: "fort",
            label: "Insurance is sweating",
            choiceImage: "/templates/voiture-accidentee-fort-choice.jpg",
            exampleImage: "/templates/voiture-accidentee-fort.jpg",
          },
          {
            slug: "extreme",
            label: "Straight to the scrapyard",
            choiceImage: "/templates/voiture-accidentee-extreme-choice.jpg",
            exampleImage: "/templates/voiture-accidentee-extreme.jpg",
          },
        ],
      },
      {
        slug: "animal-rase",
        label: "Shaved Pet",
        cardImage: "/templates/animal-rase-card.jpg",
        exampleImage: "/templates/animal-rase.jpg",
        beforeImage: "/templates/animal-rase-before.jpg",
        tips: ["Whole animal", "Body visible"],
      },
      {
        slug: "lendemain-de-soiree",
        label: "Morning After",
        cardImage: "/templates/lendemain-de-soiree-card.jpg",
        exampleImage: "/templates/lendemain-de-soiree.jpg",
        beforeImage: "/templates/lendemain-de-soiree-before.jpg",
        tips: ["Whole room", "Good light"],
      },
      {
        slug: "inondation",
        label: "Flood",
        cardImage: "/templates/inondation-card.jpg",
        exampleImage: "/templates/inondation.jpg",
        beforeImage: "/templates/inondation-before.jpg",
        tips: ["Whole room", "Good light"],
      },
      {
        slug: "degats-maison",
        label: "House Damage",
        cardImage: "/templates/degats-maison-card.jpg",
        exampleImage: "/templates/degats-maison-plafond.jpg",
        beforeImage: "/templates/degats-maison-plafond-before.jpg",
        tips: ["Whole room", "Ceiling visible"],
        variantQuestion: "What kind of damage?",
        defaultVariantSlug: "plafond",
        variants: [
          {
            slug: "plafond",
            label: "Ceiling collapsed",
            choiceImage: "/templates/degats-maison-plafond-choice.jpg",
            exampleImage: "/templates/degats-maison-plafond.jpg",
            beforeImage: "/templates/degats-maison-plafond-before.jpg",
            tips: ["Whole room", "Ceiling visible"],
          },
          {
            slug: "sol",
            label: "Floor collapsed",
            choiceImage: "/templates/degats-maison-sol-choice.jpg",
            exampleImage: "/templates/degats-maison-sol.jpg",
            beforeImage: "/templates/degats-maison-sol-before.jpg",
            tips: ["Whole room", "Floor visible"],
          },
        ],
      },
      {
        slug: "rat",
        label: "Rat",
        cardImage: "/templates/rat-card.jpg",
        exampleImage: "/templates/rat-invasion.jpg",
        beforeImage: "/templates/rat-before.jpg",
        tips: ["Floor visible", "Good angle"],
        variantQuestion: "How many rats?",
        defaultVariantSlug: "invasion",
        variants: [
          {
            slug: "seul",
            label: "Rat",
            choiceImage: "/templates/rat-seul-choice.jpg",
            exampleImage: "/templates/rat-seul.jpg",
          },
          {
            slug: "invasion",
            label: "RATPOCALYPSE!",
            choiceImage: "/templates/rat-invasion-choice.jpg",
            exampleImage: "/templates/rat-invasion.jpg",
          },
        ],
      },
    ],
  },
  {
    slug: "worlds",
    title: "Worlds",
    templates: [
      {
        slug: "minecraft",
        label: "Minecraft",
        cardImage: "/templates/minecraft-card.jpg",
        exampleImage: "/templates/minecraft.jpg",
        beforeImage: "/templates/minecraft-before.jpg",
        tips: ["Sharp subject", "Visible background"],
      },
      {
        slug: "gta-5",
        label: "GTA 5",
        cardImage: "/templates/gta-5-card.jpg",
        exampleImage: "/templates/gta-5.jpg",
        beforeImage: "/templates/gta-5-before.jpg",
        tips: ["Sharp subject", "Face visible"],
      },
      {
        slug: "lego",
        label: "LEGO",
        cardImage: "/templates/lego-card.jpg",
        exampleImage: "/templates/lego.jpg",
        beforeImage: "/templates/lego-before.jpg",
        tips: ["Whole subject", "Visible background"],
      },
    ],
  },
];

/** Vrai si le gabarit passe par un écran de choix avant l'import. */
export function hasVariants(
  template: Template,
): template is Extract<Template, { variants: TemplateVariant[] }> {
  return Array.isArray(template.variants) && template.variants.length > 0;
}

/** Retrouve un gabarit par son identifiant d'URL, toutes catégories confondues. */
export function findTemplate(slug: string): Template | undefined {
  for (const category of TEMPLATE_CATEGORIES) {
    const match = category.templates.find((t) => t.slug === slug);
    if (match) return match;
  }
  return undefined;
}

export function findVariant(
  template: Template,
  variantSlug: string,
): TemplateVariant | undefined {
  if (!hasVariants(template)) return undefined;
  return template.variants.find((v) => v.slug === variantSlug);
}

export function findCategory(slug: string): TemplateCategory | undefined {
  return TEMPLATE_CATEGORIES.find((c) => c.slug === slug);
}

/** Retrouve la catégorie d'un gabarit — sert aux retours et au fil de navigation. */
export function categoryOfTemplate(slug: string): TemplateCategory | undefined {
  return TEMPLATE_CATEGORIES.find((category) =>
    category.templates.some((template) => template.slug === slug),
  );
}

/** La catégorie mise en avant, si elle existe. */
export function featuredCategory(): TemplateCategory | undefined {
  return TEMPLATE_CATEGORIES.find((c) => c.featured);
}

/** Tous les gabarits à plat — sert à générer les routes statiques. */
export function allTemplates(): Template[] {
  return TEMPLATE_CATEGORIES.flatMap((c) => c.templates);
}

/** Point de passage unique vers un écran client. Aujourd'hui l'identité. */
export function toTemplateView(template: Template): TemplateView {
  const { slug, label, cardImage, exampleImage, beforeImage, tips } = template;
  return { slug, label, cardImage, exampleImage, beforeImage, tips };
}

/** Idem pour une liste de variantes. */
export function toVariantViews(variants: TemplateVariant[]): VariantView[] {
  return variants.map(
    ({ slug, label, choiceImage, exampleImage, beforeImage, tips }) => ({
      slug,
      label,
      choiceImage,
      beforeImage,
      tips,
      exampleImage,
    }),
  );
}

/** Tous les couples gabarit/variante à plat, pour les routes statiques. */
export function allTemplateVariants(): { slug: string; variant: string }[] {
  return allTemplates().flatMap((template) =>
    hasVariants(template)
      ? template.variants.map((v) => ({
          slug: template.slug,
          variant: v.slug,
        }))
      : [],
  );
}
