const express = require('express');
const cors = require('cors');
require ('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;
// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vafxttx.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // await client.connect();
        
        const db = client.db('event_db');
        const eventsCollection = db.collection('events');
        const bookingsCollection = db.collection('bookings');

        app.get('/', (req, res) => {
            res.send('Event Management Server is running.');
        });


        app.get('/events', async (req, res) => {
            try {
                const events = await eventsCollection.find().toArray();
                res.send(events);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch events." });
            }
        });

        app.get('/events/:slug', async (req, res) => {
            const slug = req.params.slug;
            try {
                const event = await eventsCollection.findOne({ slug });
                if (!event) return res.status(404).send({ message: "Event not found" });
                res.send(event);
            } catch (error) {
                 res.status(500).send({ message: "Failed to fetch event." });
            }
        });

        app.get('/bookings', async (req, res) => {
            const { userId, eventSlug } = req.query;
            const query = {};
            if (userId) query.userId = userId;
            if (eventSlug) query.eventSlug = eventSlug;

            try {
                const pipeline = [
                    { $match: query }, 
                    
                    {
                        $lookup: {
                            from: "events",       
                            localField: "eventSlug", 
                            foreignField: "slug", 
                            as: "eventDetails"    
                        }
                    },
                    
                    {
                        $unwind: {
                            path: "$eventDetails",
                            preserveNullAndEmptyArrays: true 
                        }
                    },
                    
                    {
                        $project: {
                            _id: 1, 
                            userId: 1,
                            eventSlug: 1,
                            bookedAt: 1, 
                            
                            eventTitle: { $ifNull: ["$eventDetails.title", "$eventTitle"] },
                            eventFormattedDate: { $ifNull: ["$eventDetails.metaInfo.formattedDate", "$eventFormattedDate"] },
                            eventTime: { $ifNull: ["$eventDetails.metaInfo.time", "$eventTime"] },
                            eventCategory: { $ifNull: ["$eventDetails.metaInfo.category", "$eventCategory"] },
                        }
                    }
                ];

                const bookingsWithDetails = await bookingsCollection.aggregate(pipeline).toArray();
                res.send(bookingsWithDetails);
            } catch (error) {
                console.error("Error fetching bookings:", error);
                res.status(500).send({ message: "Failed to fetch bookings with details." });
            }
        });

        // POST create a new booking
        app.post('/bookings', async (req, res) => {
            const { userId, eventSlug, bookedAt } = req.body;

            if (!userId || !eventSlug) {
                return res.status(400).send({ message: "Missing required fields: userId, eventSlug." });
            }

            try {
                const event = await eventsCollection.findOne({ slug: eventSlug });
                if (!event) {
                    return res.status(404).send({ message: "Event not found." });
                }

                const exists = await bookingsCollection.findOne({ userId, eventSlug });
                if (exists) {
                    return res.status(400).send({ message: "Already booked." });
                }

                const booking = {
                    userId,
                    eventSlug,
                    eventTitle: event.title || "Untitled Event",
                    eventFormattedDate: event.metaInfo?.formattedDate || "Date N/A",
                    eventTime: event.metaInfo?.time || "Time N/A",
                    eventCategory: event.metaInfo?.category || "N/A",

                    bookedAt: bookedAt || new Date().toISOString()
                };

                const result = await bookingsCollection.insertOne(booking);
                res.status(201).send(result);

            } catch (err) {
                console.error(err);
                res.status(500).send({ message: "Failed to create booking." });
            }
        });

        // DELETE booking
        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to delete booking." });
            }
        });

        // await client.db("admin").command({ ping: 1 });
        console.log("✅ Connected to MongoDB successfully!");

    } finally {
    }
}

run().catch(console.dir);

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});