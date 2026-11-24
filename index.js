import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import 'dotenv/config';

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI);

const connectToMongoDB = async () => {
  try {
    await client.connect();
    console.log('Successfully connected to MongoDB!');
    return client;
  } catch (error) {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  }
};

const connectedClient = await connectToMongoDB();

// Database
const db = connectedClient.db('car-wash');

// Collections
const usersCollection = db.collection('users');
const servicesCollection = db.collection('services');
const bookingsCollection = db.collection('bookings');
const branchesCollection = db.collection('branches');

// Default route
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Service related APIs

// Add service
app.post('/services', async (req, res) => {
  try {
    const data = req.body;
    const result = await servicesCollection.insertOne(data);

    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ message: 'Failed to add service' });
  }
});

// Get all services
app.get('/services', async (req, res) => {
  try {
    const services = await servicesCollection.find({}).toArray();
    res.send(services);
  } catch (error) {
    res.status(500).send({ message: 'Failed to fetch services' });
  }
});
 







// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
