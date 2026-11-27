import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import 'dotenv/config';
import { stripe } from './config/stripe.js';

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

    const result = await servicesCollection.insertOne({
      ...data,
      createdBy: data.createdBy,
      createdAt: new Date(),
    });

    res.status(201).send(result);
  } catch (error) {
    console.error('ADD SERVICE ERROR:', error);
    res.status(500).send({ message: 'Failed to add service' });
  }
});
// Get all public services added by branch managers
app.get('/services/public', async (req, res) => {
  try {
    // Better Auth stores users in the `user` collection, but older
    // versions of this API used `users`, so check both.
    const [authUsers, legacyUsers] = await Promise.all([
      db.collection('user').distinct('email', { role: 'branchManager' }),
      usersCollection.distinct('email', { role: 'branchManager' }),
    ]);

    const managerEmails = [...new Set([...authUsers, ...legacyUsers])];

    const services = await servicesCollection
      .find({
        status: 'active',
        $or: [
          { createdBy: { $in: managerEmails } },
          { createdBy: { $exists: false } },
          { createdBy: null },
          { createdBy: '' },
        ],
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(services);
  } catch (error) {
    console.error('GET PUBLIC SERVICES ERROR:', error);
    res.status(500).send({
      message: 'Failed to fetch services',
    });
  }
});

// Get a single service by id
app.get('/services/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: 'Invalid service id' });
    }

    const service = await servicesCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!service) {
      return res.status(404).send({ message: 'Service not found' });
    }

    res.send(service);
  } catch (error) {
    console.error('GET SERVICE ERROR:', error);
    res.status(500).send({
      message: 'Failed to fetch service',
    });
  }
});

// Get all services
app.get('/services', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).send({
        message: 'User email is required',
      });
    }

    const services = await servicesCollection
      .find({ createdBy: email })
      .toArray();

    res.send(services);
  } catch (error) {
    console.error('GET SERVICES ERROR:', error);
    res.status(500).send({
      message: 'Failed to fetch services',
    });
  }
});

// payments
app.post('create-checkout-session', async(req, res)=>{
  const payload = req.body;
 const service = await servicesCollection.findOne({
  _id: new ObjectId(payload.serviceId),
});


    if(!service){
      throw new error('service not found')
    }
  // step2: create a booking in the database with status 'pending
  const booking ={
    serviceId: payload.serviceId,
    userEmail: payload.userEmail,
    status: 'pending',
    createdAt: new Date()
  }
  const bookingCreateResult = await bookingsCollection.insertOne(booking)

  // create a stripe checkout session
  const session = await stripe.checkout.sessions.create({
    line_items:[
      {
        price_data:{
          currency: 'usd',
          product_data:{
            name: service.serviceName,
            description:service.description,
            
          },
          unit_amount: service.price * 0.00804 * 100, //convert usd to bdt
          quantity: 1
        },
      }
    ],

    success_url: `${process.env.CLIENT_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/checkout/cancel`,
    mode: 'payment',
    metadata:{
      bookingId: bookingCreateResult.insertedId.toString(),
      userId: payload.userId,
    }
  })
console.log(session, 'session');
res.send({
  success: true,
  url: session.url,
});

})





// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
