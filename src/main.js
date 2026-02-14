process.env.APIFY_LOG_LEVEL = process.env.APIFY_LOG_LEVEL || 'WARNING';
process.env.CRAWLEE_LOG_LEVEL = process.env.CRAWLEE_LOG_LEVEL || 'WARNING';

const { Actor } = await import('apify');
const { default: log } = await import('@apify/log');
const { CheerioCrawler, Configuration } = await import('crawlee');

await Actor.init();
log.setLevel(log.LEVELS.WARNING);
Configuration.set('logLevel', 'WARNING');

const PRODUCT_OBJECT_PREFIX = '{"__typename":"Product","id":"';
const PRODUCT_EDGE_PREFIX = '{"__typename":"ProductEdge","node":';

function parseNumeric(value) {
    if (Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
        const numericValue = Number(value);
        return Number.isFinite(numericValue) ? numericValue : null;
    }
    return null;
}

function findAllIndexes(text, pattern) {
    const indexes = [];
    let fromIndex = 0;

    while (fromIndex < text.length) {
        const index = text.indexOf(pattern, fromIndex);
        if (index === -1) break;
        indexes.push(index);
        fromIndex = index + pattern.length;
    }

    return indexes;
}

function extractJsonObjectAt(text, startIndex) {
    if (text[startIndex] !== '{') return null;

    let depth = 0;
    let inString = false;
    let isEscaped = false;

    for (let i = startIndex; i < text.length; i++) {
        const char = text[i];

        if (inString) {
            if (isEscaped) {
                isEscaped = false;
                continue;
            }
            if (char === '\\') {
                isEscaped = true;
                continue;
            }
            if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === '{') {
            depth++;
            continue;
        }

        if (char === '}') {
            depth--;
            if (depth === 0) {
                return text.slice(startIndex, i + 1);
            }
        }
    }

    return null;
}

