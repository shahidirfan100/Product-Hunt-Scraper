# Product Hunt Products Scraper

Extract complete Product Hunt product data across categories in a fast, reliable, automated workflow. Collect core product details, review metrics, category labels, tags, launch metadata, and profile links in structured output. Ideal for market intelligence, product research, monitoring, and analytics pipelines.

## Features

- **Rich Product Profiles** — Capture IDs, slugs, names, taglines, images, and product URLs
- **Review And Popularity Metrics** — Collect ratings, review counts, detailed reviews, and follower signals
- **Category And Tag Coverage** — Export category names, category slugs, and topic tags for segmentation
- **Launch Metadata** — Include launch post ID and launch schedule timestamps
- **Fast Multi-Page Collection** — Gather results from multiple category pages with configurable limits
- **Clean Output Structure** — Get analysis-ready JSON records for BI tools, spreadsheets, and automations

## Use Cases

### Market Intelligence
Track which products gain traction in specific Product Hunt categories. Compare popularity, reviews, and engagement metrics to identify emerging opportunities.

### Competitor Monitoring
Build competitor watchlists and monitor growth signals over time. Use ratings, followers, and launch activity to spot momentum changes quickly.

### Startup Discovery
Find promising startups by category and tag clusters. Prioritize products with strong social proof for outreach, partnerships, or investment research.

### Content And Newsletter Research
Source trending tools and launches for editorial calendars. Use categories and tags to curate focused lists for niche audiences.

### Product Database Enrichment
Populate internal product directories with consistent structured records. Sync output into Airtable, Sheets, warehouses, or internal dashboards.

