const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// CRITICAL FIX: Railway assigns PORT via environment variable
// Match Railway's port mapping (Port 3000 → Metal Edge)
const PORT = process.env.PORT || 3000;

// Middleware - Allow all origins for testing
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, req.body);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Menu fetch server is running!',
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Bill Splitter Menu Fetcher',
        status: 'running',
        endpoints: {
            health: '/health',
            fetchMenu: '/fetch-menu (POST)',
            presetMenus: '/preset-menus (GET)'
        }
    });
});

// Preset menus endpoint
app.get('/preset-menus', (req, res) => {
    res.json({
        success: true,
        restaurants: [
            {
                name: "Nando's",
                id: "nandos",
                items: [
                    { name: "Quarter Chicken", price: 7.45, category: "main" },
                    { name: "Half Chicken", price: 11.95, category: "main" },
                    { name: "Whole Chicken", price: 18.95, category: "main" },
                    { name: "Butterfly Chicken Breast", price: 11.45, category: "main" },
                    { name: "Chicken Wings (5)", price: 6.95, category: "starter" },
                    { name: "Halloumi Sticks", price: 5.95, category: "starter" },
                    { name: "Peri Chips", price: 4.45, category: "side" },
                    { name: "Garlic Bread", price: 3.95, category: "side" },
                    { name: "Coleslaw", price: 3.45, category: "side" },
                    { name: "Corn on the Cob", price: 3.45, category: "side" },
                    { name: "Soft Drink", price: 2.95, category: "drink" },
                    { name: "Bottomless Soft Drink", price: 3.95, category: "drink" }
                ]
            },
            {
                name: "Pizza Express",
                id: "pizzaexpress",
                items: [
                    { name: "Margherita", price: 10.95, category: "main" },
                    { name: "American Hot", price: 13.95, category: "main" },
                    { name: "La Reine", price: 13.95, category: "main" },
                    { name: "Sloppy Giuseppe", price: 14.95, category: "main" },
                    { name: "Dough Balls", price: 5.95, category: "starter" },
                    { name: "Bruschetta", price: 6.95, category: "starter" },
                    { name: "Caesar Salad", price: 11.95, category: "main" },
                    { name: "Garlic Bread", price: 5.45, category: "side" },
                    { name: "Tiramisu", price: 6.95, category: "dessert" },
                    { name: "Soft Drink", price: 3.50, category: "drink" }
                ]
            },
            {
                name: "Wagamama",
                id: "wagamama",
                items: [
                    { name: "Chicken Katsu Curry", price: 13.95, category: "main" },
                    { name: "Yasai Katsu Curry", price: 12.95, category: "main" },
                    { name: "Chicken Ramen", price: 13.95, category: "main" },
                    { name: "Pad Thai", price: 13.95, category: "main" },
                    { name: "Gyoza", price: 6.95, category: "starter" },
                    { name: "Edamame", price: 4.95, category: "starter" },
                    { name: "Bang Bang Cauliflower", price: 6.95, category: "starter" },
                    { name: "Soft Drink", price: 3.50, category: "drink" },
                    { name: "Miso Soup", price: 4.50, category: "side" }
                ]
            }
        ]
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'Bill Splitter Menu Fetcher',
        status: 'running',
        endpoints: {
            health: '/health',
            fetchMenu: '/fetch-menu (POST)'
        }
    });
});

