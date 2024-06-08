import { v4 as uuidv4 } from "uuid";
import { Server, StableBTreeMap, None } from "azle";
import bcrypt from 'bcrypt';
import express from "express";

// Define the Admin class to represent administrators
class Admin {
  id: string;
  name: string;
  email: string;
  password: string;

  constructor(name: string, email: string, password: string) {
    this.id = uuidv4();
    this.name = name;
    this.email = email;
    this.password = password;
  }
}

// Define the Volunteer class to represent volunteers
class Volunteer {
  id: string;
  name: string;
  email: string;
  contact: string;
  skills: string[];
  createdAt: Date;

  constructor(name: string, email: string, contact: string, skills: string[]) {
    this.id = uuidv4();
    this.name = name;
    this.email = email;
    this.contact = contact;
    this.skills = skills;
    this.createdAt = new Date();
  }
}

// Define the Event class to represent events
class Event {
  id: string;
  adminId: string;
  title: string;
  description: string;
  dateTime: Date;
  location: string;
  organizerId: string;
  createdAt: Date;

  constructor(adminId: string, title: string, description: string, dateTime: Date, location: string, organizerId: string) {
    this.id = uuidv4();
    this.adminId = adminId;
    this.title = title;
    this.description = description;
    this.dateTime = dateTime;
    this.location = location;
    this.organizerId = organizerId;
    this.createdAt = new Date();
  }
}

// Define the Registration class to represent event registrations
class Registration {
  id: string;
  eventId: string;
  volunteerId: string;
  status: string; // 'Registered', 'Attended', 'Missed'
  registeredAt: Date;
  attendedAt: Date | null;

  constructor(eventId: string, volunteerId: string, status: string) {
    this.id = uuidv4();
    this.eventId = eventId;
    this.volunteerId = volunteerId;
    this.status = status;
    this.registeredAt = new Date();
    this.attendedAt = null;
  }
}

// Define the Feedback class to represent feedback
class Feedback {
  id: string;
  volunteerId: string;
  eventId: string;
  feedback: string;
  rating: number; // e.g., 1-5 stars
  createdAt: Date;

  constructor(volunteerId: string, eventId: string, feedback: string, rating: number) {
    this.id = uuidv4();
    this.volunteerId = volunteerId;
    this.eventId = eventId;
    this.feedback = feedback;
    this.rating = rating;
    this.createdAt = new Date();
  }
}

// Initialize stable maps for storing platform data
const volunteersStorage = StableBTreeMap<string, Volunteer>(0);
const eventsStorage = StableBTreeMap<string, Event>(1);
const registrationsStorage = StableBTreeMap<string, Registration>(2);
const feedbacksStorage = StableBTreeMap<string, Feedback>(3);
const adminsStorage = StableBTreeMap<string, Admin>(4);

