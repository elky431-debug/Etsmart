# Coût d'une analyse de produit sur OpenAI

## Analyse principale (obligatoire)

**Modèle utilisé:** `gpt-4o-mini`

### Consommation de tokens estimée:

1. **Input (prompt):**
   - Prompt texte: ~2,500 tokens (prompt très détaillé)
   - Image avec `detail: 'low'`: ~85 tokens
   - Message système: ~30 tokens
   - **Total input: ~2,615 tokens**

2. **Output (réponse):**
   - max_tokens configuré: 1,500 tokens
   - Réponse JSON moyenne: ~800-1,200 tokens
   - **Total output estimé: ~1,000 tokens**

### Coût GPT-4o-mini (prix OpenAI, janvier 2024):
- **Input:** $0.15 par 1M tokens
- **Output:** $0.60 par 1M tokens

### Calcul:
- Input: 2,615 tokens × $0.15 / 1,000,000 = **$0.00039**
- Output: 1,000 tokens × $0.60 / 1,000,000 = **$0.00060**
- **Total analyse principale: ~$0.001 (0.1 centime)**

---

## Description Etsy (optionnelle)

**Modèle utilisé:** `gpt-4o` (plus cher mais meilleure qualité)

### Consommation de tokens estimée:

1. **Input (prompt):**
   - Prompt texte: ~600 tokens
   - Message système: ~30 tokens
   - **Total input: ~630 tokens**

2. **Output (réponse):**
   - max_tokens configuré: 2,000 tokens
   - Description moyenne (300-500 mots): ~400-800 tokens
   - **Total output estimé: ~600 tokens**

### Coût GPT-4o (prix OpenAI, janvier 2024):
- **Input:** $2.50 par 1M tokens
- **Output:** $10.00 par 1M tokens

### Calcul:
- Input: 630 tokens × $2.50 / 1,000,000 = **$0.00158**
- Output: 600 tokens × $10.00 / 1,000,000 = **$0.00600**
- **Total description Etsy: ~$0.0076 (0.76 centimes)**

---

## Coût total par analyse complète

### Scénario 1: Analyse seule (sans description Etsy)
- **Coût: ~$0.001 (0.1 centime)**

### Scénario 2: Analyse + Description Etsy
- Analyse principale: $0.001
- Description Etsy: $0.0076
- **Coût total: ~$0.0086 (0.86 centimes)**

---

## Projections de coûts

### Pour 100 analyses:
- Analyse seule: **$0.10**
- Analyse + Description: **$0.86**

### Pour 1,000 analyses:
- Analyse seule: **$1.00**
- Analyse + Description: **$8.60**

### Pour 10,000 analyses:
- Analyse seule: **$10.00**
- Analyse + Description: **$86.00**

---

## Notes importantes

1. **Retry mechanism:** Le code inclut un mécanisme de retry (jusqu'à 3 tentatives). En cas d'échec, le coût peut être multiplié par 2-3.

2. **Image detail:** L'image utilise `detail: 'low'` pour réduire les coûts. Si vous passez à `'high'`, le coût de l'image passerait à ~170 tokens (2x plus cher).

3. **Prix variables:** Les prix OpenAI peuvent changer. Vérifiez les tarifs actuels sur [platform.openai.com/pricing](https://platform.openai.com/pricing).

4. **Optimisations possibles:**
   - Réduire `max_tokens` de 1,500 à 1,000: économie de ~$0.0003 par analyse
   - Utiliser `gpt-4o-mini` pour la description Etsy au lieu de `gpt-4o`: économie de ~$0.006 par description

---

## Conclusion

**Le coût d'une analyse complète (analyse + description) est d'environ 0.86 centimes d'euro**, ce qui est extrêmement économique. Pour 1,000 analyses, vous payerez environ **$8.60**.
