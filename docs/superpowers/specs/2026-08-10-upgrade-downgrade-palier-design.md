# Changement de palier (upgrade/downgrade) via le portail Stripe

**Date**: 2026-08-10
**Statut**: Approuvé, prêt pour planification

## Contexte

Sur `/tarifs`, un utilisateur déjà abonné voit un bouton "Gérer mon
abonnement" sur toute carte différente de son palier actuel
(`components/PricingGrid.tsx`). Ce bouton appelle `POST
/api/stripe/portal`, qui crée toujours une session Stripe Billing Portal
**générique** (`app/api/stripe/portal/route.ts:46`, pas de `flow_data`) —
peu importe la carte cliquée, l'utilisateur atterrit sur la même page
Stripe montrant son abonnement actuel, sans aucun moyen d'y changer de
palier.

L'utilisateur (actuellement palier Découverte) a essayé de passer à
Ultimate via ce bouton et a constaté que ça ne fait que réafficher son
abonnement Découverte — confirmant qu'il n'existe aujourd'hui aucun
chemin réel d'upgrade/downgrade.

`app/api/stripe/checkout/route.ts:62-70` bloque intentionnellement toute
nouvelle session Checkout si `profile.plan` existe déjà (anti-double-
abonnement, chantier précédent) — donc la solution ne doit pas passer par
Checkout, mais par une mise à jour de l'abonnement Stripe existant.

## Décisions validées avec l'utilisateur

- **Mécanisme** : deep-link vers l'écran natif "changement de palier" du
  portail Stripe hosted (`flow_data.type: "subscription_update_confirm"`),
  plutôt qu'un flux 100% custom appelant `stripe.subscriptions.update()`
  directement. Stripe gère la proration, le paiement et le 3DS ; moins de
  code côté app.
- **Périodicité** : toujours celle de l'abonnement actuel de
  l'utilisateur (un abonné mensuel Ultimate reste mensuel) — jamais
  choisie par le client, toujours dérivée côté serveur du prix Stripe réel
  de l'abonnement en cours via `resolvePriceId()`.
- **Crédits à l'upgrade/downgrade** : appliqués **immédiatement** au
  nouveau palier dès que Stripe confirme le changement (pas d'attente du
  prochain renouvellement).
- **Prérequis manuel côté Stripe Dashboard** (comme les réglages
  précédents — webhook secret, activation du Customer Portal) : activer
  "Customers can switch plans" dans Customer Portal → Subscriptions, avec
  les 6 prix (3 paliers × mensuel/annuel) listés comme éligibles. Ce
  chantier ne peut pas fonctionner en production tant que ce n'est pas
  fait — documenté explicitement pour l'utilisateur, pas oublié en cours
  de route.

## Design

### 1. `app/api/stripe/portal/route.ts` — corps de requête optionnel

La route accepte désormais un corps JSON optionnel :

```ts
type PortalBody = { targetPlan?: string };
```

Si `targetPlan` est absent (cas actuel, utilisé sans changement par
`/compte`) : comportement inchangé, session portail générique.

Si `targetPlan` est présent :
1. Valider que `targetPlan` est une clé de `PLANS` — sinon 400 "Palier
   inconnu."