// Fetch menu endpoint
app.post('/fetch-menu', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url) {
            return res.status(400).json({ 
                error: 'URL is required',
                example: { url: 'nandos.co.uk' }
            });
        }

        // Add https:// if not present
        let fullUrl = url;
        if (!url.startsWith('http')) {
            fullUrl = 'https://' + url;
        }

        console.log('📡 Fetching menu from:', fullUrl);

        // Fetch the website
        const response = await axios.get(fullUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 15000,
            maxRedirects: 5
        });

        // Parse with Cheerio
        const $ = cheerio.load(response.data);
        const items = [];
        const seenItems = new Set();

        // Look for menu items with prices
        $('body').find('*').each((i, elem) => {
            const text = $(elem).text().trim();
            
            // Skip if too long (likely not a menu item)
            if (text.length > 150 || text.length < 3) return;
            
            // Match UK prices: £12.99, £12, etc.
            const priceMatch = text.match(/£(\d+\.?\d{0,2})/);
            
            if (priceMatch) {
                const price = parseFloat(priceMatch[1]);
                
                // Valid price range for restaurant items
                if (price > 0 && price < 200) {
                    // Extract item name (remove price and clean up)
                    let name = text
                        .replace(/£\d+\.?\d{0,2}/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    
                    // Clean up common artifacts
                    name = name
                        .replace(/^[-•·]/g, '')
                        .replace(/\n/g, ' ')
                        .trim();
                    
                    // Only add if name is reasonable length
                    if (name.length >= 3 && name.length <= 100) {
                        const itemKey = `${name}-${price}`;
                        
                        if (!seenItems.has(itemKey)) {
                            seenItems.add(itemKey);
                            
                            // Auto-categorize
                            let category = 'main';
                            const lowerName = name.toLowerCase();
                            
                            if (lowerName.includes('starter') || lowerName.includes('appetizer')) {
                                category = 'starter';
                            } else if (lowerName.includes('drink') || lowerName.includes('soft') || 
                                       lowerName.includes('beer') || lowerName.includes('wine') ||
                                       lowerName.includes('cocktail') || lowerName.includes('juice')) {
                                category = 'drink';
                            } else if (lowerName.includes('dessert') || lowerName.includes('ice cream') ||
                                       lowerName.includes('cake') || lowerName.includes('pudding')) {
                                category = 'dessert';
                            } else if (lowerName.includes('side') || lowerName.includes('chips') ||
                                       lowerName.includes('fries') || lowerName.includes('rice')) {
                                category = 'side';
                            } else if (lowerName.includes('kids') || lowerName.includes('child')) {
                                category = 'kids';
                            }
                            
                            items.push({
                                name: name,
                                price: price,
                                category: category
                            });
                        }
                    }
                }
            }
        });

        console.log(`✅ Found ${items.length} menu items`);

        // Sort by category then price
        const sortedItems = items.sort((a, b) => {
            const categoryOrder = { starter: 0, main: 1, side: 2, dessert: 3, drink: 4, kids: 5 };
            if (categoryOrder[a.category] !== categoryOrder[b.category]) {
                return categoryOrder[a.category] - categoryOrder[b.category];
            }
            return a.price - b.price;
        });

        res.json({ 
            success: true, 
            items: sortedItems.slice(0, 100), // Limit to 100 items
            source: fullUrl,
            count: sortedItems.length
        });

    } catch (error) {
        console.error('❌ Error fetching menu:', error.message);
        console.error('Error details:', {
            code: error.code,
            status: error.response?.status,
            statusText: error.response?.statusText,
            stack: error.stack
        });
        
        let errorMessage = 'Failed to fetch menu';
        let details = error.message;
        
        if (error.code === 'ENOTFOUND') {
            errorMessage = 'Website not found';
            details = 'Could not connect to that URL. Please check the website address.';
        } else if (error.code === 'ETIMEDOUT') {
            errorMessage = 'Connection timeout';
            details = 'The website took too long to respond.';
        } else if (error.response && error.response.status === 403) {
            errorMessage = 'Access denied';
            details = 'The website blocked our request. Try a different restaurant.';
        } else if (error.response && error.response.status === 404) {
            errorMessage = 'Page not found';
            details = 'The website URL could not be found.';
        }
        
        res.status(500).json({ 
            success: false,
            error: errorMessage,
            details: details,
            debugInfo: error.code || 'Unknown error'
        });
    }
});

// CRITICAL: Listen on 0.0.0.0 for Railway
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Menu fetch server running on port ${PORT}`);
    console.log(`🔗 Health check at: http://localhost:${PORT}/health`);
});
