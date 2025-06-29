const mongoose = require("mongoose")
const User = require("../src/models/User")
require("dotenv").config()

const seedUsers = [
  {
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    password: "Password123!",
    preferences: {
      newsletter: true,
      notifications: true,
      theme: "dark",
      language: "en",
    },
    privacy: {
      profileVisible: true,
      dataProcessing: true,
      marketing: false,
    },
    emailVerified: true,
  },
  {
    firstName: "Jane",
    lastName: "Smith",
    email: "jane.smith@example.com",
    password: "SecurePass456!",
    preferences: {
      newsletter: false,
      notifications: true,
      theme: "light",
      language: "es",
    },
    privacy: {
      profileVisible: false,
      dataProcessing: true,
      marketing: true,
    },
    emailVerified: false,
  },
]

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log("Connected to MongoDB")

    await User.deleteMany({})
    console.log("Cleared existing users")

    for (const userData of seedUsers) {
      const user = new User(userData)
      await user.save()
      console.log(`Created user: ${user.email}`)
    }

    console.log("Database seeded successfully")
    process.exit(0)
  } catch (error) {
    console.error("Seeding error:", error)
    process.exit(1)
  }
}

seedDatabase()
