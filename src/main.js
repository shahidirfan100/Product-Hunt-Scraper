import { Actor, log } from 'apify';
import { CheerioCrawler, Dataset } from 'crawlee';
import * as cheerio from 'cheerio';

await Actor.init();

/**
 * Extract products from HTML using ProductEdge pattern (DOM parsing)
 */
function extractProducts(html, crawlerLog) {
    const productMap = new Map();
    const $ = cheerio.load(html);
    
    // Extract from ProductEdge->node->Product pattern (contains complete data with images)
    const productEdgeRegex = /\{"__typename":"ProductEdge","node":\{"__typename":"Product","id":"([^"]+)"[\s\S]*?"slug":"([^"]+)","name":"([^"]+)","tagline":"([^"]+)","logoUuid":"([^"]+)"/g;
    let match;
    
    while ((match = productEdgeRegex.exec(html)) !== null) {
        const [, productId, slug, name, tagline, logoUuid] = match;
        
        if (!productMap.has(productId)) {
            productMap.set(productId, {
                id: productId,
                name: name,
                slug: slug,
                description: tagline,
                url: `https://www.producthunt.com/products/${slug}`,
                image_url: `https://ph-files.imgix.net/${logoUuid}?auto=format&fit=crop`,
                rating: null,
                reviews: null,
                category: [],
                used_by: [],
                os: [],
                scraped_at: new Date().toISOString()
            });
        }
    }
    
    // Fallback: Extract standalone Product objects if ProductEdge not found
    if (productMap.size === 0) {
        crawlerLog.info('No ProductEdge found, trying fallback extraction...');
        const productChunks = html.split('{"__typename":"Product"');
        
        for (let i = 1; i < productChunks.length && productMap.size < 100; i++) {
            const chunk = '{"__typename":"Product"' + productChunks[i];
            const idMatch = chunk.match(/"id":"([^"]+)"/);
            const nameMatch = chunk.match(/"name":"([^"]+)"/);
            const slugMatch = chunk.match(/"slug":"([^"]+)"/);
            const taglineMatch = chunk.match(/"tagline":"([^"]+)"/);
            const logoMatch = chunk.match(/"logoUuid":"([^"]+)"/);

            if (nameMatch && taglineMatch && slugMatch && idMatch) {
                const productId = idMatch[1];
                if (!productMap.has(productId)) {
                    const logoUuid = logoMatch ? logoMatch[1] : null;
                    const imageUrl = logoUuid ? `https://ph-files.imgix.net/${logoUuid}?auto=format&fit=crop` : null;

                    productMap.set(productId, {
                        id: productId,
                        name: nameMatch[1],
                        slug: slugMatch[1],
                        description: taglineMatch[1],
                        url: `https://www.producthunt.com/products/${slugMatch[1]}`,
                        image_url: imageUrl,
                        rating: null,
                        reviews: null,
                        category: [],
                        used_by: [],
                        os: [],
                        scraped_at: new Date().toISOString()
                    });
                }
            }
        }
    }
    
    // Parse DOM for additional fields using Cheerio
    $('ul li').each((index, element) => {
        const $item = $(element);
        
        // Extract rating - look for numeric rating value only
        let rating = null;
        $item.find('span.font-semibold').each((i, span) => {
            const text = $(span).text().trim();
            // Check if it's a numeric rating (e.g., "5", "4.5", "4")
            if (/^\d+(\.\d+)?$/.test(text)) {
                rating = parseFloat(text);
                return false; // break the loop
            }
        });
        
        // Extract review count
        const reviewLink = $item.find('a.hover\\:underline').first();
        const reviewText = reviewLink.text().trim();
        const reviewMatch = reviewText.match(/(\d+)/);
        const reviews = reviewMatch ? parseInt(reviewMatch[1]) : null;
        
        // Extract categories - only from anchor tags to avoid duplicates
        const categories = [];
        const categorySet = new Set();
        $item.find('div.flex.max-h-6.flex-row.flex-wrap.items-center.gap-2.overflow-hidden.z-10.mt-1 a').each((i, cat) => {
            const catText = $(cat).text().trim();
            if (catText && !categorySet.has(catText)) {
                categories.push(catText);
                categorySet.add(catText);
            }
        });
        
        // Extract "Used by" information - filter out bullets and duplicates
        const usedBy = [];
        const usedBySet = new Set();
        $item.find('div.flex.grow-0.flex-row.flex-wrap.items-center.gap-2.z-10.mt-1 img').each((i, img) => {
            const altText = $(img).attr('alt');
            if (altText && !usedBySet.has(altText) && altText !== '•' && !altText.startsWith('Used by')) {
                usedBy.push(altText);
                usedBySet.add(altText);
            }
        });
        
        // Extract OS/Platform buttons - deduplicate
        const osList = [];
        const osSet = new Set();
        $item.find('div.mt-2.flex.flex-wrap.gap-1.z-10 button, button.mt-2').each((i, os) => {
            const osText = $(os).text().trim();
            if (osText && !osSet.has(osText)) {
                osList.push(osText);
                osSet.add(osText);
            }
        });
        
        // Try to match this item to a product by name or slug
        const productName = $item.find('h3, [class*="font-bold"], strong').first().text().trim();
        const productLink = $item.find('a[href*="/products/"]').first().attr('href');
        
        if (productLink) {
            const slugMatch = productLink.match(/\/products\/([^/?]+)/);
            if (slugMatch) {
                const slug = slugMatch[1];
                
                // Find matching product in map
                for (const [id, product] of productMap.entries()) {
                    if (product.slug === slug || product.name === productName) {
                        // Update product with DOM-parsed data
                        if (rating !== null) product.rating = rating;
                        if (reviews) product.reviews = reviews;
                        if (categories.length > 0) product.category = categories;
                        if (usedBy.length > 0) product.used_by = usedBy;
                        if (osList.length > 0) product.os = osList;
                        break;
                    }
                }
            }
        }
    });
    
    const products = Array.from(productMap.values());
    crawlerLog.info(`Extracted ${products.length} unique products`);
    return products;
}

