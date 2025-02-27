require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
//Must remove "/" from your production URL
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://test-p4-34f27.web.app",
      "https://test-p4-34f27.firebaseapp.com",
      "https://job-tasks-2.vercel.app" 
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json());




// Database connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.SECRET_KEY}@cluster0.snunz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

let db;
async function connectToDatabase() {
  if (!db) {
    await client.connect();
    db = client.db("jobPortal");
  }
  return db;
}

// Task Service
const taskService = {
  getTasks: async (userId) => {
    const db = await connectToDatabase();
    return db.collection("Tasks").find({ userId }).sort({ order: 1 }).toArray();
  },

  createTask: async (task) => {
    const db = await connectToDatabase();
    const result = await db.collection("Tasks").insertOne(task);
    return result.insertedId;
  },

  updateTask: async (id, task) => {
    const db = await connectToDatabase();
    const { _id, ...updateFields } = task; // Exclude `_id`
    const result = await db.collection("Tasks").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );
    return result.modifiedCount > 0;
  },

  deleteTask: async (id) => {
    const db = await connectToDatabase();
    const result = await db.collection("Tasks").deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  },

  reorderTasks: async (tasks) => {
    const db = await connectToDatabase();
    const bulkOps = tasks.map((task) => ({
      updateOne: {
        filter: { _id: new ObjectId(task._id) },
        update: { $set: { order: task.order } },
      },
    }));
    const result = await db.collection("Tasks").bulkWrite(bulkOps);
    return result.modifiedCount > 0;
  },
};

// API Routes
const routes = {
  home: (req, res) => res.send("Hello World"),

  getTasks: async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ message: "userId is required" });

      const tasks = await taskService.getTasks(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  createTask: async (req, res) => {
    try {     

      const { userId, title, category, order } = req.body;
      if (!userId || !title || !category || order === undefined) {
        return res.status(400).json({ message: "Missing required fields", received: req.body });
      }

      const taskId = await taskService.createTask(req.body);
      res.status(201).json({ _id: taskId });
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  updateTask: async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid task ID" });

      const success = await taskService.updateTask(id, req.body);
      res.status(success ? 200 : 404).json({
        message: success ? "Task updated successfully" : "Task not found",
      });
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  deleteTask: async (req, res) => {
    try {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid task ID" });

      const success = await taskService.deleteTask(id);
      res.status(success ? 200 : 404).json({
        message: success ? "Task deleted successfully" : "Task not found",
      });
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  },

  reorderTasks: async (req, res) => {
    try {
        const { tasks } = req.body;
        if (!tasks || !Array.isArray(tasks)) return res.status(400).json({ message: "Invalid tasks data" });
    
        const success = await taskService.reorderTasks(tasks);
        res.status(success ? 200 : 400).json({
          message: success ? "Tasks reordered successfully" : "Failed to reorder tasks",
        });
      } catch (error) {
        console.error("Error reordering tasks:", error);
        res.status(500).json({ message: "Internal server error" });
      }
  },
};

// Register Routes
app.get("/", routes.home);
app.get("/tasks", routes.getTasks);
app.post("/tasks", routes.createTask);
app.put("/tasks/:id", routes.updateTask);
app.delete("/tasks/:id", routes.deleteTask);
app.post("/tasks/reorder", routes.reorderTasks);

// Start Server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
