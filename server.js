const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/fetch-menu', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    
    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        const menuItems = [];
        
        // Look for price patterns
        const text = $('body').text();
        const lines = text.split('\n');
        
        lines.forEach(line => {
            const match = line.match(/([^£\n]{3,50})\s*£(\d+\.?\d*)/);
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
        
        // Remove duplicates
        const unique = [];
        const seen = new Set();
        menuItems.forEach(item => {
            const key = `${item.name}-${item.price}`;
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(item);
            }
        });
        
        res.json({ success: true, items: unique });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch menu' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'Server running' });
});

function guessCategory(name) {
    const n = name.toLowerCase();
    if (n.includes('starter') || n.includes('bread')) return 'starter';
    if (n.includes('drink') || n.includes('wine') || n.includes('beer')) return 'drink';
    if (n.includes('dessert') || n.includes('cake')) return 'dessert';
    if (n.includes('kids') || n.includes('child')) return 'kids';
    if (n.includes('side') || n.includes('chips') || n.includes('fries')) return 'side';
    return 'main';
}

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Menu fetch server running on port ${PORT}`);
    console.log(`Health check at: http://localhost:${PORT}/health`);
});
