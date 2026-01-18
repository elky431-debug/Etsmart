import { NextRequest, NextResponse } from 'next/server';

// Helper to extract product ID from AliExpress URL
function extractAliExpressProductId(url: string): string | null {
  // Clean URL and decode
  const cleanUrl = decodeURIComponent(url);
  
  // Match various AliExpress URL patterns
  const patterns = [
    /\/item\/(\d+)\.html/i,
    /\/item\/(\d+)/i,
    /\/(\d{10,})\.html/i,
    /\/i\/(\d+)\.html/i,
    /productId[=:](\d+)/i,
    /item\/(\d+)/i,
    /-(\d{10,})\.html/i,
    /(\d{12,})/,  // Sometimes the ID is just a long number in the URL
  ];
  
  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

// Helper to delay between retries
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to get random delay (300-1500ms)
const getRandomDelay = () => Math.floor(Math.random() * 1200) + 300;

// Fetch product from AliExpress API
async function fetchAliExpressProduct(productId: string, originalUrl: string) {
  // Try multiple API endpoints with various configurations
  const endpoints = [
    // AliExpress product detail API (used by mobile apps)
    {
      url: `https://www.aliexpress.com/aeglobal/api/web/product/detail?productId=${productId}&country=US&locale=en_US`,
      type: 'api',
    },
    // Alternative API endpoint
    {
      url: `https://www.aliexpress.com/fn/ws/product/page/v2?productId=${productId}`,
      type: 'api',
    },
    // Item page API endpoint
    {
      url: `https://www.aliexpress.com/wholesale?SearchText=${productId}&catId=0&g=y`,
      type: 'search',
    },
    // Alternative country/locale combinations
    {
      url: `https://www.aliexpress.com/aeglobal/api/web/product/detail?productId=${productId}&country=FR&locale=fr_FR`,
      type: 'api',
    },
    {
      url: `https://www.aliexpress.com/aeglobal/api/web/product/detail?productId=${productId}&country=GB&locale=en_GB`,
      type: 'api',
    },
  ];

  // Multiple User-Agent strings to rotate (more realistic and diverse)
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  ];

  for (const endpoint of endpoints) {
    // Try with different User-Agents
    for (let i = 0; i < userAgents.length; i++) {
      const userAgent = userAgents[i];
      
      // Add random delay between retries to avoid rate limiting
      if (i > 0) {
        await delay(getRandomDelay());
      }
      
      try {
        // Build headers based on endpoint type
        const headers: Record<string, string> = {
          'User-Agent': userAgent,
          'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.aliexpress.com/',
          'Origin': 'https://www.aliexpress.com',
          'Connection': 'keep-alive',
          'Cache-Control': 'max-age=0',
          'Upgrade-Insecure-Requests': '1',
        };

        if (endpoint.type === 'api') {
          headers['Accept'] = 'application/json, text/plain, */*';
          headers['sec-ch-ua'] = '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"';
          headers['sec-ch-ua-mobile'] = '?0';
          headers['sec-ch-ua-platform'] = '"macOS"';
          headers['sec-fetch-dest'] = 'empty';
          headers['sec-fetch-mode'] = 'cors';
          headers['sec-fetch-site'] = 'same-origin';
        } else {
          headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';
          headers['sec-fetch-dest'] = 'document';
          headers['sec-fetch-mode'] = 'navigate';
          headers['sec-fetch-site'] = 'none';
          headers['sec-fetch-user'] = '?1';
        }

        const response = await fetch(endpoint.url, {
          headers,
          // Add timeout
          signal: AbortSignal.timeout(12000), // 12 seconds timeout
          // Add redirect handling
          redirect: 'follow',
        });

        if (response.ok) {
          // Handle different response types
          if (endpoint.type === 'api') {
            const data = await response.json();
            
            // Try to extract product info from the API response
            if (data) {
              const productInfo = extractFromApiResponse(data, productId, originalUrl);
              if (productInfo && productInfo.title && productInfo.title !== 'Produit AliExpress') {
                console.log(`✅ Successfully fetched product via API: ${endpoint.url}`);
                return productInfo;
              }
            }
          } else {
            // For search pages, extract from HTML
            const html = await response.text();
            const extracted = await extractFromHTML(html, productId, originalUrl);
            if (extracted && extracted.title && extracted.title.length > 5) {
              console.log(`✅ Successfully extracted product from search page`);
              return extracted;
            }
          }
        } else if (response.status === 403 || response.status === 429) {
          // Rate limited or blocked - wait longer before retry
          console.log(`⚠️ Blocked (${response.status}) with endpoint ${endpoint.url}, waiting...`);
          await delay(2000); // Wait 2 seconds before trying next
          continue;
        }
      } catch (e: any) {
        // If timeout, try next User-Agent
        if (e.name === 'TimeoutError' || e.name === 'AbortError') {
          console.log(`⏱️ Timeout for ${endpoint.url} with User-Agent, trying next...`);
          continue;
        }
        // For network errors, try next
        if (e.message?.includes('fetch failed') || e.message?.includes('ECONNREFUSED')) {
          console.log(`🌐 Network error for ${endpoint.url}, trying next...`);
          continue;
        }
        console.log(`❌ API endpoint failed: ${endpoint.url}`, e.message || e);
      }
    }
  }

  // If APIs fail, try scraping the page directly
  return await scrapeAliExpressPage(productId, originalUrl);
}

