import { Actor, log } from 'apify';
import { CheerioCrawler, Dataset } from 'crawlee';

await Actor.init();

/**
 * Extract products from HTML using ProductEdge pattern (DOM parsing)
 */
function extractProducts(html, crawlerLog) {
    const productMap = new Map();
    
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
                        scraped_at: new Date().toISOString()
                    });
                }
            }
        }
    }
    
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