---

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startUrl` | String | No | — | Custom Product Hunt topic/listing URL. If set, it overrides `category`. |
| `category` | String | No | `"productivity"` | Product Hunt category slug used to build the start listing URL. |
| `results_wanted` | Integer | No | `20` | Maximum number of products to return (1+). |
| `max_pages` | Integer | No | `0` | Optional safety cap. Set `0` for automatic pagination until target/end. |
| `proxyConfiguration` | Object | No | `{"useApifyProxy": false}` | Optional proxy configuration for reliability. |

---

## Output Data

Each dataset item contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique Product Hunt product ID |
| `slug` | String | Product slug |
| `name` | String | Product name |
| `description` | String | Product tagline/summary |
| `tagline` | String | Product tagline |
| `url` | String | Product Hunt product URL |
| `image_url` | String | Product image URL |
| `logo_uuid` | String | Product logo UUID |
| `upvotes` | Number | Product popularity score |
| `rating` | Number | Average review rating |
| `reviews` | Number | Review count |
| `reviews_count` | Number | Review count alias |
| `detailed_reviews_count` | Number | Count of detailed reviews |
| `founder_reviews_count` | Number | Founder review count |
| `founder_shoutouts` | Number | Founder shoutout count |
| `followers_count` | Number | Follower count |
| `posts_count` | Number | Launch/post count |
| `launch_post_id` | String | Latest launch post ID |
| `launch_scheduled_at` | String | Latest launch scheduled timestamp |
| `is_top_product` | Boolean | Whether listed as top product |
| `is_subscribed` | Boolean | Viewer subscription state |
| `is_no_longer_online` | Boolean | Whether product is flagged offline |
| `categories` | Array | Category names |
| `category` | Array | Category names alias |
| `category_slugs` | Array | Category slugs |
| `tags` | Array | Product tags |
| `scraped_at` | String | ISO timestamp of extraction |

---

## Usage Examples

### Basic Category Collection

Collect products from the default category with automatic pagination:

```json
{
  "category": "productivity",
  "results_wanted": 20
}
```

### High-Volume Category Run

Collect a larger dataset for analytics or enrichment:

```json
{
  "category": "artificial-intelligence",
  "results_wanted": 100
}
```

### Custom Topic URL

Run directly from a specific Product Hunt listing URL:

```json
{
  "startUrl": "https://www.producthunt.com/topics/developer-tools",
  "results_wanted": 50
}
```

### Proxy Configuration

Use proxy configuration for improved reliability:

```json
{
  "category": "saas",
  "results_wanted": 60,
  "max_pages": 0,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

---

## Sample Output

```json
{
  "id": "109920",
  "slug": "figma",
  "name": "Figma",
  "description": "The collaborative interface design tool",
  "tagline": "The collaborative interface design tool",
  "url": "https://www.producthunt.com/products/figma",
  "image_url": "https://ph-files.imgix.net/db00a7a1-6778-4e51-a953-de5a9a339bc9.jpeg?auto=format&fit=crop",
  "logo_uuid": "db00a7a1-6778-4e51-a953-de5a9a339bc9.jpeg",
  "upvotes": 10010,
  "rating": 4.92,
  "reviews": 1364,
  "reviews_count": 1364,
  "detailed_reviews_count": 721,
  "founder_reviews_count": 0,
  "founder_shoutouts": 0,
  "followers_count": 10010,
  "posts_count": 18,
  "launch_post_id": "1000100",
  "launch_scheduled_at": "2025-09-20T00:01:00-07:00",
  "is_top_product": true,
  "is_subscribed": false,
  "is_no_longer_online": false,
  "categories": ["Team collaboration software", "Design tools"],
  "category": ["Team collaboration software", "Design tools"],
  "category_slugs": ["team-collaboration", "design-tools"],
  "tags": ["vector editing", "prototyping", "design systems"],
  "scraped_at": "2026-02-14T00:00:00.000Z"
}
```

---

## Tips for Best Results

### Start With Focused Categories

- Use specific category slugs for higher relevance
- Run separate tasks for each category to keep datasets clean
- Compare results across categories for trend mapping

### Balance Volume And Runtime

- Start with `20-50` results for testing
- Increase to `100` when your pipeline is validated
- Keep `max_pages` as `0` for auto mode unless you want a hard safety cap

### Build Better Segmentation

- Use `categories`, `category_slugs`, and `tags` together
- Combine rating and review metrics for quality scoring
- Use `launch_scheduled_at` for time-based trend analysis

### Reliability At Scale

- Enable proxy settings for long or frequent runs
- Schedule regular runs for consistent monitoring
- Store results in downstream tools for historical analysis

---

## Integrations

Connect your data with:

- **Google Sheets** — Build shareable product tracking sheets
- **Airtable** — Create searchable product research databases
- **BigQuery** — Analyze large product datasets with SQL
- **Make** — Automate enrichment and alert workflows
- **Zapier** — Trigger follow-up actions from new records
- **Webhooks** — Stream output to your internal services

### Export Formats

- **JSON** — Developer workflows and APIs
- **CSV** — Spreadsheet analysis
- **Excel** — Business reporting
- **XML** — Legacy system integrations

---

## Frequently Asked Questions

### How many products can I collect per run?
You can request any positive number using `results_wanted`; the actor keeps paging until target or no new products.

### Can I run multiple categories?
Yes. Run separate tasks per category slug or custom topic URL for cleaner segmentation.

### Why might some fields be empty?
Some products may not expose all metadata. The actor still returns the rest of the available structured fields.

### Is pagination automatic?
Yes. The actor automatically scans additional listing pages until it reaches your target or page limit.

### Can I use a custom Product Hunt URL?
Yes. Use `startUrl` to target a specific topic/listing URL directly.

### Is this suitable for scheduled monitoring?
Yes. The output structure is stable and works well for recurring runs and trend monitoring.

---

## Support

For issues or feature requests, contact support through the Apify Console.

### Resources

- [Apify Documentation](https://docs.apify.com/)
- [Apify API Reference](https://docs.apify.com/api/v2)
- [Scheduling Runs](https://docs.apify.com/schedules)

---

## Legal Notice

This actor is intended for legitimate data collection use cases. You are responsible for complying with Product Hunt terms and all applicable laws in your jurisdiction.
