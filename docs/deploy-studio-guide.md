# Deploy Studio — Guide de déploiement des contrats Rescoe

## Accès

Réservé aux admins. Dans l'app Rescoe (local) :
```
Dashboard → onglet 🚀 Deploy Studio
```

---

## Configuration requise

### Variable d'environnement (optionnelle)
Par défaut, le Deploy Studio pointe vers :
```
C:/Users/thibf/Documents/App-Rescoe/HardhatRescoe
```

Pour changer le chemin, ajoute dans `.env.local` :
```
HARDHAT_DIR=C:/chemin/vers/ton/projet/HardhatRescoe
```

### Prérequis locaux
- Node.js v20+
- Hardhat installé dans `HardhatRescoe/` (`npm install`)
- MetaMask dans le navigateur
- Pour Base Sepolia/Mainnet : fichier `.env` dans `HardhatRescoe/` avec `RELAYER_PK=0x...`

---

## Pipeline de déploiement — AdhesionRescoe

### Réseau recommandé pour tests : Base Sepolia

**Ordre de déploiement :**

```
1. AdhesionRescoe
   Args:
   - initialOwner: 0x<ton_wallet>
   - _artist:      0x<wallet_artiste>

2. ResCoellectionManager (optionnel si déjà déployé)
   Args:
   - adhesionContract: ← adresse AdhesionRescoe (auto depuis bloc 1)

3. setRescoeManager (appel post-deploy)
   → Appeler AdhesionRescoe.setRescoeManager(adresse_ResCoellectionManager)
```

### Réseau production : Base Mainnet

⚠️ Utilise de l'ETH réel. Assure-toi d'avoir :
- Suffisamment d'ETH sur Base pour le gas
- `RELAYER_PK` configuré dans HardhatRescoe/.env

---

## Workflow complet

### Étape 1 — Compiler les contrats

1. Ouvre Deploy Studio (onglet admin)
2. Sélectionne le réseau (Base Sepolia pour tests)
3. Clique **🔨 Compiler** dans le panneau "Contrats disponibles"
4. Attends la confirmation dans les logs

### Étape 2 — Construire la pipeline

1. Clique sur **AdhesionRescoe** dans la liste → un bloc apparaît
2. Remplis les arguments :
   - `initialOwner` → ton adresse wallet admin
   - `_artist` → adresse du graphiste/artiste
3. Si tu déploies aussi ResCoellectionManager :
   - Clique sur **ResCoellectionManager** → second bloc
   - Pour l'arg `adhesionContract`, clique "⟵ contrat" et pointe vers le bloc AdhesionRescoe

### Étape 3 — Déployer

1. Clique **🚀 Déployer sur baseSepolia**
2. MetaMask s'ouvre → confirme la transaction
3. Attends la confirmation → l'adresse apparaît en vert
4. L'adresse est automatiquement sauvegardée dans `deployed.json`

### Étape 4 — Post-déploiement (si 2 contrats)

1. Note les adresses depuis l'historique
2. Appelle `setRescoeManager` sur AdhesionRescoe via les fonctions du contrat
   (à terme : bouton dans ManageSolidity)

---

## Configuration front-end après déploiement

Mets à jour les variables dans `.env` :
```
NEXT_PUBLIC_RESCOE_ADHERENTS=0x<nouvelle_adresse_AdhesionRescoe>
```

Puis revalide le cache :
```
POST /api/revalidate?caches=members
Header: x-revalidate-secret: <REVALIDATE_SECRET>
```

---

## Notes techniques

- **Local only** : Le Deploy Studio utilise `child_process.exec()` pour appeler Hardhat.
  Il ne fonctionnera pas sur Vercel (les routes renvoient 503 en production).
- **deployed.json** : Sauvegardé dans `HardhatRescoe/deployed.json`. Partagé entre
  l'ancien deploy-ui et le Deploy Studio Rescoe.
- **Mode Hardhat** : Nécessite de démarrer le nœud local (bouton ▶ dans le studio).
  Non requis pour Base Sepolia/Mainnet.