2. Sélectionner `stripe_customer_id, stripe_subscription_id, plan` du
   profil (au lieu de `stripe_customer_id` seul aujourd'hui).
3. Si `stripe_subscription_id` est absent → 400 "Aucun abonnement actif à
   modifier."
4. Récupérer l'abonnement Stripe réel (`stripe.subscriptions.retrieve`),
   en extraire `items.data[0].id` (l'item à remplacer) et
   `items.data[0].price.id` (le prix actuel).
5. Résoudre la périodicité actuelle via `resolvePriceId(currentPriceId)`
   — jamais fournie par le client. Si `resolvePriceId` ne trouve rien
   (prix inconnu/legacy), fallback sur `"monthly"`.
6. Calculer le prix cible : `priceIdFor(targetPlan, période)`.
7. Créer la session portail avec :
   ```ts
   stripe.billingPortal.sessions.create({
     customer: customerId,
     return_url: `${origin}/compte?upgrade=success`,
     flow_data: {
       type: "subscription_update_confirm",
       subscription_update_confirm: {
         subscription: subscriptionId,
         items: [{ id: subscriptionItemId, price: targetPriceId, quantity: 1 }],
       },
     },
   });
   ```

### 2. `components/ManageSubscriptionButton.tsx` — prop `targetPlan`

Nouvelle prop optionnelle :

```ts
{ targetPlan }: { targetPlan?: PlanId } = {}
```

- Si `targetPlan` est fourni, le POST envoie `{ targetPlan }` dans le
  corps, et le libellé du bouton devient "Passer à ce palier" (au lieu de
  "Gérer mon abonnement").
- Sans `targetPlan` (usage existant dans `/compte` et sur la carte du
  palier courant dans `PricingGrid`), comportement et libellé inchangés.

### 3. `components/PricingGrid.tsx`

Sur une carte dont `plan.id !== currentPlan` alors qu'un abonnement est
actif (`currentPlan` non nul) :

```tsx
<ManageSubscriptionButton targetPlan={plan.id} />
```

remplace l'actuel `<ManageSubscriptionButton />` sans prop. La carte du
palier courant (`isCurrent`) garde son affichage statique "Ton palier
actuel" — inchangé, hors scope.

### 4. `app/api/stripe/webhook/route.ts` — handler `customer.subscription.updated`

Nouveau bloc, après le handler `customer.subscription.deleted` existant :

```ts
if (event.type === "customer.subscription.updated") {
  const subscription = event.data.object as Stripe.Subscription;
  const previousAttributes = (
    event.data as { previous_attributes?: Record<string, unknown> }
  ).previous_attributes;

  if (previousAttributes && "items" in previousAttributes) {
    const priceId = subscription.items.data[0]?.price.id;
    const resolved = resolvePriceId(priceId);
    const periodEnd = currentPeriodEndOf(subscription);

    if (resolved) {
      const { planId, period } = resolved;
      const { data: updateData, error: updateError } = await supabase
        .from("profiles")
        .update({
          plan: planId,
          credits: creditsFor(planId, period),
          current_period_end: periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : null,
        })
        .eq("stripe_subscription_id", subscription.id)
        .select("id");

      if (updateError) {
        console.error(
          `[stripe-webhook] échec update profiles pour ${event.type} (event ${event.id}):`,
          updateError,
        );
        dbWriteFailed = true;
      } else if (!updateData || updateData.length === 0) {
        console.error(
          `[stripe-webhook] ${event.type} update matched no rows for event ${event.id} (subscriptionId=${subscription.id} may be stale)`,
        );
      }
    } else {
      console.error(
        `[stripe-webhook] resolvePriceId introuvable pour priceId=${priceId} (subscriptionId=${subscription.id}, event ${event.id})`,
      );
    }
  }
}
```

**Pourquoi le garde `previous_attributes?.items`** : `customer.
subscription.updated` se déclenche pour de nombreuses raisons (bascule de
`cancel_at_period_end`, changement de méthode de paiement, etc.), pas
seulement un changement de prix. Sans ce garde, chaque update
non-liée-au-prix réinitialiserait `profiles.credits` sur le montant plein
du palier actuel — un bug de crédits gratuits répétés. Stripe inclut
`previous_attributes.items` dans le payload de l'event uniquement quand
les items (donc le prix) ont effectivement changé.

### Data flow

Aucun nouveau champ Supabase. Réutilisation de `stripe_customer_id`,
`stripe_subscription_id`, `plan`, `credits`, `current_period_end` déjà en
base (`profiles`).

### Gestion d'erreur

- `targetPlan` invalide (pas une clé de `PLANS`) → 400.
- Pas d'abonnement actif (`stripe_subscription_id` absent) → 400.
- Erreur Stripe à la création de la session portail ou à la récupération
  de l'abonnement → 502, message générique existant réutilisé.
- Webhook : mêmes conventions que les handlers existants (log +
  `dbWriteFailed = true` → 500 pour déclencher un retry Stripe).

## Hors scope

- Bouton de gestion/annulation sur la carte du palier courant (reste "Ton
  palier actuel" statique, inchangé).
- Choix manuel de la périodicité à l'upgrade (toujours celle en cours).
- Recharge de crédits à l'unité, indépendante d'un changement de palier.
- Tout changement au comportement de `invoice.paid` /
  `checkout.session.completed` / `customer.subscription.deleted`
  existants.

## Fichiers concernés

- `app/api/stripe/portal/route.ts` (corps de requête optionnel,
  `flow_data` conditionnel).
- `components/ManageSubscriptionButton.tsx` (prop `targetPlan`).
- `components/PricingGrid.tsx` (passer `targetPlan` sur les cartes non
  courantes).
- `app/api/stripe/webhook/route.ts` (nouveau handler
  `customer.subscription.updated`).

## Étape manuelle requise avant mise en production

Avant que ce chantier fonctionne réellement (comme pour les précédents
réglages Stripe faits par l'utilisateur), il faudra dans le Dashboard
Stripe :
1. Customer Portal → Subscriptions → activer "Customers can switch
   plans".
2. Lister les 6 prix (`STRIPE_PRICE_DECOUVERTE`,
   `STRIPE_PRICE_DECOUVERTE_ANNUEL`, `STRIPE_PRICE_ESSENTIEL`,
   `STRIPE_PRICE_ESSENTIEL_ANNUEL`, `STRIPE_PRICE_ULTIMATE`,
   `STRIPE_PRICE_ULTIMATE_ANNUEL`) comme éligibles au switch entre eux.
3. Vérifier le comportement de proration proposé par défaut dans cette
   configuration.
