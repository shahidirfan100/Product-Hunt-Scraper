# Product Hunt Scraper

Extract comprehensive product data from Product Hunt with ease. Collect product names, descriptions, images, and URLs from any category at scale. Perfect for market research, competitive analysis, and trend monitoring in the startup ecosystem.

## Features

- **Complete Product Data** — Extract names, descriptions, images, and URLs
- **Category Flexibility** — Scrape any Product Hunt category with custom slugs
- **Smart Pagination** — Automatically handles multiple pages with configurable limits
- **Structured Output** — Clean, consistent dataset format for easy analysis
- **Reliable Extraction** — Built-in error handling and retry mechanisms

## Use Cases

### Market Research
Discover trending products and analyze market demand across different categories. Identify which tools are gaining traction and understand user preferences in the startup ecosystem.

### Competitive Analysis
Track competitor products and their market positioning. Monitor how similar products compare in terms of user engagement and category performance.

### Lead Generation
Identify innovative startups and promising products. Find contact opportunities and partnership potential in emerging product categories.

### Trend Analysis
Monitor product adoption and category trends over time. Track emerging patterns in product launches and user behavior across different sectors.

### Content Creation
Find inspiration for articles about new products and startups. Research trending products to create informed content about the latest innovations.

---

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startUrl` | String | No | — | Custom Product Hunt category or search URL to scrape |
| `category` | String | No | `"productivity"` | Product Hunt category slug (e.g., "ai", "saas", "developer-tools") |
| `results_wanted` | Integer | No | `50` | Maximum number of products to collect |
| `max_pages` | Integer | No | `10` | Safety cap on pages to scrape (15 products per page) |

---

## Output Data

Each scraped product includes:

| Field | Type | Description |
|-------|------|-------------|
| `id` | String | Unique Product Hunt ID |
| `slug` | String | Product URL slug |
| `name` | String | Product name |
| `description` | String | Product tagline/description |
| `url` | String | Full Product Hunt product page URL |
| `image_url` | String | Product logo/thumbnail image URL |

---

## Usage Examples

### Custom URL Scraping

Scrape from a specific Product Hunt URL:

```json
{
  "startUrl": "https://www.producthunt.com/topics/design",
  "results_wanted": 30,
  "max_pages": 5
}
```

### AI Tools Research

Collect comprehensive data from the AI category:

```json
{
  "category": "ai",
  "results_wanted": 100,
  "max_pages": 10
}
```

### Developer Tools Analysis

Scrape developer tools for market analysis:

```json
{
  "category": "developer-tools",
  "results_wanted": 50,
  "max_pages": 5
}
```

---

## Sample Output

```json
{
  "id": "123456",
  "slug": "notion",
  "name": "Notion",
  "description": "The all-in-one workspace for your notes, docs, and projects",
  "url": "https://www.producthunt.com/posts/notion",
  "image_url": "https://ph-files.imgix.net/ff3e2acf-884a-4f4c-a383-6edfe3de0d88.png"
}
```

---

## Tips for Best Results

### Choose Active Categories
- Focus on popular categories with high activity like "productivity", "ai", "saas"
- Test different categories to find the most relevant products for your research
- Monitor category performance over time for trend analysis

### Optimize Collection Size
- Start with smaller batches (20-50 products) for testing and analysis
- Scale up based on your research needs and data processing capabilities
- Balance data volume with processing time and platform limits

### Set Realistic Limits
- Each page typically contains 15 products
- Adjust `max_pages` based on your `results_wanted` target
- The actor automatically stops when your target is reached

---

## Integrations

Connect your data with:

- **Google Sheets** — Export for analysis and reporting
- **Airtable** — Build searchable product databases
- **Slack** — Get notifications for new product launches
- **Make (Integromat)** — Create automated research workflows
- **Zapier** — Trigger actions based on new products
- **Webhooks** — Send data to custom endpoints

### Export Formats

Download data in multiple formats:

- **JSON** — For developers and API integrations
- **CSV** — For spreadsheet analysis and reporting
- **Excel** — For business intelligence dashboards
- **XML** — For system integrations and imports

---

## Frequently Asked Questions

### How many products can I collect?
You can collect all available products in a category. The practical limit depends on the category size and your plan limits.

### Can I scrape multiple categories?
Yes, run separate actor instances for different categories using different category slugs.

### What if some data is missing?
Some fields may be empty if the product doesn't provide that information. The scraper handles missing data gracefully.

### How often should I run the scraper?
Run daily or weekly to capture new product launches. Product Hunt updates frequently with new products across categories.

### Can I filter by date or popularity?
The scraper collects products in the order they appear. Use the output data for filtering and sorting in your analysis tools.

---

## Support

For issues or feature requests, contact support through the Apify Console.

### Resources

- [Apify Documentation](https://docs.apify.com/)
- [API Reference](https://docs.apify.com/api/v2)
- [Scheduling Runs](https://docs.apify.com/schedules)

---

## Legal Notice

This actor is designed for legitimate data collection purposes. Users are responsible for ensuring compliance with Product Hunt's terms of service and applicable laws. Use data responsibly and respect rate limits.