function extractProductsFromListingPayload(html, fallbackCategorySlug = null) {
    const productMap = new Map();
    const extractNodesFromPattern = (pattern, usePatternOffset = true) => {
        const nodes = [];
        const indexes = findAllIndexes(html, pattern);

        for (const index of indexes) {
            const startIndex = usePatternOffset ? index + pattern.length : index;
            if (html[startIndex] !== '{') continue;

            const productJson = extractJsonObjectAt(html, startIndex);
            if (!productJson) continue;

            try {
                const productNode = JSON.parse(productJson);
                if (productNode?.__typename === 'Product') nodes.push(productNode);
            } catch {
                continue;
            }
        }

        return nodes;
    };

    const edgeNodes = extractNodesFromPattern(PRODUCT_EDGE_PREFIX, true);
    const productNodes = edgeNodes.length > 0
        ? edgeNodes
        : extractNodesFromPattern(PRODUCT_OBJECT_PREFIX, false);

    for (const productNode of productNodes) {
        const id = String(productNode.id ?? '').trim();
        const slug = String(productNode.slug ?? '').trim();
        const name = String(productNode.name ?? '').trim();

        if (!id || !slug || !name) continue;

        const url = typeof productNode.url === 'string' && productNode.url.startsWith('http')
            ? productNode.url
            : `https://www.producthunt.com/products/${slug}`;

        const categoryObjects = Array.isArray(productNode.categories) ? productNode.categories : [];
        const categoryFromObjects = categoryObjects.map((categoryItem) => categoryItem?.name);
        const categoryFromEdges = Array.isArray(productNode.topics?.edges)
            ? productNode.topics.edges.map((edge) => edge?.node?.name)
            : [];
        const categoryFromNodes = Array.isArray(productNode.topics?.nodes)
            ? productNode.topics.nodes.map((node) => node?.name)
            : [];

        let categories = Array.from(new Set(
            [...categoryFromObjects, ...categoryFromEdges, ...categoryFromNodes]
                .filter((topicName) => typeof topicName === 'string' && topicName.trim().length > 0),
        ));
        if (categories.length === 0 && fallbackCategorySlug) {
            categories = [fallbackCategorySlug];
        }

        const categorySlugs = Array.from(new Set(
            categoryObjects
                .map((categoryItem) => categoryItem?.slug)
                .filter((categorySlug) => typeof categorySlug === 'string' && categorySlug.trim().length > 0),
        ));
        if (categorySlugs.length === 0 && fallbackCategorySlug) {
            categorySlugs.push(fallbackCategorySlug);
        }

        const tags = Array.from(new Set(
            (Array.isArray(productNode.tags) ? productNode.tags : [])
                .filter((tag) => typeof tag === 'string' && tag.trim().length > 0),
        ));

        const latestLaunch = productNode.latestLaunch ?? {};
        const imageUrl = productNode.logoUuid
            ? `https://ph-files.imgix.net/${productNode.logoUuid}?auto=format&fit=crop`
            : null;

        const upvotes = parseNumeric(productNode.votesCount) ?? parseNumeric(productNode.followersCount);

        const normalized = {
            id,
            slug,
            name,
            description: productNode.tagline ?? null,
            tagline: productNode.tagline ?? null,
            url,
            image_url: imageUrl,
            logo_uuid: productNode.logoUuid ?? null,
            upvotes,
            rating: parseNumeric(productNode.reviewsRating),
            reviews: parseNumeric(productNode.reviewsCount),
            reviews_count: parseNumeric(productNode.reviewsCount),
            detailed_reviews_count: parseNumeric(productNode.detailedReviewsCount),
            founder_reviews_count: parseNumeric(productNode.founderReviewsCount),
            founder_shoutouts: parseNumeric(productNode.founderShoutouts),
            followers_count: parseNumeric(productNode.followersCount),
            posts_count: parseNumeric(productNode.postsCount),
            launch_post_id: latestLaunch?.id ?? null,
            launch_scheduled_at: latestLaunch?.scheduledAt ?? null,
            is_top_product: Boolean(productNode.isTopProduct),
            is_subscribed: Boolean(productNode.isSubscribed),
            is_no_longer_online: Boolean(productNode.isNoLongerOnline),
            categories,
            category: categories,
            category_slugs: categorySlugs,
            tags,
            scraped_at: new Date().toISOString(),
        };

        if (!productMap.has(id)) {
            productMap.set(id, normalized);
            continue;
        }

        const existing = productMap.get(id);
        const mergedCategories = Array.from(new Set([
            ...(existing.categories ?? []),
            ...categories,
        ]));

        productMap.set(id, {
            ...normalized,
            ...existing,
            description: existing.description ?? normalized.description,
            image_url: existing.image_url ?? normalized.image_url,
            upvotes: existing.upvotes ?? normalized.upvotes,
            rating: existing.rating ?? normalized.rating,
            reviews: existing.reviews ?? normalized.reviews,
            reviews_count: existing.reviews_count ?? normalized.reviews_count,
            detailed_reviews_count: existing.detailed_reviews_count ?? normalized.detailed_reviews_count,
            founder_reviews_count: existing.founder_reviews_count ?? normalized.founder_reviews_count,
            founder_shoutouts: existing.founder_shoutouts ?? normalized.founder_shoutouts,
            followers_count: existing.followers_count ?? normalized.followers_count,
            posts_count: existing.posts_count ?? normalized.posts_count,
            launch_post_id: existing.launch_post_id ?? normalized.launch_post_id,
            launch_scheduled_at: existing.launch_scheduled_at ?? normalized.launch_scheduled_at,
            is_top_product: existing.is_top_product ?? normalized.is_top_product,
            is_subscribed: existing.is_subscribed ?? normalized.is_subscribed,
            is_no_longer_online: existing.is_no_longer_online ?? normalized.is_no_longer_online,
            categories: mergedCategories,
            category: mergedCategories,
            category_slugs: Array.from(new Set([
                ...(existing.category_slugs ?? []),
                ...(normalized.category_slugs ?? []),
            ])),
            tags: Array.from(new Set([
                ...(existing.tags ?? []),
                ...(normalized.tags ?? []),
            ])),
            scraped_at: normalized.scraped_at,
        });
    }

    return Array.from(productMap.values());
}