// Helper to extract product from HTML
async function extractFromHTML(html: string, productId: string, originalUrl: string) {
  let title = '';
  let price = 0;
  let images: string[] = [];
  let rating = 4.5;
  
  // Method 1: Look for runParams data (most reliable)
  const runParamsMatch = html.match(/window\.runParams\s*=\s*\{[\s\S]*?"data"\s*:\s*(\{[\s\S]*?\})\s*\}/);
  if (runParamsMatch) {
    try {
      const dataStr = runParamsMatch[1];
      
      const titleMatch = dataStr.match(/"subject"\s*:\s*"([^"]+)"/);
      if (titleMatch) title = titleMatch[1];
      
      const pricePatterns = [
        /"formatedActivityPrice"\s*:\s*"[\$€£]?\s*([\d,]+\.?\d*)/,
        /"formatedActivityPrice"\s*:\s*"([^"]*?)([\d,]+\.?\d*)/,
        /"minAmount"\s*:\s*\{[^}]*"value"\s*:\s*([\d.]+)/,
        /"minActivityAmount"\s*:\s*\{[^}]*"value"\s*:\s*([\d.]+)/,
        /"discountPrice"\s*:\s*\{[^}]*"minPrice"\s*:\s*([\d.]+)/,
        /"originalPrice"\s*:\s*\{[^}]*"minPrice"\s*:\s*([\d.]+)/,
        /"price"\s*:\s*\{[^}]*"min"\s*:\s*([\d.]+)/,
        /"price"\s*:\s*([\d.]+)/,
      ];
      
      for (const pattern of pricePatterns) {
        const priceMatch = dataStr.match(pattern);
        if (priceMatch) {
          const priceStr = (priceMatch[1] || priceMatch[0]).replace(/,/g, '');
          const parsedPrice = parseFloat(priceStr);
          if (parsedPrice > 0 && parsedPrice < 10000) {
            price = parsedPrice;
            break;
          }
        }
      }
      
      const imagesMatch = dataStr.match(/"imagePathList"\s*:\s*\[([\s\S]*?)\]/);
      if (imagesMatch) {
        const imgUrls = imagesMatch[1].match(/"([^"]+)"/g);
        if (imgUrls) {
          images = imgUrls.map(url => {
            const cleanUrl = url.replace(/"/g, '');
            return cleanUrl.startsWith('//') ? 'https:' + cleanUrl : cleanUrl;
          }).filter(url => url.includes('alicdn.com'));
        }
      }
    } catch (e) {
      console.log('Error parsing runParams:', e);
    }
  }
  
  // Method 2: Extract from JSON-LD structured data
  if (price === 0) {
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const jsonLd of jsonLdMatches) {
        try {
          const jsonContent = jsonLd.replace(/<script[^>]*>|<\/script>/gi, '');
          const data = JSON.parse(jsonContent);
          if (data.offers?.price || data.offers?.lowPrice) {
            const foundPrice = parseFloat(data.offers.price || data.offers.lowPrice);
            if (foundPrice > 0 && foundPrice < 10000) {
              price = foundPrice;
              break;
            }
          }
        } catch (e) {
          // Not valid JSON, continue
        }
      }
    }
  }
  
  // Method 3: Extract from meta tags
  if (!title) {
    const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
                         html.match(/<meta\s+content="([^"]+)"\s+property="og:title"/i);
    if (ogTitleMatch) title = ogTitleMatch[1];
  }
  
  if (!title) {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].split('|')[0].split('-')[0].trim();
    }
  }
  
  // Extract price from meta tags
  if (price === 0) {
    const priceMetaPatterns = [
      /<meta\s+property="product:price:amount"\s+content="([^"]+)"/i,
      /<meta\s+content="([^"]+)"\s+property="product:price:amount"/i,
      /<meta\s+name="price"\s+content="([^"]+)"/i,
      /<meta\s+content="([^"]+)"\s+name="price"/i,
    ];
    
    for (const pattern of priceMetaPatterns) {
      const priceMetaMatch = html.match(pattern);
      if (priceMetaMatch) {
        const parsedPrice = parseFloat(priceMetaMatch[1]);
        if (parsedPrice > 0 && parsedPrice < 10000) {
          price = parsedPrice;
          break;
        }
      }
    }
  }
  
  // Method 4: Extract price from visible HTML elements
  if (price === 0) {
    const htmlPricePatterns = [
      /data-price=["']([\d.]+)["']/i,
      /data-product-price=["']([\d.]+)["']/i,
      /class="[^"]*price[^"]*"[^>]*>[\$€£]?\s*([\d,]+\.?\d*)/i,
      /<span[^>]*class="[^"]*price[^"]*"[^>]*>[\$€£]?\s*([\d,]+\.?\d*)/i,
      /price["']?\s*[:=]\s*["']?([\d.]+)/i,
    ];
    
    for (const pattern of htmlPricePatterns) {
      const priceMatch = html.match(pattern);
      if (priceMatch) {
        const priceStr = (priceMatch[1] || priceMatch[0]).replace(/,/g, '');
        const parsedPrice = parseFloat(priceStr);
        if (parsedPrice > 0 && parsedPrice < 10000) {
          price = parsedPrice;
          break;
        }
      }
    }
  }
  
  // Extract image from meta
  if (images.length === 0) {
    const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
                         html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
    if (ogImageMatch) {
      let imgUrl = ogImageMatch[1];
      if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
      images = [imgUrl];
    }
  }
  
  // Clean up title
  title = title
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s*[-|]\s*AliExpress.*$/i, '')
    .replace(/\s*[-|]\s*Alibaba.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (!title || title.length < 5) {
    return null;
  }
  
  return {
    id: `aliexpress-${productId}`,
    url: originalUrl,
    source: 'aliexpress' as const,
    title: title.slice(0, 200),
    description: title,
    images: images.length > 0 ? images.slice(0, 5) : ['https://via.placeholder.com/600x600?text=AliExpress'],
    price: price,
    currency: 'USD',
    variants: [{ id: 'v1', name: 'Standard', price: price }],
    category: 'General',
    shippingTime: '15-30 days',
    minOrderQuantity: 1,
    supplierRating: rating,
    createdAt: new Date().toISOString(),
  };
}

// Extract product info from API response
function extractFromApiResponse(data: Record<string, unknown>, productId: string, originalUrl: string) {
  try {
    // Navigate through various possible data structures
    const result = data?.data || data?.result || data;
    
    interface ApiProductData {
      productInfoComponent?: { subject?: string };
      titleModule?: { subject?: string };
      pageModule?: { title?: string };
      title?: string;
      subject?: string;
      priceModule?: {
        minAmount?: { value?: number };
        formatedActivityPrice?: string;
        minActivityAmount?: { value?: number };
      };
      priceComponent?: {
        discountPrice?: { minPrice?: number };
        originalPrice?: { minPrice?: number };
      };
      price?: { min?: number };
      imageModule?: { imagePathList?: string[] };
      imageComponent?: { imageList?: Array<{ url?: string }> };
      images?: string[];
      feedbackModule?: {
        averageStar?: number;
        evarageStar?: number;
      };
      titleModule_feedback?: { averageStar?: number };
      shippingModule?: {
        generalFreightInfo?: {
          deliveryDayMin?: number;
          deliveryDayMax?: number;
        };
      };
    }
    
    const productData = result as ApiProductData;
    
    // Title
    let title = productData?.productInfoComponent?.subject ||
                productData?.titleModule?.subject ||
                productData?.pageModule?.title ||
                productData?.title ||
                productData?.subject;
    
    // Price - Multiple extraction methods
    let price = 0;
    const priceModule = productData?.priceModule;
    const priceComponent = productData?.priceComponent;
    
    // Method 1: Direct value from priceModule
    if (priceModule?.minAmount?.value) {
      price = priceModule.minAmount.value;
    } 
    // Method 2: Formatted activity price (e.g., "$12.99")
    else if (priceModule?.formatedActivityPrice) {
      const priceStr = priceModule.formatedActivityPrice;
      // Try multiple patterns
      const patterns = [
        /[\d.]+/,  // Simple number
        /\$?\s*([\d.]+)/,  // With dollar sign
        /([\d,]+\.?\d*)/,  // With commas
      ];
      for (const pattern of patterns) {
        const match = priceStr.match(pattern);
        if (match) {
          const numStr = match[1] || match[0];
          price = parseFloat(numStr.replace(/,/g, ''));
          if (price > 0) break;
        }
      }
    } 
    // Method 3: Min activity amount
    else if (priceModule?.minActivityAmount?.value) {
      price = priceModule.minActivityAmount.value;
    } 
    // Method 4: Discount price
    else if (priceComponent?.discountPrice?.minPrice) {
      price = priceComponent.discountPrice.minPrice;
    } 
    // Method 5: Original price
    else if (priceComponent?.originalPrice?.minPrice) {
      price = priceComponent.originalPrice.minPrice;
    } 
    // Method 6: Price object with min
    else if (productData?.price && typeof productData.price === 'object' && 'min' in productData.price) {
      price = (productData.price as { min?: number }).min || 0;
    }
    // Method 7: Try to find price in nested structures
    else {
      // Search recursively in the data structure
      const searchForPrice = (obj: any, depth = 0): number => {
        if (depth > 5) return 0; // Prevent infinite recursion
        if (!obj || typeof obj !== 'object') return 0;
        
        // Check common price field names
        const priceFields = ['price', 'amount', 'value', 'cost', 'minPrice', 'maxPrice', 'minAmount', 'maxAmount'];
        for (const field of priceFields) {
          if (obj[field] !== undefined) {
            if (typeof obj[field] === 'number' && obj[field] > 0) {
              return obj[field];
            }
            if (typeof obj[field] === 'string') {
              const num = parseFloat(obj[field].replace(/[^0-9.]/g, ''));
              if (num > 0) return num;
            }
            if (typeof obj[field] === 'object' && obj[field] !== null) {
              const nestedPrice = searchForPrice(obj[field], depth + 1);
              if (nestedPrice > 0) return nestedPrice;
            }
          }
        }
        
        // Recursively search in arrays and objects
        if (Array.isArray(obj)) {
          for (const item of obj) {
            const found = searchForPrice(item, depth + 1);
            if (found > 0) return found;
          }
        } else {
          for (const key in obj) {
            if (obj.hasOwnProperty(key) && typeof obj[key] === 'object') {
              const found = searchForPrice(obj[key], depth + 1);
              if (found > 0) return found;
            }
          }
        }
        
        return 0;
      };
      
      price = searchForPrice(result);
    }
    
    // Images
    let images: string[] = [];
    const imageModule = productData?.imageModule;
    const imageComponent = productData?.imageComponent;
    
    if (imageModule?.imagePathList) {
      images = imageModule.imagePathList.map((img: string) => 
        img.startsWith('//') ? 'https:' + img : img
      );
    } else if (imageComponent?.imageList) {
      images = imageComponent.imageList.map((img: { url?: string }) => {
        const url = img?.url || '';
        return url.startsWith('//') ? 'https:' + url : url;
      }).filter(Boolean);
    } else if (productData?.images) {
      images = (productData.images as string[]).map(img => 
        img.startsWith('//') ? 'https:' + img : img
      );
    }
    
    // Rating
    let rating = 4.5;
    const feedbackModule = productData?.feedbackModule;
    if (feedbackModule?.averageStar) {
      rating = feedbackModule.averageStar;
    } else if (feedbackModule?.evarageStar) {
      rating = feedbackModule.evarageStar;
    } else if (productData?.titleModule_feedback?.averageStar) {
      rating = productData.titleModule_feedback.averageStar;
    }
    
    // Shipping
    let shippingTime = '15-30 days';
    const shippingModule = productData?.shippingModule;
    if (shippingModule?.generalFreightInfo) {
      const min = shippingModule.generalFreightInfo.deliveryDayMin || 15;
      const max = shippingModule.generalFreightInfo.deliveryDayMax || 30;
      shippingTime = `${min}-${max} days`;
    }
    
    if (!title) return null;
    
    // Log if price extraction failed
    if (price === 0) {
      console.warn(`⚠️ Price extraction failed for product ${productId}. Title found: "${title}"`);
    } else {
      console.log(`✅ Price extracted: $${price} for product ${productId}`);
    }
    
    return {
      id: `aliexpress-${productId}`,
      url: originalUrl,
      source: 'aliexpress' as const,
      title: String(title).slice(0, 200),
      description: String(title),
      images: images.length > 0 ? images.slice(0, 5) : ['https://via.placeholder.com/600x600?text=AliExpress'],
      price: price,
      currency: 'USD',
      variants: [{ id: 'v1', name: 'Standard', price: price }],
      category: 'General',
      shippingTime: shippingTime,
      minOrderQuantity: 1,
      supplierRating: rating,
      createdAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error('Error extracting from API response:', e);
    return null;
  }
}

// Scrape AliExpress page directly
async function scrapeAliExpressPage(productId: string, originalUrl: string) {
  // Try multiple URL formats
  const pageUrls = [
    `https://www.aliexpress.com/item/${productId}.html`,
    `https://www.aliexpress.us/item/${productId}.html`,
    `https://m.aliexpress.com/item/${productId}.html`,
  ];
  
  // Try with different User-Agents
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  ];

  for (const pageUrl of pageUrls) {
    for (let i = 0; i < userAgents.length; i++) {
      const userAgent = userAgents[i];
      
      // Add random delay between retries
      if (i > 0) {
        await delay(getRandomDelay());
      }
      
      try {
        const response = await fetch(pageUrl, {
          headers: {
            'User-Agent': userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.aliexpress.com/',
            'Origin': 'https://www.aliexpress.com',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
          },
          // Add timeout
          signal: AbortSignal.timeout(15000), // 15 seconds timeout
          redirect: 'follow',
        });

        if (!response.ok) {
          // If 403/429 (blocked), try next User-Agent
          if (response.status === 403 || response.status === 429) {
            console.log(`⚠️ Blocked (${response.status}) with ${pageUrl}, trying next...`);
            await delay(2000);
            continue;
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        
        // Use helper function to extract from HTML
        const extracted = await extractFromHTML(html, productId, originalUrl);
        
        if (extracted && extracted.title && extracted.title.length > 5) {
          // Success! Return the product
          console.log(`✅ Successfully scraped product from ${pageUrl}`);
          
          // Log if price extraction failed
          if (extracted.price === 0) {
            console.warn(`⚠️ Price extraction failed from HTML for product ${productId}. Title: "${extracted.title}"`);
            console.log('💡 Tip: Price might be in variants or require user selection. User will need to enter price manually.');
          } else {
            console.log(`✅ Price extracted from HTML: $${extracted.price} for product ${productId}`);
          }
          
          return extracted;
        } else {
          // Title not found, try next URL/User-Agent
          console.log('Title not found, trying next URL/User-Agent...');
          continue;
        }
      } catch (e: any) {
        // If timeout or abort, try next User-Agent/URL
        if (e.name === 'TimeoutError' || e.name === 'AbortError') {
          console.log(`⏱️ Timeout with ${pageUrl}, trying next...`);
          continue;
        }
        // If blocked, try next URL/User-Agent
        if (e.message?.includes('403') || e.message?.includes('429')) {
          console.log(`🚫 Blocked with ${pageUrl}, trying next...`);
          await delay(2000);
          continue;
        }
        // For network errors, try next
        if (e.message?.includes('fetch failed') || e.message?.includes('ECONNREFUSED')) {
          console.log(`🌐 Network error with ${pageUrl}, trying next...`);
          continue;
        }
        // For other errors, log and continue
        console.log(`❌ Error with ${pageUrl}: ${e.message || e}, trying next...`);
      }
    }
  }
  
  // If all methods failed, throw error
  throw new Error('All scraping methods failed. AliExpress may be blocking requests. Please try adding the product manually.');
}

// Scrape Alibaba product page  
async function scrapeAlibabaProduct(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();

    // Extract from meta tags
    let title = '';
    let price = 0;
    let images: string[] = [];
    
    const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    if (ogTitleMatch) title = ogTitleMatch[1];
    
    if (!title) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) title = titleMatch[1].split('-')[0].trim();
    }
    
    // Extract price - Multiple methods for Alibaba
    const pricePatterns = [
      /US\s*\$\s*([\d,]+\.?\d*)/i,
      /\$\s*([\d,]+\.?\d*)/i,
      /price["']?\s*[:=]\s*["']?([\d.]+)/i,
      /data-price=["']([\d.]+)["']/i,
      /<meta\s+property="product:price:amount"\s+content="([^"]+)"/i,
      /<meta\s+content="([^"]+)"\s+property="product:price:amount"/i,
    ];
    
    for (const pattern of pricePatterns) {
      const priceMatch = html.match(pattern);
      if (priceMatch) {
        const priceStr = (priceMatch[1] || priceMatch[0]).replace(/,/g, '');
        const parsedPrice = parseFloat(priceStr);
        if (parsedPrice > 0 && parsedPrice < 100000) { // Alibaba can have higher prices
          price = parsedPrice;
          break;
        }
      }
    }
    
    // Also try JSON-LD for Alibaba
    if (price === 0) {
      const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
      if (jsonLdMatches) {
        for (const jsonLd of jsonLdMatches) {
          try {
            const jsonContent = jsonLd.replace(/<script[^>]*>|<\/script>/gi, '');
            const data = JSON.parse(jsonContent);
            if (data.offers?.price || data.offers?.lowPrice) {
              const foundPrice = parseFloat(data.offers.price || data.offers.lowPrice);
              if (foundPrice > 0 && foundPrice < 100000) {
                price = foundPrice;
                break;
              }
            }
          } catch (e) {
            // Not valid JSON, continue
          }
        }
      }
    }
    
    const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
    if (ogImageMatch) {
      let imgUrl = ogImageMatch[1];
      if (imgUrl.startsWith('//')) imgUrl = 'https:' + imgUrl;
      images = [imgUrl];
    }

    const productIdMatch = url.match(/\/product\/(\d+)/i) || url.match(/(\d{10,})/);
    const productId = productIdMatch ? productIdMatch[1] : Date.now().toString();

    return {
      id: `alibaba-${productId}`,
      url: url,
      source: 'alibaba' as const,
      title: (title || 'Alibaba Product').slice(0, 200),
      description: title || 'Alibaba Product',
      images: images.length > 0 ? images : ['https://via.placeholder.com/600x600?text=Alibaba'],
      price: price,
      currency: 'USD',
      variants: [{ id: 'v1', name: 'Standard', price: price }],
      category: 'General',
      shippingTime: '15-45 days',
      minOrderQuantity: 1,
      supplierRating: 4.5,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Alibaba scraping error:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'Missing required field: url' },
        { status: 400 }
      );
    }

    // Validate and normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    const isAliExpress = normalizedUrl.includes('aliexpress.com') || normalizedUrl.includes('aliexpress.us');
    const isAlibaba = normalizedUrl.includes('alibaba.com');
    
    if (!isAliExpress && !isAlibaba) {
      return NextResponse.json(
        { error: 'Invalid URL. Must be an AliExpress or Alibaba product URL.' },
        { status: 400 }
      );
    }

    let product;
    
    try {
      if (isAliExpress) {
        const productId = extractAliExpressProductId(normalizedUrl);
        
        if (!productId) {
          return NextResponse.json(
            { error: 'Could not extract product ID from URL. Please check the link.' },
            { status: 400 }
          );
        }
        
        console.log(`Fetching AliExpress product: ${productId}`);
        product = await fetchAliExpressProduct(productId, normalizedUrl);
      } else {
        product = await scrapeAlibabaProduct(normalizedUrl);
      }
    } catch (scrapeError) {
      console.error('All scraping methods failed:', scrapeError);
      
      // Return error with helpful message
      return NextResponse.json({
        success: false,
        error: 'Could not fetch product data. AliExpress may be blocking the request. Please try again or enter product details manually.',
      }, { status: 422 });
    }

    if (!product || !product.title || product.title === 'Produit AliExpress') {
      return NextResponse.json({
        success: false,
        error: 'Could not extract product information. Please check the URL and try again.',
      }, { status: 422 });
    }

    // Warn if price is missing but product was found
    if (product.price === 0) {
      console.warn(`⚠️ Product "${product.title}" imported but price is 0. User should enter price manually.`);
    } else {
      console.log(`✅ Successfully fetched: ${product.title} - Price: $${product.price}`);
    }

    return NextResponse.json({
      success: true,
      product,
      warning: product.price === 0 ? 'Le prix n\'a pas pu être extrait automatiquement. Vous pourrez l\'entrer manuellement.' : undefined,
    });

  } catch (error) {
    console.error('Parse product error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
