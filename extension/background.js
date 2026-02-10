"use strict";
const EXTENSION_ID = 'YOUR_EXTENSION_ID'; // À remplacer par l'ID réel après installation
const API_BASE_URL = 'https://etsmart.app'; // URL publique du SaaS par défaut
// Nettoyer le storage au démarrage pour supprimer toute ancienne valeur localhost
chrome.storage.local.get(['apiBaseUrl'], (result) => {
    if (result.apiBaseUrl && typeof result.apiBaseUrl === 'string' && result.apiBaseUrl.includes('localhost')) {
        console.log('[Etsmart Background] Nettoyage de l\'ancienne URL localhost du storage');
        chrome.storage.local.set({ apiBaseUrl: API_BASE_URL });
    }
    else if (!result.apiBaseUrl) {
        // Initialiser avec l'URL publique si pas de valeur
        chrome.storage.local.set({ apiBaseUrl: API_BASE_URL });
    }
});
// Fonction pour obtenir l'URL de l'API (toujours utiliser l'URL publique, ignorer localhost)
function getApiBaseUrl(messageApiUrl) {
    // Toujours utiliser l'URL publique, ignorer localhost
    return API_BASE_URL;
}
// Écouter les messages externes depuis le frontend web
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    try {
        if (message.type === 'START_IMPORT' && message.searchUrl && message.niche) {
            console.log('[Etsmart Background] Démarrage de l\'import pour:', message.niche);
            // Toujours utiliser l'URL publique, ignorer localhost
            chrome.storage.local.set({ apiBaseUrl: API_BASE_URL });
            handleImport(message.searchUrl, message.niche).then(() => {
                sendResponse({ success: true });
            }).catch((error) => {
                console.log('[Etsmart Background] Erreur dans handleImport:', error);
                sendResponse({ success: false, error: String(error) });
            });
            return true; // Réponse asynchrone
        }
    }
    catch (error) {
        console.log('[Etsmart Background] Erreur dans onMessageExternal:', error);
        sendResponse({ success: false, error: String(error) });
    }
    return false;
});
// Écouter les messages internes depuis le content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (message.type === 'OPEN_ANALYZING_PAGE' && message.niche) {
            // Vérifier d'abord si un onglet "analyse en cours" existe déjà
            chrome.storage.local.get(['analyzingTabId', 'apiBaseUrl'], async (result) => {
                let tabId = result.analyzingTabId;
                // Toujours utiliser l'URL publique, ignorer localhost du storage
                const apiBaseUrl = (result.apiBaseUrl && typeof result.apiBaseUrl === 'string' && !result.apiBaseUrl.includes('localhost')) ? result.apiBaseUrl : API_BASE_URL;
                // Si c'est une analyse de boutique, utiliser l'URL de boutique
                const isShopAnalysis = message.shopUrl || message.niche === 'Analyse boutique';
                // Pour les testeurs Google, utiliser la page secrète de test
                const useTestPage = message.useTestPage || false;
                const analyzingUrl = useTestPage
                    ? `${apiBaseUrl}/test-extension?analyzing=true`
                    : isShopAnalysis && message.shopUrl
                        ? `${apiBaseUrl}/dashboard/shop/analyze?analyzing=true&shop=${encodeURIComponent(message.shopUrl)}`
                        : `${apiBaseUrl}/dashboard/competitors?analyzing=true&niche=${encodeURIComponent(message.niche || 'Import manuel')}`;
                // Vérifier si l'onglet existe encore
                if (tabId && typeof tabId === 'number') {
                    try {
                        const existingTab = await chrome.tabs.get(tabId);
                        if (existingTab && existingTab.id) {
                            // Vérifier si l'URL correspond (pour éviter de réutiliser un onglet d'une autre analyse)
                            if (existingTab.url && existingTab.url.includes(analyzingUrl.split('?')[0])) {
                                // L'onglet existe déjà et correspond, l'activer
                                await chrome.tabs.update(tabId, { active: true });
                                console.log('[Etsmart Background] Onglet existant réutilisé:', tabId);
                                sendResponse({ success: true, tabId: tabId });
                                return;
                            }
                            else {
                                console.log('[Etsmart Background] Onglet existant ne correspond pas, création d\'un nouveau');
                                tabId = undefined;
                            }
                        }
                    }
                    catch (err) {
                        console.log('[Etsmart Background] Onglet existant non trouvé, création d\'un nouveau');
                        tabId = undefined;
                    }
                }
                // Créer un nouvel onglet uniquement si aucun n'existe ou si l'existant ne correspond pas
                try {
                    const tab = await chrome.tabs.create({ url: analyzingUrl, active: true });
                    if (tab.id) {
                        await chrome.storage.local.set({ analyzingTabId: tab.id });
                        console.log('[Etsmart Background] Nouvel onglet créé:', tab.id, 'URL:', analyzingUrl);
                        sendResponse({ success: true, tabId: tab.id });
                    }
                    else {
                        sendResponse({ success: false, error: 'Tab ID not available' });
                    }
                }
                catch (err) {
                    console.log('[Etsmart Background] Erreur création onglet:', err);
                    sendResponse({ success: false, error: String(err) });
                }
            });
            return true; // Réponse asynchrone
        }
        if (message.type === 'SCRAPED_DATA' && message.data) {
            console.log('[Etsmart Background] Données scrapées reçues:', message.data.length, 'boutiques');
            // Récupérer la niche depuis le storage
            chrome.storage.local.get(['currentNiche', 'currentSearchUrl'], (result) => {
                const resolvedNiche = result.currentNiche || message.niche || 'Import manuel';
                const resolvedSearchUrl = result.currentSearchUrl || message.searchUrl;
                if (resolvedNiche && message.data) {
                    sendToAPI(resolvedNiche, message.data, resolvedSearchUrl).then(() => {
                        sendResponse({ success: true });
                    }).catch((error) => {
                        console.log('[Etsmart Background] Erreur dans sendToAPI:', error);
                        sendResponse({ success: false, error: String(error) });
                    });
                }
                else {
                    console.log('[Etsmart Background] Pas de niche trouvée dans le storage');
                    sendResponse({ success: false, error: 'Niche non trouvée' });
                }
            });
            return true; // Réponse asynchrone
        }
        if (message.type === 'ANALYZE_SHOP' && message.shopData) {
            console.log('[Etsmart Background] Analyse de boutique individuelle reçue:', message.shopData.shopName);
            analyzeSingleShop(message.shopData).then(() => {
                sendResponse({ success: true });
            }).catch((error) => {
                console.log('[Etsmart Background] Erreur dans analyzeSingleShop:', error);
                sendResponse({ success: false, error: String(error) });
            });
            return true; // Réponse asynchrone
        }
    }
    catch (error) {
        console.log('[Etsmart Background] Erreur dans onMessage:', error);
        sendResponse({ success: false, error: String(error) });
    }
    return false;
});
// Gérer l'import : ouvrir Etsy et scraper
async function handleImport(searchUrl, niche) {
    try {
        // Sauvegarder la niche et l'URL dans le storage
        await chrome.storage.local.set({ currentNiche: niche, currentSearchUrl: searchUrl });
        // Ouvrir un nouvel onglet Etsy
        const tab = await chrome.tabs.create({ url: searchUrl, active: true });
        // Attendre que la page soit complètement chargée
        await waitForTabComplete(tab.id);
        // Attendre 3 secondes supplémentaires pour le chargement complet
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Envoyer le message au content script pour scraper
        await chrome.tabs.sendMessage(tab.id, { type: 'SCRAPE_NOW' });
        console.log('[Etsmart Background] Message SCRAPE_NOW envoyé au content script');
    }
    catch (error) {
        console.log('[Etsmart Background] Erreur dans handleImport:', error);
    }
}
// Attendre qu'un onglet soit complètement chargé
function waitForTabComplete(tabId) {
    return new Promise((resolve) => {
        const listener = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
        // Timeout de sécurité (30 secondes)
        setTimeout(() => {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
        }, 30000);
    });
}
// Analyser une boutique individuelle
async function analyzeSingleShop(shopData) {
    try {
        // Ouvrir la page "Analyse en cours" pour une boutique
        let resultsTabId;
        // Vérifier si un onglet existe déjà
        const storage = await chrome.storage.local.get(['analyzingTabId', 'apiBaseUrl']);
        if (storage.analyzingTabId && typeof storage.analyzingTabId === 'number') {
            try {
                const existingTab = await chrome.tabs.get(storage.analyzingTabId);
                if (existingTab && existingTab.id) {
                    resultsTabId = existingTab.id;
                    await chrome.tabs.update(resultsTabId, { active: true });
                }
            }
            catch (err) {
                console.log('[Etsmart Background] Onglet non trouvé, création d\'un nouveau');
                resultsTabId = undefined;
            }
        }
        // Récupérer l'URL de l'API depuis le storage (ignorer localhost)
        const apiBaseUrl = (storage.apiBaseUrl && typeof storage.apiBaseUrl === 'string' && !storage.apiBaseUrl.includes('localhost')) ? storage.apiBaseUrl : API_BASE_URL;
        // Pour les testeurs Google, utiliser la page secrète de test
        const useTestPage = shopData.useTestPage || false;
        // Créer un nouvel onglet si nécessaire
        if (!resultsTabId) {
            const analyzingUrl = useTestPage
                ? `${apiBaseUrl}/test-extension?analyzing=true&shop=${encodeURIComponent(shopData.shopUrl)}`
                : `${apiBaseUrl}/dashboard/shop/analyze?analyzing=true&shop=${encodeURIComponent(shopData.shopUrl)}`;
            const newTab = await chrome.tabs.create({ url: analyzingUrl, active: true });
            resultsTabId = newTab.id;
            if (resultsTabId) {
                await chrome.storage.local.set({ analyzingTabId: resultsTabId });
            }
        }
        // Envoyer les données à l'API
        const response = await fetch(`${apiBaseUrl}/api/shop/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                shop: shopData
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.log('[Etsmart Background] Erreur API:', response.status, errorText);
            if (resultsTabId) {
                await chrome.tabs.update(resultsTabId, {
                    url: `${apiBaseUrl}/dashboard/shop/analyze?import=error&message=${encodeURIComponent(errorText)}`
                });
            }
            return;
        }
        const result = await response.json();
        console.log('[Etsmart Background] Analyse de boutique terminée');
        // Sauvegarder les résultats
        if (result.success && resultsTabId) {
            try {
                await waitForTabComplete(resultsTabId);
                await chrome.scripting.executeScript({
                    target: { tabId: resultsTabId },
                    func: (data) => {
                        try {
                            localStorage.setItem('shopAnalysis', JSON.stringify(data));
                            sessionStorage.setItem('shopAnalysis', JSON.stringify(data));
                            window.dispatchEvent(new CustomEvent('shopAnalysisReady', { detail: data }));
                            console.log('[Etsmart] Données d\'analyse de boutique sauvegardées');
                        }
                        catch (err) {
                            console.error('[Etsmart] Erreur lors de la sauvegarde:', err);
                        }
                    },
                    args: [result]
                });
                const useTestPage = shopData.useTestPage || false;
                const resultsUrl = useTestPage
                    ? `${apiBaseUrl}/test-extension?shop=${encodeURIComponent(shopData.shopUrl)}&import=done&timestamp=${Date.now()}`
                    : `${apiBaseUrl}/dashboard/shop/analyze?shop=${encodeURIComponent(shopData.shopUrl)}&import=done&timestamp=${Date.now()}`;
                await chrome.tabs.update(resultsTabId, { url: resultsUrl });
                await chrome.storage.local.remove(['analyzingTabId']);
            }
            catch (scriptError) {
                console.log('[Etsmart Background] Erreur injection script:', scriptError);
                const useTestPage = shopData.useTestPage || false;
                const resultsUrl = useTestPage
                    ? `${apiBaseUrl}/test-extension?shop=${encodeURIComponent(shopData.shopUrl)}&import=done&timestamp=${Date.now()}`
                    : `${apiBaseUrl}/dashboard/shop/analyze?shop=${encodeURIComponent(shopData.shopUrl)}&import=done&timestamp=${Date.now()}`;
                await chrome.tabs.update(resultsTabId, { url: resultsUrl });
            }
        }
    }
    catch (error) {
        console.log('[Etsmart Background] Erreur lors de l\'analyse de boutique:', error);
    }
}
// Envoyer les données à l'API backend
async function sendToAPI(niche, shops, searchUrl) {
    try {
        // Récupérer l'URL de l'API depuis le storage (ignorer localhost)
        const storage = await chrome.storage.local.get(['analyzingTabId', 'apiBaseUrl']);
        const apiBaseUrl = (storage.apiBaseUrl && typeof storage.apiBaseUrl === 'string' && !storage.apiBaseUrl.includes('localhost')) ? storage.apiBaseUrl : API_BASE_URL;
        let resultsTabId;
        if (storage.analyzingTabId && typeof storage.analyzingTabId === 'number') {
            // Vérifier si l'onglet existe encore
            try {
                const existingTab = await chrome.tabs.get(storage.analyzingTabId);
                if (existingTab && existingTab.id) {
                    resultsTabId = existingTab.id;
                    // Activer l'onglet
                    await chrome.tabs.update(resultsTabId, { active: true });
                }
            }
            catch (err) {
                console.log('[Etsmart Background] Onglet non trouvé, création d\'un nouveau');
                resultsTabId = undefined;
            }
        }
        // Si pas d'onglet valide, en créer un nouveau
        if (!resultsTabId) {
            // Pour les testeurs Google, utiliser la page secrète de test
            const useTestPage = shops && shops.length > 0 && shops[0].useTestPage || false;
            const analyzingUrl = useTestPage
                ? `${apiBaseUrl}/test-extension?analyzing=true&niche=${encodeURIComponent(niche)}`
                : `${apiBaseUrl}/dashboard/competitors?analyzing=true&niche=${encodeURIComponent(niche)}`;
            const newTab = await chrome.tabs.create({ url: analyzingUrl, active: true });
            resultsTabId = newTab.id;
        }
        const response = await fetch(`${apiBaseUrl}/api/competitors/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                niche,
                shops,
                source: 'extension',
                searchUrl
            }),
        });
        if (!response.ok) {
            let errorMessage = 'Erreur lors de l\'analyse';
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
                // Si c'est un timeout, message spécifique
                if (response.status === 504 || errorMessage.includes('timeout') || errorMessage.includes('trop de temps')) {
                    errorMessage = 'L\'analyse prend plus de temps que prévu. L\'analyse continue en arrière-plan, veuillez patienter...';
                }
            } catch (e) {
                const errorText = await response.text().catch(() => 'Erreur inconnue');
                errorMessage = errorText.length > 200 ? 'Erreur lors de l\'analyse' : errorText;
            }
            console.log('[Etsmart Background] Erreur API:', response.status, errorMessage);
            // Mettre à jour l'onglet avec l'erreur (rester sur la page d'analyse, ne pas rediriger)
            if (resultsTabId) {
                await waitForTabComplete(resultsTabId);
                await chrome.scripting.executeScript({
                    target: { tabId: resultsTabId },
                    func: (message) => {
                        try {
                            // Afficher l'erreur dans la page sans rediriger
                            const errorEvent = new CustomEvent('competitorAnalysisError', { 
                                detail: { message } 
                            });
                            window.dispatchEvent(errorEvent);
                            console.log('[Etsmart] Erreur affichée:', message);
                        } catch (err) {
                            console.error('[Etsmart] Erreur affichage erreur:', err);
                        }
                    },
                    args: [errorMessage]
                });
            }
            return;
        }
        const result = await response.json();
        console.log('[Etsmart Background] Analyse terminée:', result.shopsCount, 'boutiques analysées');
        // Sauvegarder les résultats dans localStorage via injection de script
        if (result.success && resultsTabId) {
            try {
                await waitForTabComplete(resultsTabId);
                // Injecter un script pour sauvegarder dans localStorage de la page
                await chrome.scripting.executeScript({
                    target: { tabId: resultsTabId },
                    func: (data) => {
                        try {
                            localStorage.setItem('competitorAnalysis', JSON.stringify(data));
                            sessionStorage.setItem('competitorAnalysis', JSON.stringify(data));
                            // Déclencher un événement pour notifier la page
                            window.dispatchEvent(new CustomEvent('competitorAnalysisReady', { detail: data }));
                            console.log('[Etsmart] Données sauvegardées dans localStorage');
                        }
                        catch (err) {
                            console.error('[Etsmart] Erreur lors de la sauvegarde:', err);
                        }
                    },
                    args: [result]
                });
                console.log('[Etsmart Background] Script injecté avec succès');
                // Attendre un peu pour que le script s'exécute
                await new Promise(resolve => setTimeout(resolve, 500));
                // Mettre à jour l'URL pour afficher les résultats
                const useTestPage = shops && shops.length > 0 && shops[0].useTestPage || false;
                const resultsUrl = useTestPage
                    ? `${apiBaseUrl}/test-extension?niche=${encodeURIComponent(niche)}&import=done&timestamp=${Date.now()}`
                    : `${apiBaseUrl}/dashboard/competitors?niche=${encodeURIComponent(niche)}&import=done&timestamp=${Date.now()}`;
                await chrome.tabs.update(resultsTabId, { url: resultsUrl });
                // Nettoyer le storage
                await chrome.storage.local.remove(['analyzingTabId']);
            }
            catch (scriptError) {
                console.log('[Etsmart Background] Erreur injection script:', scriptError);
                // Fallback : mettre à jour l'URL avec les données en paramètre (limité)
                const useTestPage = shops && shops.length > 0 && shops[0].useTestPage || false;
                const resultsUrl = useTestPage
                    ? `${apiBaseUrl}/test-extension?niche=${encodeURIComponent(niche)}&import=done&timestamp=${Date.now()}`
                    : `${apiBaseUrl}/dashboard/competitors?niche=${encodeURIComponent(niche)}&import=done&timestamp=${Date.now()}`;
                await chrome.tabs.update(resultsTabId, { url: resultsUrl });
            }
        }
        else {
            console.log('[Etsmart Background] Analyse échouée ou pas de tab ID');
            if (resultsTabId) {
                await chrome.tabs.update(resultsTabId, {
                    url: `${apiBaseUrl}/dashboard/competitors?import=error&message=${encodeURIComponent('Analyse échouée')}`
                });
            }
        }
    }
    catch (error) {
        console.log('[Etsmart Background] Erreur lors de l\'envoi à l\'API:', error);
    }
}
