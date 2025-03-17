const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const CircuitBreaker = require('opossum'); // Import circuit breaker
const Consul = require('consul');

const app = express();
const PORT = 4000;
const INVENTORY_SERVICE_URL = 'http://localhost:3000';
const SERVICE_NAME = 'order-service';
const consul = new Consul();

app.use(bodyParser.json());

// Fallback function to be used when circuit breaker is open or fails
const fallback = () => {
    console.log('Fallback method triggered: Inventory service is unavailable');
    return { message: 'Inventory service is temporarily unavailable. Please try again later.' };
};

// Create a new CircuitBreaker instance with fallback
const circuitBreaker = new CircuitBreaker(axios.post, {
    timeout: 3000, // Timeout in milliseconds
    errorThresholdPercentage: 50, // Error threshold percentage
    resetTimeout: 15000, // Time in milliseconds to wait before setting the breaker to 'half-open' state
    fallback: fallback, // Set the fallback method here
});

// Event listeners for circuit breaker
circuitBreaker.on('open', () => console.log('Circuit breaker opened'));
circuitBreaker.on('halfOpen', () => console.log('Circuit breaker half-opened'));
circuitBreaker.on('close', () => console.log('Circuit breaker closed'));

// Health check endpoint
app.get('/health', (req, res) => res.status(200).send('OK'));

// Register Order Service with Consul
consul.agent.service.register(
    {
        name: SERVICE_NAME,
        address: 'localhost',
        port: PORT,
        check: {
            http: `http://localhost:${PORT}/health`,
            interval: '10s',
        },
    },
    (err) => {
        if (err) console.error('Consul registration failed:', err);
        else console.log('Order service registered with Consul');
    }
);

// Order Placement Logic with a single API call
app.post('/place-order', async (req, res) => {
    const { itemId, quantity } = req.body;
    console.log('Request received from API gateway');
    
    try {
        // Use circuit breaker to execute the request to inventory service
        const response = await circuitBreaker.fire(`${INVENTORY_SERVICE_URL}/inventory/update`, { itemId, quantity });

        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Error:', error.message);

        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }

        // In case the fallback method is not triggered, manually trigger fallback
        console.log('Manually triggering fallback');
        const fallbackResponse = fallback();
        res.status(500).json(fallbackResponse);
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Order service running on port ${PORT}`);
});