function buildPageUrl(baseUrl, page) {
    try {
        const parsed = new URL(baseUrl);
        parsed.searchParams.set('page', String(page));
        return parsed.toString();
    } catch {
        const separator = baseUrl.includes('?') ? '&' : '?';
        return `${baseUrl}${separator}page=${page}`;
    }
}

async function main() {
    try {
        const input = await Actor.getInput() || {};
        const {
            startUrl,
            category = 'productivity',
            results_wanted = 20,
            max_pages = 0,
            proxyConfiguration,
        } = input;

        const requestedResults = Number(results_wanted);
        const resultsWanted = Number.isFinite(requestedResults) && requestedResults > 0
            ? Math.floor(requestedResults)
            : 20;
        const requestedMaxPages = Number(max_pages);
        const maxPages = Number.isFinite(requestedMaxPages) && requestedMaxPages > 0
            ? Math.floor(requestedMaxPages)
            : 0;
        const baseUrl = startUrl || `https://www.producthunt.com/topics/${category}`;

        log.warning(
            `Start run | target=${resultsWanted} | url=${baseUrl} | ` +
            `max_pages=${maxPages === 0 ? 'auto' : maxPages}`,
        );

        const productsById = new Map();
        let pagesProcessed = 0;
        let stopReason = 'finished';

        const crawler = new CheerioCrawler({
            maxRequestRetries: 2,
            maxConcurrency: 3,
            requestHandlerTimeoutSecs: 60,
            statusMessageLoggingInterval: 1_000_000,
            statisticsOptions: {
                logIntervalSecs: 1_000_000,
            },
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
                    request.headers = {
                        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
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
                        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    };

                    await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 40));
                },
            ],
            async requestHandler({ request, body, crawler: activeCrawler }) {
                pagesProcessed++;

                if (!body || body.length < 1000) {
                    throw new Error('Page content too short - possible blocking or challenge page');
                }

                const topicSlugMatch = request.url.match(/\/topics\/([^/?#]+)/i);
                const fallbackCategorySlug = topicSlugMatch ? topicSlugMatch[1] : null;
                const products = extractProductsFromListingPayload(body, fallbackCategorySlug);

                if (products.length === 0) {
                    stopReason = 'no_products_on_page';
                    await activeCrawler.autoscaledPool?.abort();
                    return;
                }

                let newUniqueProducts = 0;
                for (const product of products) {
                    if (!productsById.has(product.id)) {
                        productsById.set(product.id, product);
                        newUniqueProducts++;
                    }
                }

                if (productsById.size >= resultsWanted) {
                    stopReason = 'target_reached';
                    await activeCrawler.autoscaledPool?.abort();
                    return;
                }

                if (newUniqueProducts === 0) {
                    stopReason = 'no_new_products';
                    await activeCrawler.autoscaledPool?.abort();
                    return;
                }

                const currentPage = Number(request.userData.page || 1);
                if (maxPages > 0 && currentPage >= maxPages) {
                    stopReason = 'max_pages_reached';
                    await activeCrawler.autoscaledPool?.abort();
                    return;
                }

                const nextPage = currentPage + 1;
                const nextUrl = buildPageUrl(baseUrl, nextPage);
                await activeCrawler.addRequests([{ url: nextUrl, userData: { page: nextPage } }]);
            },
            failedRequestHandler({ request }, error) {
                log.error(`Request failed: ${request.url} - ${error.message}`);
            },
        });

        await crawler.run([{ url: buildPageUrl(baseUrl, 1), userData: { page: 1 } }]);

        const uniqueProducts = Array.from(productsById.values()).slice(0, resultsWanted);

        if (uniqueProducts.length > 0) {
            await Actor.pushData(uniqueProducts);
            log.warning(
                `Done | pushed=${uniqueProducts.length} | pages=${pagesProcessed} | stop_reason=${stopReason}`,
            );
        } else {
            log.warning(`Done | pushed=0 | pages=${pagesProcessed} | stop_reason=${stopReason}`);
        }

        await Actor.exit();
    } catch (error) {
        log.error(`Fatal error: ${error.message}`);
        log.error(error.stack);
        await Actor.exit({ exitCode: 1 });
    }
}

main();
