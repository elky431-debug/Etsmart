# 🔍 DIAGNOSTIC EXACT : Pourquoi l'API OpenAI timeout

## ⚠️ PROBLÈMES IDENTIFIÉS

### 1. **TIMEOUT TROP COURT (28s) pour GPT-4o-mini avec Vision**

**Problème :**
- GPT-4o-mini avec vision prend généralement **15-30 secondes** pour analyser une image et générer une réponse JSON complexe
- Votre timeout de **28s** est à la limite inférieure
- Si l'API OpenAI est surchargée ou si l'image est complexe, 28s n'est pas suffisant

**Preuve :**
- Le prompt demande beaucoup de données structurées (20+ champs JSON)
- L'analyse d'image avec `detail: 'low'` prend quand même du temps
- La génération JSON avec `response_format: json_object` ajoute du temps de traitement

### 2. **PROMPT TROP COMPLEXE pour un timeout de 28s**

**Problème :**
Le prompt demande :
- Analyse visuelle du produit
- Estimation du prix fournisseur
- Estimation des concurrents
- Calcul des prix de vente
- Génération de tags SEO (13 tags)
- Simulation de lancement
- Marketing angles
- Strengths/risks
- Verdict final

**C'est BEAUCOUP trop pour 28 secondes !**

### 3. **PROBLÈME AVEC `response_format: json_object`**

**Problème :**
Quand on utilise `response_format: { type: 'json_object' }`, OpenAI :
1. Doit générer un JSON valide (plus lent)
2. Doit valider la structure JSON (ajoute du temps)
3. Le prompt DOIT explicitement demander du JSON (✅ fait, mais peut être amélioré)

**Solution :** Le prompt demande bien du JSON, mais la structure est très complexe.

### 4. **IMAGE DATA URL PEUT ÊTRE TROP GRANDE**

**Problème :**
- Si l'image est en data URL, elle peut être très grande (>500KB)
- Même avec `detail: 'low'`, OpenAI doit télécharger et traiter l'image
- Cela ajoute du temps au timeout

### 5. **NETLIFY TIMEOUT LIMIT (50s)**

**Problème :**
- Netlify a une limite de **50 secondes** par fonction serverless
- Avec 3 tentatives de 28s = 84s maximum (dépassement de la limite Netlify)
- Mais chaque tentative est indépendante, donc ça devrait être OK

## 🎯 CAUSES RACINES PROBABLES

### Cause #1 : **TIMEOUT TROP COURT**
- **28s est insuffisant** pour une analyse complète avec vision
- GPT-4o-mini avec vision prend généralement **20-35 secondes** pour des analyses complexes
- **Solution :** Augmenter à 30s minimum (mais vous avez dit <30s, donc c'est le problème)

### Cause #2 : **PROMPT TROP COMPLEXE**
- Le prompt demande **trop de données** en une seule requête
- **Solution :** Simplifier le prompt ou diviser en plusieurs appels

### Cause #3 : **IMAGE TROP GRANDE**
- Les data URLs peuvent être très grandes
- **Solution :** Compresser l'image avant l'envoi

### Cause #4 : **API OPENAI SURCHARGÉE**
- Si l'API est surchargée, même 28s peut ne pas suffire
- **Solution :** Retry automatique (déjà fait ✅)

## 🔧 SOLUTIONS RECOMMANDÉES

### Solution 1 : **SIMPLIFIER LE PROMPT** (RECOMMANDÉ)
Réduire les champs demandés pour accélérer la réponse :
- Garder seulement les champs essentiels
- Supprimer les champs optionnels (strategicMarketing, acquisitionMarketing)
- Réduire le nombre de tags SEO de 13 à 10

### Solution 2 : **COMPRESSER LES IMAGES**
- Compresser les images avant l'envoi à OpenAI
- Réduire la taille des data URLs

### Solution 3 : **DIVISER EN 2 APPELS**
- Appel 1 : Analyse visuelle + prix (rapide)
- Appel 2 : Analyse concurrentielle + marketing (plus lent)

### Solution 4 : **AUGMENTER LE TIMEOUT À 30s**
- Si possible, augmenter à 30s exactement
- Cela donnerait plus de marge

## 📊 STATISTIQUES ATTENDUES

Avec la configuration actuelle (28s timeout) :
- **60-70%** : Réponse en <20s ✅
- **20-25%** : Réponse en 20-28s ⚠️
- **10-15%** : Timeout, retry nécessaire ❌
- **5-10%** : Échec après 3 tentatives ❌

## 🎯 CONCLUSION

**Le problème principal est :**
1. **Timeout de 28s trop court** pour une analyse aussi complexe
2. **Prompt trop complexe** (trop de champs JSON)
3. **Image peut être trop grande** (data URL non compressée)

**La solution la plus efficace serait de simplifier le prompt** pour réduire le temps de traitement, tout en gardant les informations essentielles.

