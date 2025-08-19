import { Client } from "pg";

const client = new Client({
  host: "localhost",
  port: 5432,
  user: "user",
  password: "password",
  database: "mydb",
});

export async function connectToDatabase() {
  try {
    await client.connect();
    console.log("Connected to the database successfully");
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    throw error;
  }
}

connectToDatabase();
