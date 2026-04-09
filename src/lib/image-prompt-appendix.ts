/**
 * Complément aux prompts image du pipeline (`generate-images-pipeline.ts`).
 * Ce texte est ajouté à la fin de chaque requête Gemini, après :
 * baseContext, prompts 1–7, instructions supplémentaires client, fond personnalisé.
 */
export const GEMINI_IMAGE_PROMPT_APPENDIX = `
THEMATIC ENVIRONMENT (apply on every shot unless a user custom background is specified above):
Place the product in an environment and with props that clearly belong to the same universe as the product
(e.g. book → reading nook, library shelves, or writer’s desk softly behind; candle → cozy bedroom or bath; jewelry → marble, velvet, or vanity context).
The background and supporting props must feel intentional and on-theme, not generic empty gray voids.
Use shallow depth of field: background noticeably softer and more blurred than the product; the product must stay the sharpest, clearest subject.

PRODUCT FIDELITY: Never swap the product for a simpler stand-in on any shot — especially close-ups and dimension diagrams must still show the real item from the reference (same cover art, printed text, colors, materials).

If the instructions above already specify a user-provided custom background image, keep that image as the environment and do not replace it with a different thematic scene.
`.trim();
