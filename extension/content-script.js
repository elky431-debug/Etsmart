// Bouton flottant pour import manuel
let importButton = null;
let lastKnownNiche = null;
// Système de logs persistants
function logPersistent(message, level = 'log') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    // Log dans la console avec style visible
    const color = level === 'error' ? '#ff4444' : level === 'warn' ? '#ffaa00' : '#00d4ff';
    const bgColor = level === 'error' ? '#ff000020' : level === 'warn' ? '#ffaa0020' : '#00d4ff20';
    console[level](`%c[ETSMART] ${message}`, `color: ${color}; font-weight: bold; background: ${bgColor}; padding: 2px 5px; border-radius: 3px;`);
    // Sauvegarder dans localStorage (garder les 50 derniers logs)
    try {
        const logs = JSON.parse(localStorage.getItem('etsmart_logs') || '[]');
        logs.push({ timestamp, message, level });
        if (logs.length > 50) {
            logs.shift(); // Garder seulement les 50 derniers
        }
        localStorage.setItem('etsmart_logs', JSON.stringify(logs));
    }
    catch (e) {
        // Ignorer les erreurs de localStorage
    }
}
// Détecter si on est sur une page de boutique
function isShopPage() {
    const url = window.location.href;
    const hostname = window.location.hostname;
    // Vérifier que c'est vraiment une page de boutique Etsy
    // Pattern: etsy.com/shop/nom-boutique ou www.etsy.com/shop/nom-boutique
    const shopPagePattern = /(?:www\.)?etsy\.(?:com|fr)\/shop\/[^\/\?]+/i;
    const isShop = shopPagePattern.test(url) &&
        !url.includes('/search') &&
        !url.includes('/listing/') &&
        hostname.includes('etsy');
    const debugInfo = {
        url,
        hostname,
        isShop,
        patternMatch: shopPagePattern.test(url),
        hasSearch: url.includes('/search'),
        hasListing: url.includes('/listing/')
    };
    logPersistent(`isShopPage check: ${JSON.stringify(debugInfo)}`);
    return isShop;
}
// Mettre à jour le texte du bouton selon le type de page
function updateButtonText() {
    if (!importButton) {
        console.log('[Etsmart] updateButtonText: bouton n\'existe pas encore');
        return;
    }
    const isShop = isShopPage();
    const newText = isShop ? '🔍 Analyser cette boutique' : '📥 Importer les boutiques';
    if (importButton.textContent !== newText) {
        importButton.textContent = newText;
        logPersistent(`Bouton mis à jour: ${isShop ? 'Analyse boutique' : 'Import boutiques'} - URL: ${window.location.href}`);
    }
}
// Créer le bouton flottant
function createImportButton() {
    if (importButton) {
        // Mettre à jour le texte si le bouton existe déjà
        updateButtonText();
        return;
    }
    const isShop = isShopPage();
    importButton = document.createElement('button');
    importButton.textContent = isShop ? '🔍 Analyser cette boutique' : '📥 Importer les boutiques';
    logPersistent(`Bouton créé: ${isShop ? 'Analyse boutique' : 'Import boutiques'} - URL: ${window.location.href}`);
    importButton.type = 'button'; // Empêcher le comportement submit par défaut
    importButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    background: linear-gradient(135deg, #00d4ff 0%, #00c9b7 100%);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 25px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 212, 255, 0.4);
    transition: transform 0.2s;
  `;
    importButton.addEventListener('mouseenter', () => {
        if (importButton)
            importButton.style.transform = 'scale(1.05)';
    });
    importButton.addEventListener('mouseleave', () => {
        if (importButton)
            importButton.style.transform = 'scale(1)';
    });
    importButton.addEventListener('click', async (e) => {
        // Empêcher le comportement par défaut (rechargement de page)
        e.preventDefault();
        e.stopPropagation();
        const isShop = isShopPage();
        logPersistent(`Clic sur le bouton - isShopPage: ${isShop} - URL: ${window.location.href}`);
        if (isShop) {
            // Mode analyse de boutique individuelle
            logPersistent('Déclenchement de l\'analyse de boutique');
            await analyzeSingleShop();
        }
        else {
            // Mode scraping de plusieurs boutiques
            logPersistent('Déclenchement du scraping manuel');
            // Récupérer la niche depuis le storage (fallback: Import manuel)
            const storage = await chrome.storage.local.get(['currentNiche']);
            const niche = typeof storage.currentNiche === 'string' && storage.currentNiche.trim().length > 0
                ? storage.currentNiche
                : 'Import manuel';
            lastKnownNiche = niche;
            // Sauvegarder la niche si elle n'existe pas déjà
            if (!storage.currentNiche) {
                await chrome.storage.local.set({ currentNiche: niche });
            }
            // Demander au background d'ouvrir la page "analyse en cours" (une seule fois)
            try {
                const response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        type: 'OPEN_ANALYZING_PAGE',
                        niche
                    }, (resp) => {
                        if (chrome.runtime.lastError) {
                            console.log('[Etsmart] Erreur sendMessage:', chrome.runtime.lastError.message);
                            resolve(undefined);
                            return;
                        }
                        resolve(resp);
                    });
                });
                if (response?.tabId) {
                    // Sauvegarder l'ID de l'onglet pour l'utiliser plus tard
                    await chrome.storage.local.set({ analyzingTabId: response.tabId });
                    console.log('[Etsmart] Page "Analyse en cours" ouverte via background script, tabId:', response.tabId);
                }
                else {
                    // Fallback: ouvrir via window.open uniquement si le message a échoué
                    console.log('[Etsmart] Fallback: ouverture via window.open');
                    const analyzingUrl = `https://etsmart.app/dashboard/competitors?analyzing=true&niche=${encodeURIComponent(niche)}`;
                    window.open(analyzingUrl, '_blank');
                }
            }
            catch (err) {
                console.log('[Etsmart] Erreur lors de l\'ouverture de la page:', err);
                // Fallback: ouvrir via window.open uniquement en cas d'erreur
                const analyzingUrl = `https://etsmart.app/dashboard/competitors?analyzing=true&niche=${encodeURIComponent(niche)}`;
                window.open(analyzingUrl, '_blank');
            }
            // Lancer le scraping
            scrapeShops();
        }
    });
    document.body.appendChild(importButton);
    // Forcer une mise à jour immédiate après un court délai (pour laisser le DOM se stabiliser)
    setTimeout(() => {
        updateButtonText();
    }, 100);
    // Mettre à jour aussi après un délai plus long (au cas où Etsy charge le contenu de manière asynchrone)
    setTimeout(() => {
        updateButtonText();
    }, 1000);
}
// Extraire les données d'une boutique depuis le DOM
function extractShopData(shopElement) {
    try {
        // Chercher un contexte "carte produit"
        const listingCard = shopElement.closest('[data-listing-id]') || shopElement.closest('li') || shopElement;
        // Trouver le lien de la boutique
        let shopLink = listingCard.querySelector('a[href*="/shop/"]');
        let shopUrl = shopLink ? shopLink.href.split('?')[0] : '';
        let shopName = shopLink?.textContent?.trim() || '';
        // Fallback: essayer de récupérer le nom de boutique dans le texte
        if (!shopName) {
            const text = listingCard.textContent || '';
            const byMatch = text.match(/(?:par|by)\s+([A-Za-z0-9._-]{2,})/i);
            if (byMatch) {
                shopName = byMatch[1].trim();
            }
        }
        // Fallback: si on a un data-shop-name ou data-shop-id
        if (!shopName) {
            const dataShopName = listingCard.getAttribute('data-shop-name');
            if (dataShopName) {
                shopName = dataShopName.trim();
            }
        }
        // Si toujours pas de nom, abandonner
        if (!shopName)
            return null;
        // Si pas de shopUrl, fabriquer une URL Etsy standard
        if (!shopUrl) {
            const slug = shopName.replace(/\s+/g, '');
            shopUrl = `https://www.etsy.com/shop/${encodeURIComponent(slug)}`;
        }
        // Extraire les ventes (ex: "1,234 ventes" ou "234 ventes")
        const salesText = listingCard.textContent || '';
        const salesMatch = salesText.match(/(\d{1,3}(?:\s?\d{3})*)\s*ventes?/i) ||
            salesText.match(/(\d{1,3}(?:,\d{3})*)\s*sales?/i);
        const salesCount = salesMatch ? parseInt(salesMatch[1].replace(/[\s,]/g, '')) : undefined;
        // Extraire la note (ex: "4.8" ou "4,8")
        const ratingMatch = salesText.match(/(\d[,.]\d+)\s*(?:étoiles?|stars?)/i) ||
            shopElement.querySelector('[aria-label*="étoile"], [aria-label*="star"]')?.getAttribute('aria-label')?.match(/(\d[,.]\d+)/);
        const rating = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : undefined;
        // Extraire le nombre d'avis (ex: "123 avis" ou "1,234 reviews")
        const reviewMatch = salesText.match(/(\d{1,3}(?:\s?\d{3})*)\s*avis/i) ||
            salesText.match(/(\d{1,3}(?:,\d{3})*)\s*reviews?/i);
        const reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(/[\s,]/g, '')) : undefined;
        // Extraire l'âge de la boutique (ex: "Depuis 2020" ou "Depuis 2 ans")
        const ageMatch = salesText.match(/depuis\s+(\d{4})/i) ||
            salesText.match(/depuis\s+(\d+)\s*ans?/i) ||
            salesText.match(/since\s+(\d{4})/i);
        const shopAge = ageMatch ? ageMatch[1] : undefined;
        // Extraire 3 listings d'exemple
        const sampleListings = [];
        const listingElements = listingCard.querySelectorAll('a[href*="/listing/"]');
        for (let i = 0; i < Math.min(3, listingElements.length); i++) {
            const listingLink = listingElements[i];
            const title = listingLink.textContent?.trim() || listingLink.getAttribute('aria-label') || 'Produit';
            const url = listingLink.href.split('?')[0];
            // Trouver le prix
            const priceElement = listingLink.closest('.listing')?.querySelector('[class*="price"], .currency-value') ||
                listingLink.parentElement?.querySelector('[class*="price"]');
            const priceText = priceElement?.textContent?.trim() || 'Prix non disponible';
            sampleListings.push({ title, url, priceText });
        }
        return {
            shopUrl,
            shopName,
            salesCount,
            rating,
            reviewCount,
            shopAge,
            sampleListings
        };
    }
    catch (error) {
        console.log('[Etsmart] Erreur lors de l\'extraction des données de boutique:', error);
        return null;
    }
}
// Scroller pour charger plus de boutiques (lazy loading)
async function scrollToLoadMore(maxScrolls = 5) {
    return new Promise((resolve) => {
        let scrolls = 0;
        const scrollInterval = setInterval(() => {
            window.scrollBy(0, 500);
            scrolls++;
            if (scrolls >= maxScrolls) {
                clearInterval(scrollInterval);
                // Attendre que les nouveaux éléments se chargent
                setTimeout(resolve, 2000);
            }
        }, 500);
    });
}
// Analyser une boutique individuelle
async function analyzeSingleShop() {
    try {
        logPersistent('Début de l\'analyse de boutique individuelle');
        const shopUrl = window.location.href.split('?')[0];
        // Ouvrir immédiatement la page "Analyse en cours"
        try {
            const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'OPEN_ANALYZING_PAGE',
                    niche: 'Analyse boutique',
                    shopUrl: shopUrl
                }, (resp) => {
                    if (chrome.runtime.lastError) {
                        console.log('[Etsmart] Erreur sendMessage:', chrome.runtime.lastError.message);
                        resolve(undefined);
                        return;
                    }
                    resolve(resp);
                });
            });
            if (response?.tabId) {
                await chrome.storage.local.set({ analyzingTabId: response.tabId });
                console.log('[Etsmart] Page "Analyse en cours" ouverte via background script, tabId:', response.tabId);
            }
            else {
                // Fallback: ouvrir via window.open
                console.log('[Etsmart] Fallback: ouverture via window.open');
                const analyzingUrl = `https://etsmart.app/dashboard/shop/analyze?analyzing=true&shop=${encodeURIComponent(shopUrl)}`;
                window.open(analyzingUrl, '_blank');
            }
        }
        catch (err) {
            console.log('[Etsmart] Erreur lors de l\'ouverture de la page:', err);
            const analyzingUrl = `https://etsmart.app/dashboard/shop/analyze?analyzing=true&shop=${encodeURIComponent(shopUrl)}`;
            window.open(analyzingUrl, '_blank');
        }
        const shopData = {
            shopUrl,
            shopName: '',
            listings: []
        };
        // Extraire le nom de la boutique
        const shopNameElement = document.querySelector('h1[data-shop-name], h1.shop-name, h1[class*="shop"]') ||
            document.querySelector('h1') ||
            document.querySelector('[data-shop-name]');
        shopData.shopName = shopNameElement?.textContent?.trim() ||
            document.title.replace(' | Etsy', '').trim() ||
            'Boutique inconnue';
        // Extraire les ventes totales
        const salesText = document.body.textContent || '';
        const salesMatch = salesText.match(/(\d{1,3}(?:\s?\d{3})*)\s*ventes?/i) ||
            salesText.match(/(\d{1,3}(?:,\d{3})*)\s*sales?/i);
        shopData.salesCount = salesMatch ? parseInt(salesMatch[1].replace(/[\s,]/g, '')) : undefined;
        // Extraire la note moyenne
        const ratingElement = document.querySelector('[aria-label*="étoile"], [aria-label*="star"], .rating, [class*="rating"]');
        const ratingText = ratingElement?.getAttribute('aria-label') || ratingElement?.textContent || '';
        const ratingMatch = ratingText.match(/(\d[,.]\d+)/);
        shopData.rating = ratingMatch ? parseFloat(ratingMatch[1].replace(',', '.')) : undefined;
        // Extraire le nombre d'avis
        const reviewMatch = salesText.match(/(\d{1,3}(?:\s?\d{3})*)\s*avis/i) ||
            salesText.match(/(\d{1,3}(?:,\d{3})*)\s*reviews?/i);
        shopData.reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(/[\s,]/g, '')) : undefined;
        // Extraire l'âge de la boutique
        const ageMatch = salesText.match(/depuis\s+(\d{4})/i) ||
            salesText.match(/depuis\s+(\d+)\s*ans?/i) ||
            salesText.match(/since\s+(\d{4})/i) ||
            salesText.match(/opened\s+in\s+(\d{4})/i);
        shopData.shopAge = ageMatch ? ageMatch[1] : undefined;
        // Extraire la localisation
        const locationElement = document.querySelector('[data-location], .shop-location, [class*="location"]');
        shopData.location = locationElement?.textContent?.trim() || undefined;
        // Scraper tous les listings de la boutique
        await scrollToLoadMore(10); // Scroller plus pour charger tous les listings
        const listingCards = document.querySelectorAll('[data-listing-id], .listing-card, .v2-listing-card, a[href*="/listing/"]');
        console.log(`[Etsmart] ${listingCards.length} listings trouvés`);
        const seenListingUrls = new Set();
        for (const card of Array.from(listingCards).slice(0, 50)) { // Limiter à 50 listings
            try {
                const listingLink = card.querySelector('a[href*="/listing/"]') ||
                    card;
                const listingUrl = listingLink?.href?.split('?')[0];
                if (!listingUrl || seenListingUrls.has(listingUrl))
                    continue;
                seenListingUrls.add(listingUrl);
                const title = listingLink?.textContent?.trim() ||
                    listingLink?.getAttribute('aria-label')?.trim() ||
                    card.querySelector('h2, h3, [class*="title"]')?.textContent?.trim() ||
                    'Produit sans titre';
                // Extraire le prix
                const priceElement = card.querySelector('[class*="price"], .currency-value, [data-price]') ||
                    card.closest('.listing')?.querySelector('[class*="price"]');
                const priceText = priceElement?.textContent?.trim() || '';
                const priceMatch = priceText.match(/(\d+[,.]?\d*)/);
                const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : 0;
                // Extraire les ventes du listing
                const listingSalesText = card.textContent || '';
                const listingSalesMatch = listingSalesText.match(/(\d+)\s*ventes?/i) ||
                    listingSalesText.match(/(\d+)\s*sales?/i);
                const listingSales = listingSalesMatch ? parseInt(listingSalesMatch[1]) : undefined;
                // Extraire les avis du listing
                const listingReviewMatch = listingSalesText.match(/(\d+)\s*avis/i) ||
                    listingSalesText.match(/(\d+)\s*reviews?/i);
                const listingReviews = listingReviewMatch ? parseInt(listingReviewMatch[1]) : undefined;
                // Extraire la note du listing
                const listingRatingElement = card.querySelector('[aria-label*="étoile"], [aria-label*="star"]');
                const listingRatingText = listingRatingElement?.getAttribute('aria-label') || '';
                const listingRatingMatch = listingRatingText.match(/(\d[,.]\d+)/);
                const listingRating = listingRatingMatch ? parseFloat(listingRatingMatch[1].replace(',', '.')) : undefined;
                // Extraire les images
                const images = [];
                const imgElements = card.querySelectorAll('img[src], img[data-src]');
                for (const img of Array.from(imgElements).slice(0, 5)) {
                    const imgSrc = img.src || img.getAttribute('data-src');
                    if (imgSrc && !images.includes(imgSrc)) {
                        images.push(imgSrc);
                    }
                }
                shopData.listings.push({
                    title,
                    url: listingUrl,
                    price,
                    sales: listingSales,
                    reviews: listingReviews,
                    rating: listingRating,
                    images
                });
            }
            catch (err) {
                console.log('[Etsmart] Erreur extraction listing:', err);
            }
        }
        // Calculer le revenu estimé (prix moyen × ventes)
        if (shopData.listings.length > 0) {
            const totalRevenue = shopData.listings.reduce((sum, listing) => {
                return sum + (listing.price * (listing.sales || 0));
            }, 0);
            shopData.totalRevenue = totalRevenue;
            // Estimation du revenu mensuel (simplifié : total / 12 si on a l'âge, sinon estimation)
            if (shopData.shopAge) {
                const years = new Date().getFullYear() - parseInt(shopData.shopAge);
                if (years > 0) {
                    shopData.monthlyRevenue = totalRevenue / (years * 12);
                }
            }
        }
        // Extraire la description de la boutique
        const descriptionElement = document.querySelector('.shop-description, [class*="description"], .shop-about');
        shopData.description = descriptionElement?.textContent?.trim() || undefined;
        logPersistent(`Données de boutique extraites - Nombre de listings: ${shopData.listings.length} - Ventes: ${shopData.salesCount || 0} - Revenu: ${shopData.totalRevenue || 0}`);
        // Envoyer les données au background script
        chrome.runtime.sendMessage({
            type: 'ANALYZE_SHOP',
            shopData: shopData
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('[Etsmart] Erreur lors de l\'envoi des données de boutique:', chrome.runtime.lastError);
            }
            else {
                logPersistent(`Message ANALYZE_SHOP envoyé avec succès - Réponse: ${JSON.stringify(response)}`);
            }
        });
    }
    catch (error) {
        logPersistent(`Erreur lors de l'analyse de boutique: ${String(error)}`, 'error');
    }
}
// Scraper toutes les boutiques visibles
async function scrapeShops() {
    try {
        logPersistent('Début du scraping des boutiques');
        // Créer le bouton si nécessaire
        createImportButton();
        // Scroller pour charger plus de boutiques
        await scrollToLoadMore(5);
        // Trouver tous les éléments de boutique
        const shopSelectors = [
            '[data-shop-id]',
            '[data-listing-id]',
            '.shop2-shop-card',
            '.shop-card',
            'a[href*="/shop/"]',
            'a[href*="/listing/"]'
        ];
        const shopElements = [];
        for (const selector of shopSelectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            shopElements.push(...elements);
        }
        // Éviter les doublons avec un Set
        const seenUrls = new Set();
        const shops = [];
        for (const element of shopElements) {
            const shopData = extractShopData(element);
            if (shopData && !seenUrls.has(shopData.shopUrl)) {
                seenUrls.add(shopData.shopUrl);
                shops.push(shopData);
            }
        }
        console.log(`[Etsmart] ${shops.length} boutiques scrapées`);
        // Envoyer les données au background script
        chrome.runtime.sendMessage({
            type: 'SCRAPED_DATA',
            data: shops,
            niche: lastKnownNiche || undefined,
            searchUrl: window.location.href
        }).catch((error) => {
            console.log('[Etsmart] Erreur lors de l\'envoi des données:', error);
        });
    }
    catch (error) {
        console.log('[Etsmart] Erreur lors du scraping:', error);
    }
}
// Écouter les messages du background script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
        if (message.type === 'SCRAPE_NOW') {
            console.log('[Etsmart] Message SCRAPE_NOW reçu');
            scrapeShops().then(() => {
                sendResponse({ success: true });
            }).catch((error) => {
                console.log('[Etsmart] Erreur dans scrapeShops:', error);
                sendResponse({ success: false, error: String(error) });
            });
            return true; // Indique qu'on répondra de manière asynchrone
        }
    }
    catch (error) {
        console.log('[Etsmart] Erreur dans le listener de messages:', error);
        sendResponse({ success: false, error: String(error) });
    }
    return false;
});
// Créer le bouton au chargement de la page
function initExtension() {
    logPersistent(`Initialisation extension - URL: ${window.location.href} - ReadyState: ${document.readyState}`);
    // Attendre que le body soit disponible
    if (document.body) {
        createImportButton();
    }
    else {
        // Si le body n'est pas encore disponible, attendre
        const bodyObserver = new MutationObserver((mutations, obs) => {
            if (document.body) {
                obs.disconnect();
                createImportButton();
            }
        });
        bodyObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
        // Timeout de sécurité
        setTimeout(() => {
            if (document.body && !importButton) {
                createImportButton();
            }
        }, 2000);
    }
}
// Afficher les logs persistants au démarrage
function displayPersistentLogs() {
    try {
        const logs = JSON.parse(localStorage.getItem('etsmart_logs') || '[]');
        if (logs.length > 0) {
            console.log('%c═══════════════════════════════════════════════════════════════', 'color: #00d4ff; font-size: 14px; font-weight: bold;');
            console.log('%c[ETSMART] LOGS PERSISTANTS (50 derniers)', 'color: #00d4ff; font-size: 16px; font-weight: bold; background: #000; padding: 5px;');
            console.log('%c═══════════════════════════════════════════════════════════════', 'color: #00d4ff; font-size: 14px; font-weight: bold;');
            logs.forEach((log) => {
                const color = log.level === 'error' ? '#ff4444' : log.level === 'warn' ? '#ffaa00' : '#00d4ff';
                console[log.level](`%c[ETSMART] ${log.message}`, `color: ${color}; font-weight: bold;`);
            });
            console.log('%c═══════════════════════════════════════════════════════════════', 'color: #00d4ff; font-size: 14px; font-weight: bold;');
        }
        else {
            console.log('%c[ETSMART] Extension chargée - Aucun log persistant', 'color: #00d4ff; font-size: 14px; font-weight: bold; background: #000; padding: 5px;');
        }
    }
    catch (e) {
        console.error('[ETSMART] Erreur affichage logs:', e);
    }
}
// Afficher un message de démarrage très visible
console.log('%c═══════════════════════════════════════════════════════════════', 'color: #00d4ff; font-size: 14px; font-weight: bold;');
console.log('%c[ETSMART] EXTENSION CHARGÉE', 'color: #00d4ff; font-size: 18px; font-weight: bold; background: #000; padding: 10px;');
console.log('%cURL:', 'color: #00c9b7; font-weight: bold;', window.location.href);
console.log('%cReadyState:', 'color: #00c9b7; font-weight: bold;', document.readyState);
console.log('%c═══════════════════════════════════════════════════════════════', 'color: #00d4ff; font-size: 14px; font-weight: bold;');
// Vérifier si on est sur Etsy
if (window.location.hostname.includes('etsy')) {
    console.log('%c[ETSMART] Page Etsy détectée ✓', 'color: #00ff00; font-weight: bold;');
}
else {
    console.log('%c[ETSMART] ⚠️ Page non-Etsy détectée', 'color: #ffaa00; font-weight: bold;');
}
// Afficher les logs au démarrage
displayPersistentLogs();
// Initialiser immédiatement si possible
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
}
else {
    initExtension();
}
// Réinitialiser si la page change (pour les SPA)
window.addEventListener('load', () => {
    setTimeout(initExtension, 500);
});
// Observer les changements d'URL (pour les Single Page Applications comme Etsy)
let lastUrl = window.location.href;
let checkInterval = null;
function startUrlObserver() {
    if (checkInterval)
        return;
    checkInterval = window.setInterval(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            console.log('[Etsmart] URL changée:', lastUrl, '->', currentUrl);
            lastUrl = currentUrl;
            updateButtonText();
        }
    }, 500);
}
// Démarrer l'observateur
startUrlObserver();
// Écouter les changements d'historique (pushState/popState)
const originalPushState = history.pushState;
history.pushState = function (...args) {
    originalPushState.apply(history, args);
    lastUrl = window.location.href;
    setTimeout(() => {
        updateButtonText();
    }, 200);
};
const originalReplaceState = history.replaceState;
history.replaceState = function (...args) {
    originalReplaceState.apply(history, args);
    lastUrl = window.location.href;
    setTimeout(() => {
        updateButtonText();
    }, 200);
};
window.addEventListener('popstate', () => {
    lastUrl = window.location.href;
    setTimeout(() => {
        updateButtonText();
    }, 200);
});
// Observer les changements du DOM (pour les SPA comme Etsy qui changent le contenu sans changer l'URL)
const observer = new MutationObserver(() => {
    // Vérifier périodiquement si on est toujours sur la même page
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        updateButtonText();
    }
});
observer.observe(document.body, {
    childList: true,
    subtree: true
});