// Define the express server
export default Server(() => {
  const app = express();
  app.use(express.json());

  // Endpoint for creating a new admin
  app.post("/admins", async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password || typeof name !== "string" || typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "Invalid input: Ensure 'name', 'email', and 'password' are provided and are of the correct types." });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "Invalid input: Ensure 'email' is a valid email address." });
      return;
    }

    const existingAdmins = adminsStorage.values();
    const existingAdmin = existingAdmins.find((admin) => admin.email === email);
    if (existingAdmin) {
      res.status(400).json({ error: "Invalid input: Admin with the same email already exists." });
      return;
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const admin = new Admin(name, email, hashedPassword);
      adminsStorage.insert(admin.id, admin);
      res.status(201).json({ message: "Admin created successfully", admin });
    } catch (error) {
      console.error("Failed to create admin:", error);
      res.status(500).json({ error: "Server error occurred while creating the admin." });
    }
  });

  // Endpoint for creating a new volunteer
  app.post("/volunteers", (req, res) => {
    const { name, email, contact, skills } = req.body;
    if (!name || !email || !contact || !skills || typeof name !== "string" || typeof contact !== "string" || !Array.isArray(skills)) {
      res.status(400).json({ error: "Invalid input: Ensure 'name', 'contact', 'email', and 'skills' are provided and are of the correct types." });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: "Invalid input: Ensure 'email' is a valid email address." });
      return;
    }

    const existingVolunteers = volunteersStorage.values();
    const existingVolunteer = existingVolunteers.find((volunteer) => volunteer.email === email);
    if (existingVolunteer) {
      res.status(400).json({ error: "Invalid input: Volunteer with the same email already exists." });
      return;
    }

    try {
      const volunteer = new Volunteer(name, email, contact, skills);
      volunteersStorage.insert(volunteer.id, volunteer);
      res.status(201).json({ message: "Volunteer created successfully", volunteer });
    } catch (error) {
      console.error("Failed to create volunteer:", error);
      res.status(500).json({ error: "Server error occurred while creating the volunteer." });
    }
  });

  // Endpoint for retrieving a volunteer by ID
  app.get("/volunteers/:id", (req, res) => {
    const volunteerId = req.params.id;
    if (typeof volunteerId !== "string") {
      res.status(400).json({ error: "Invalid input: Ensure 'id' is a string." });
      return;
    }

    const volunteer = volunteersStorage.get(volunteerId);
    if (volunteer === None) {
      res.status(404).json({ error: "Volunteer with the provided ID does not exist." });
      return;
    }

    try {
      res.status(200).json({ message: "Volunteer retrieved successfully", volunteer });
    } catch (error) {
      console.error("Failed to retrieve volunteer:", error);
      res.status(500).json({ error: "Server error occurred while retrieving the volunteer." });
    }
  });

  // Endpoint for retrieving volunteers in chunks (pagination)
  app.get("/volunteers/pagination/:start/:end", (req, res) => {
    const start = parseInt(req.params.start);
    const end = parseInt(req.params.end);
    if (isNaN(start) || isNaN(end)) {
      res.status(400).json({ error: "Invalid input: Ensure 'start' and 'end' are integers." });
      return;
    }

    if (start >= end) {
      res.status(400).json({ error: "Invalid input: Ensure 'start' is less than 'end'." });
      return;
    }

    try {
      const volunteers = volunteersStorage.values();
      const chunk = volunteers.slice(start, end);
      res.status(200).json({ message: "Volunteers retrieved successfully", volunteers: chunk });
    } catch (error) {
      console.error("Failed to retrieve volunteers:", error);
      res.status(500).json({ error: "Server error occurred while retrieving volunteers." });
    }
  });

  // Endpoint for retrieving all volunteers
  app.get("/volunteers", (req, res) => {
    try {
      const volunteers = volunteersStorage.values();
      if (volunteers.length === 0) {
        res.status(404).json({ error: "No volunteers found." });
        return;
      }
      res.status(200).json({ message: "Volunteers retrieved successfully", volunteers });
    } catch (error) {
      console.error("Failed to retrieve volunteers:", error);
      res.status(500).json({ error: "Server error occurred while retrieving volunteers." });
    }
  });

  // Endpoint for creating a new event
  app.post("/events", (req, res) => {
    const { adminId, title, description, dateTime, location, organizerId } = req.body;
    if (!adminId || !title || !description || !dateTime || !location || !organizerId || typeof title !== "string" || typeof description !== "string" || typeof location !== "string" || typeof organizerId !== "string") {
      res.status(400).json({ error: "Invalid input: Ensure 'title', 'description', 'dateTime', 'location', and 'organizerId' are provided and are of the correct types." });
      return;
    }

    const admin = adminsStorage.get(adminId);
    if (admin === None) {
      res.status(404).json({ error: "Admin with the provided ID does not exist." });
      return;
    }

    try {
      const event = new Event(adminId, title, description, new Date(dateTime), location, organizerId);
      eventsStorage.insert(event.id, event);
      res.status(201).json({ message: "Event created successfully", event });
    } catch (error) {
      console.error("Failed to create event:", error);
      res.status(500).json({ error: "Server error occurred while creating the event." });
    }
  });

  // Endpoint for retrieving all events
  app.get("/events", (req, res) => {
    try {
      const events = eventsStorage.values();
      res.status(200).json({ message: "Events retrieved successfully", events });
    } catch (error) {
      console.error("Failed to retrieve events:", error);
      res.status(500).json({ error: "Server error occurred while retrieving events." });
    }
  });

  // Endpoint for creating a new registration
  app.post("/registrations", (req, res) => {
    const { eventId, volunteerId, status } = req.body;
    if (!eventId || !volunteerId || !status || typeof eventId !== "string" || typeof volunteerId !== "string" || typeof status !== "string") {
      res.status(400).json({ error: "Invalid input: Ensure 'eventId', 'volunteerId', and 'status' are provided and are of the correct types." });
      return;
    }

    try {
      const registration = new Registration(eventId, volunteerId, status);
      registrationsStorage.insert(registration.id, registration);
      res.status(201).json({ message: "Registration created successfully", registration });
    } catch (error) {
      console.error("Failed to create registration:", error);
      res.status(500).json({ error: "Server error occurred while creating the registration." });
    }
  });

  // Endpoint for retrieving all registrations
  app.get("/registrations", (req, res) => {
    try {
      const registrations = registrationsStorage.values();
      res.status(200).json({ message: "Registrations retrieved successfully", registrations });
    } catch (error) {
      console.error("Failed to retrieve registrations:", error);
      res.status(500).json({ error: "Server error occurred while retrieving registrations." });
    }
  });

  // Endpoint for creating new feedback
  app.post("/feedbacks", (req, res) => {
    const { volunteerId, eventId, feedback, rating } = req.body;
    if (!volunteerId || !eventId || !feedback || !rating || typeof volunteerId !== "string" || typeof eventId !== "string" || typeof feedback !== "string" || typeof rating !== "number") {
      res.status(400).json({ error: "Invalid input: Ensure 'volunteerId', 'eventId', 'feedback', and 'rating' are provided and are of the correct types." });
      return;
    }

    try {
      const feedbackEntry = new Feedback(volunteerId, eventId, feedback, rating);
      feedbacksStorage.insert(feedbackEntry.id, feedbackEntry);
      res.status(201).json({ message: "Feedback created successfully", feedback: feedbackEntry });
    } catch (error) {
      console.error("Failed to create feedback:", error);
      res.status(500).json({ error: "Server error occurred while creating the feedback." });
    }
  });

  // Endpoint for retrieving all feedback
  app.get("/feedbacks", (req, res) => {
    try {
      const feedbacks = feedbacksStorage.values();
      res.status(200).json({ message: "Feedback retrieved successfully", feedbacks });
    } catch (error) {
      console.error("Failed to retrieve feedback:", error);
      res.status(500).json({ error: "Server error occurred while retrieving feedback." });
    }
  });

  // Start the server
  return app.listen();
});
