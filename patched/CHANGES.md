# 📋 Changements — MM_Recon MVP

## 🩺 Diagnostic des incohérences trouvées

### 1. **"Vue d'ensemble — aujourd'hui" mentait**
Le titre dit *"aujourd'hui"*, mais `/dashboard/stats` retournait les compteurs sur **toutes** les transactions (`db.query(Transaction).all()`). Idem pour l'onglet *"Aujourd'hui"* du graphique. → **Incohérent.**

### 2. **Bouton "Résoudre" était impossible à implémenter**
`/reconciliation/run` retournait les anomalies du moteur CSV, **sans `id` DB ni `status`**. Le frontend n'aurait jamais pu appeler `PUT /anomalies/{id}/resolve`.

### 3. **Duplication des anomalies à chaque run**
Chaque `runReconciliation` créait de nouvelles lignes en base. Résultat : si on résolvait `TXN001`, le run suivant recréait une `OPEN` pour `TXN001`. La résolution était inutile.

---

## ✅ Corrections appliquées

### Backend

**`backend/main.py`**
- `/dashboard/stats` retourne désormais **deux blocs** :
  - Compteurs globaux (`total_transactions`, `success_count`, …) — toujours là pour compat
  - Compteurs du jour : `today_total`, `today_success_count`, `today_failed_count`, `today_pending_count`, `today_reversed_count`, `today_success_rate`
- `/reconciliation/run` :
  - Utilise la nouvelle signature `save_reconciliation_result()` qui retourne `(run, anomalies)`
  - Sérialise les anomalies via `serialize_anomaly()` → inclut `id`, `status`, `detected_at`
  - Le `summary` est recalculé en distinguant `OPEN` vs `RESOLVED`

**`backend/service/reconciliation_service.py`**
- `save_reconciliation_result()` :
  - Indexe les anomalies déjà `RESOLVED` par `(reference, issue)` avant chaque run
  - Purge les `OPEN` obsolètes
  - Ne recrée **pas** une `OPEN` si une `RESOLVED` existe déjà pour la même clé → la résolution est persistante
  - Déduplique aussi les doublons internes au run
  - Retourne `(run, saved_anomalies)` avec les objets DB rafraîchis (donc avec `id`)

### Frontend (`frontend/src/App.jsx`)

- **KPI "Vue d'ensemble — aujourd'hui"** : lit `stats.today_*` (avec fallback sur all-time pour rester compatible si on rollback le backend)
- **Graphique onglet "Aujourd'hui"** : idem, lit `stats.today_*_count`
- **Sous-titre du graphique** : indique explicitement *"— uniquement aujourd'hui"* ou *"— 7 derniers jours"*
- **Tableau anomalies** :
  - Nouvelle colonne **Statut** (pill `OUVERTE` rouge / `RÉSOLUE` verte)
  - Nouvelle colonne **Action** (bouton **Résoudre** vert quand `OPEN`, ✓ quand `RESOLVED`)
  - Nouvelle ligne de filtres : `Tous statuts` / `Ouvertes` / `Résolues`
  - Lignes `RESOLVED` affichées avec opacité réduite (visuellement dépriorisées)
  - Fonction `resolveAnomaly(id)` avec état de chargement (`resolvingId`)
- **Export CSV** : colonne `Statut` ajoutée
- **Bandeau récap** : affiche en bonus `✓ N déjà résolue(s)` quand pertinent

---

## 📦 Fichiers à remplacer

```
backend/main.py
backend/service/reconciliation_service.py
frontend/src/App.jsx
```

Aucun changement dans `models.py`, `schemas.py`, `reconciliation_engine.py`, `database.py`.

---

## ⚠️ Note migration DB

Le champ `Anomaly.status` existait déjà dans `models.py` avec `default="OPEN"`. **Aucune migration SQL n'est nécessaire** si votre base a été créée après l'ajout de ce champ. Si elle est plus ancienne, supprimez `app.db` (ou équivalent) et relancez le backend — `Base.metadata.create_all()` recréera tout.
