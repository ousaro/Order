const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = 4000;
const INVENTORY_SERVICE_URL = 'http://localhost:3000';

app.use(bodyParser.json());



// Health check endpoint
app.get('/health', (req, res) => res.status(200).send('OK'));

// Order Placement Logic with a single API call
app.post('/place-order', async (req, res) => {
    const { itemId, quantity } = req.body;
    console.log('Request received from API gateway');
    try {
        // Call inventory service to check and update stock in a single request
        const response = await axios.post(`${INVENTORY_SERVICE_URL}/inventory/update`, { itemId, quantity });

        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Error:', error.message);

        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }

        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Order service running on port ${PORT}`);
});