async function main() {
    try {
        log.info('Product Hunt Scraper - Production Ready');

        const input = await Actor.getInput() || {};
        const {
            startUrl,
            category = 'productivity',
            results_wanted = 20,
            max_pages = 3,
            proxyConfiguration
        } = input;

        const resultsWanted = Math.max(1, Math.min(100, Number(results_wanted)));
        const maxPages = Math.max(1, Math.min(10, Number(max_pages)));
        
        // Use startUrl if provided, otherwise build from category
        const baseUrl = startUrl || `https://www.producthunt.com/topics/${category}`;
        
        log.info(`Source: ${startUrl ? 'Custom URL' : 'Category'}`);
        log.info(`URL: ${baseUrl}`);
        log.info(`Target: ${resultsWanted} products from ${maxPages} page(s)`);

        let totalSaved = 0;
        const allProducts = [];

        const crawler = new CheerioCrawler({
            maxRequestRetries: 3,
            maxConcurrency: 2,
            requestHandlerTimeoutSecs: 60,
            useSessionPool: true,
            sessionPoolOptions: {
                maxPoolSize: 10,
                sessionOptions: {
                    maxUsageCount: 10,
                },
            },
            proxyConfiguration: proxyConfiguration ? await Actor.createProxyConfiguration(proxyConfiguration) : undefined,
            
            preNavigationHooks: [
                async ({ request }) => {
                    // Stealth headers
                    request.headers = {
                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                        'accept-language': 'en-US,en;q=0.9',
                        'accept-encoding': 'gzip, deflate, br',
                        'cache-control': 'max-age=0',
                        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': '"Windows"',
                        'sec-fetch-dest': 'document',
                        'sec-fetch-mode': 'navigate',
                        'sec-fetch-site': 'none',
                        'sec-fetch-user': '?1',
                        'upgrade-insecure-requests': '1',
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    };
                    
                    // Random delay (stealth)
                    await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
                }
            ],
            
            async requestHandler({ request, body, log: crawlerLog, crawler }) {
                crawlerLog.info(`Processing: ${request.url}`);
                
                if (!body || body.length < 1000) {
                    throw new Error('Page content too short - possible block');
                }
                
                const products = extractProducts(body, crawlerLog);
                
                if (products.length === 0) {
                    crawlerLog.warning('No products found on this page');
                    return;
                }
                
                allProducts.push(...products);
                crawlerLog.info(`Total products collected: ${allProducts.length}`);
                
                // Stop if we have enough products
                if (allProducts.length >= resultsWanted) {
                    crawlerLog.info(`Reached target, stopping crawler`);
                    await crawler.autoscaledPool?.abort();
                    return;
                }
                
                // Get current page number
                const currentPage = request.userData.page || 1;
                
                // Add next page if we haven't reached max pages
                if (currentPage < maxPages && allProducts.length < resultsWanted) {
                    const nextPage = currentPage + 1;
                    const nextUrl = `${baseUrl}?page=${nextPage}`;
                    
                    await crawler.addRequests([{
                        url: nextUrl,
                        userData: { page: nextPage }
                    }]);
                    
                    crawlerLog.info(`Added page ${nextPage} to queue`);
                }
            },
            
            failedRequestHandler({ request }, error) {
                log.error(`Failed: ${request.url} - ${error.message}`);
            },
        });

        await crawler.run([{ url: baseUrl, userData: { page: 1 } }]);
        
        // Deduplicate and limit
        const uniqueProducts = Array.from(
            new Map(allProducts.map(p => [p.id, p])).values()
        ).slice(0, resultsWanted);
        
        if (uniqueProducts.length > 0) {
            await Dataset.pushData(uniqueProducts);
            totalSaved = uniqueProducts.length;
            log.info(`✅ Saved ${totalSaved} products to dataset`);
        } else {
            log.warning('⚠️ No products extracted');
        }
        
        await Actor.exit();
    } catch (error) {
        log.error(`Fatal error: ${error.message}`);
        log.error(error.stack);
        await Actor.exit({ exitCode: 1 });
    }
}

main();