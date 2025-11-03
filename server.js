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
        
        res.json({ success: true, items: menuItems });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch' });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'Server running' });
});

function guessCategory(name) {
    const n = name.toLowerCase();
    if (n.includes('starter')) return 'starter';
    if (n.includes('drink')) return 'drink';
    if (n.includes('dessert')) return 'dessert';
    if (n.includes('kids')) return 'kids';
    return 'main';
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
```

4. Click **"Commit new file"**

### **Step 3: Wait for Railway to Redeploy**
Railway will automatically detect the change and redeploy (takes 1-2 minutes)

### **Step 4: Check it's working**
Once deployed, test this link:
```
https://bill-splitter-server-production.up.railway.app/health
