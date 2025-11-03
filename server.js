// Simple Node.js server to fetch restaurant menus
// This solves the CORS problem by running server-side
// 
// To use:
// 1. Install Node.js
// 2. Run: npm install express cors axios cheerio
// 3. Run: node menu-server.js
// 4. Update your app to call: http://localhost:3000/fetch-menu

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

// Endpoint to fetch menu from any URL
app.post('/fetch-menu', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL required' });
    }
    
    try {
        // Fetch the webpage
        const response = await axios.get(url);
        const html = response.data;
        
        // Parse HTML with Cheerio (jQuery-like server-side)
        const $ = cheerio.load(html);
        
        const menuItems = [];
        
        // Strategy 1: Look for common menu selectors
        const selectors = [
            '.menu-item',
            '.food-item',
            '.product-item',
            '[class*="menu"]',
            '[class*="dish"]',
            '[class*="product"]'
        ];
        
        selectors.forEach(selector => {
            $(selector).each((i, elem) => {
                const text = $(elem).text();
                
                // Extract price (various formats)
                const priceMatch = text.match(/£(\d+\.?\d*)|(\d+\.?\d*)[\s]*£|\$(\d+\.?\d*)|(\d+\.?\d*)[\s]*\$/);
                if (priceMatch) {
                    const price = parseFloat(priceMatch[1] || priceMatch[2] || priceMatch[3] || priceMatch[4]);
                    
                    // Extract item name (remove price from text)
                    const name = text.replace(/£\d+\.?\d*|\$\d+\.?\d*|\d+\.?\d*/, '').trim();
                    
                    if (name && price > 0 && price < 200) {
                        menuItems.push({
                            name: name.substring(0, 100), // Limit length
                            price: price,
                            category: guessCategory(name)
                        });
                    }
                }
            });
        });
        
        // Strategy 2: If no items found, try more aggressive parsing
        if (menuItems.length === 0) {
            // Look for price patterns in all text
            const bodyText = $('body').text();
            const lines = bodyText.split('\n');
            
            lines.forEach(line => {
                const match = line.match(/([^£$\n]{3,50})\s*[£$](\d+\.?\d*)/);
                if (match) {
                    const name = match[1].trim();
                    const price = parseFloat(match[2]);
                    
                    if (price > 0 && price < 200) {
                        menuItems.push({
                            name: name,
                            price: price,
                            category: guessCategory(name)
                        });
                    }
                }
            });
        }
        
        // Remove duplicates
        const uniqueItems = [];
        const seen = new Set();
        menuItems.forEach(item => {
            const key = `${item.name}-${item.price}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueItems.push(item);
            }
        });
        
        res.json({ 
            success: true, 
            items: uniqueItems,
            count: uniqueItems.length 
        });
        
    } catch (error) {
        console.error('Error fetching menu:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch menu',
            details: error.message 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'Server running' });
});

// Function to guess category based on item name
function guessCategory(name) {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('starter') || nameLower.includes('appetizer') || 
        nameLower.includes('soup') || nameLower.includes('salad')) {
        return 'starter';
    }
    if (nameLower.includes('drink') || nameLower.includes('beverage') || 
        nameLower.includes('wine') || nameLower.includes('beer') || 
        nameLower.includes('cocktail') || nameLower.includes('juice')) {
        return 'drink';
    }
    if (nameLower.includes('dessert') || nameLower.includes('sweet') || 
        nameLower.includes('cake') || nameLower.includes('ice cream')) {
        return 'dessert';
    }
    if (nameLower.includes('kids') || nameLower.includes('junior') || 
        nameLower.includes('children')) {
        return 'kids';
    }
    if (nameLower.includes('side') || nameLower.includes('fries') || 
        nameLower.includes('chips')) {
        return 'side';
    }
    
    return 'main';
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Menu fetch server running on port ${PORT}`);
    console.log(`Test it at: http://localhost:${PORT}/health`);
});

// FOR DEPLOYMENT TO FREE SERVICES:
// 
// Option 1: Railway.app (easiest)
// 1. Push this code to GitHub
// 2. Connect Railway to your GitHub
// 3. It auto-deploys and gives you a URL
// 
// Option 2: Render.com
// 1. Push to GitHub
// 2. Create new Web Service on Render
// 3. Connect to your repo
// 4. It deploys automatically
// 
// Option 3: Vercel (serverless)
// Convert this to a serverless function for free hosting