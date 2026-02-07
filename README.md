# RESCOE — Réseau Expérimental Solidaire de Crypto‑Œuvres Émergentes

**RESCOE** est une association artistique et technique dédiée à l’exploration des croisements entre **art numérique**, **génératif**, **poésie**, **blockchain** et **pédagogie**.  
Le projet développe une infrastructure hybride mêlant œuvres on‑chain, objets physiques, expositions, formations et expérimentations économiques alternatives.

> RESCOE n’est pas une plateforme NFT classique.  
> C’est un **laboratoire vivant** où le code, l’art et le collectif co‑évoluent.

---

## 🌐 Vision

RESCOE vise à :
- Créer des **ponts durables entre artistes, développeurs et publics**
- Démocratiser l’usage de la **blockchain comme médium artistique**, pas comme simple marché
- Soutenir les **artistes émergents** par des outils concrets, sobres et maîtrisables
- Explorer des **économies hybrides** (association + structure commerciale)
- Maintenir un **ancrage physique** (ateliers, fanzines, expositions) tout en exploitant le potentiel du Web3

---

## 🧬 Axes artistiques

### 🎨 Art numérique & génératif
- Œuvres génératives (p5.js, JS, Python)
- Séries évolutives (stades, mutations, variations)
- Logique de **collections vivantes**, non figées

### 🪲 NFT évolutifs
- Œuvres organisées par **familles**
- Niveaux d’évolution (larve → imago, etc.)
- Métadatas dynamiques (lore, attributs, rareté)
- Ponts conceptuels entre **biologie, réseau et technologie**

### ✍️ Poésie & édition
- Poèmes tokenisés ou associés aux œuvres
- Fanzines physiques ↔ versions numériques
- Curation poétique humaine (pas générée automatiquement)

### 🖼️ Phygital
- Œuvres numériques exposées physiquement
- Impression, installation, projection
- QR / lien blockchain comme extension, pas substitution

---

## 🧠 Architecture technique (vue d’ensemble)

> ⚠️ Les smart contracts ne sont **pas publics sur ce dépôt**  
> Ce repository documente et expose **l’écosystème applicatif**, les pipelines et les principes d’architecture.

### Stack principale
- **Frontend** : React + TypeScript (TSX)
- **UI** : Chakra UI
- **Web3** : ethers.js, @moralisweb3
- **Backend** : Moralis (indexation, auth, DB)
- **Storage** : IPFS via Pinata
- **Hosting** : Vercel
- **Blockchain cible** : Base (testnet Sepolia)

### Wallets
- MetaMask (par défaut)
- Connexion email / custodial (onboarding simplifié)

---

## 🔗 Architecture blockchain (conceptuelle)

Même si le code n’est pas publié ici, RESCOE repose sur une architecture modulaire :

1. **Membership Contract**
   - Gestion des rôles et droits
   - Points, badges, accès

2. **Rescollection Manager**
   - Vérifie les droits de création
   - Autorise les collections selon le statut membre

3. **MasterFactory**
   - Déploie dynamiquement des collections
   - Supporte plusieurs types d’œuvres

4. **Collection Contracts**
   - NFT standards ou évolutifs
   - Métadatas enrichies (lore, niveaux, familles)

> Cette modularité permet à RESCOE d’expérimenter sans verrouiller les artistes dans un modèle unique.

---

## 🧪 Pipelines & automatisation

### Génération d’œuvres (exemple : insectes NFT)
- Analyse de couleur dominante
- Génération de familles
- Nommage unique et déterministe
- Génération de lore narratif
- Métadatas compatibles OpenSea / IPFS

📄 Voir : `RESCOE_Pipeline_v4.2.md`

### Métadatas
- Normalisation robuste
- Fallback automatique
- Historique de traitement
- Versionnement de pipeline

---

## 🏛️ Fonctionnalités applicatives

### 👤 Comptes & membres
- Inscription
- Attribution de rôles
- Accès conditionné aux outils

### 🖼️ Œuvres
- Consultation des collections
- Visualisation des familles
- Évolution dans le temps

### 📅 Ateliers & formations
- Réservation d’ateliers
- Sessions pédagogiques Web3
- Initiation artistes / associations

### 📖 Poésie & éditions
- Accès aux œuvres textuelles
- Fanzines numériques
- Liens vers éditions physiques

---

## 🧩 Modèle économique hybride

RESCOE fonctionne sur deux entités complémentaires :

### 🟢 Association (RESCOE)
- Vitrine artistique
- Expérimentation
- Médiation culturelle
- Accès ouvert et pédagogique

### 🔵 SAS partenaire
- Développement Web3 sur mesure
- Vente de modules techniques
- Prestations artistes / structures
- Soutien financier à l’association

> Objectif : **pérennité sans dépendance**, expérimentation sans spéculation.

---

## 🧑‍💻 Équipe

- **Thibault** — Développeur principal & co‑fondateur  
  Art génératif, blockchain, architecture, pédagogie

- **Présidence / Administration** — Gestion associative

- **Poète curateur** — Sélection poétique & éditoriale

---

## 🚧 État du projet

- ✅ Infrastructure fonctionnelle
- ✅ Pipelines NFT opérationnels
- 🚧 Galerie physique (Bordeaux) — en préparation
- 🚧 Art génératif on‑chain
- 🚧 Nouveaux modules de réservation & curation

---

## 🤝 Contribuer

RESCOE est ouvert :
- aux artistes numériques
- aux développeurs Web / Web3
- aux poètes et éditeurs indépendants
- aux structures culturelles

📬 Contact, collaborations, ateliers :  
→ via le site ou les réseaux officiels (à venir)

---

## 📜 Licence & esprit

Le code publié ici vise la **transparence, la pédagogie et la reproductibilité**.  
Les œuvres, elles, restent protégées par leurs auteurs.

> RESCOE est un espace d’expérimentation.  
> Le code est un outil, pas une fin.

---

**RESCOE — Art, code et communauté, en réseau.**  
Version documentation : 2026
