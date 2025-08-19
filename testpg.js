const { Client } = require("pg");

const client = new Client({
  host: "localhost",
  port: 5432,
  user: "user",
  password: "password",
  database: "mydb",
});

await client.connect();
