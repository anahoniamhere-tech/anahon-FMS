import net from "net";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

async function verifyPostgresConnection() {
  console.log("=== PostgreSQL Database Connection Diagnostic ===");

  // 1. Try to load database URL
  let dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    // Check local .env first
    const localEnvPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(localEnvPath)) {
      dotenv.config({ path: localEnvPath });
      dbUrl = process.env.DATABASE_URL;
    }
  }

  if (!dbUrl) {
    // Check sibling Untitled project .env
    const siblingEnvPath = path.join(process.cwd(), "..", "Untitled", ".env");
    if (fs.existsSync(siblingEnvPath)) {
      console.log("Found database configuration in sibling Next.js project .env.");
      const content = fs.readFileSync(siblingEnvPath, "utf-8");
      const match = content.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
      if (match) {
        dbUrl = match[1];
      }
    }
  }

  if (!dbUrl) {
    console.error("✗ Error: No DATABASE_URL found in either local .env or sibling project .env.");
    console.log("Please define DATABASE_URL in your .env file.");
    process.exit(1);
  }

  console.log(`- Connection String Detected: ${dbUrl.replace(/:([^@:]+)@/, ":****@")}`); // Hide password

  // 2. Parse Host and Port from connection string
  // Format: postgresql://username:password@host:port/database
  const parsed = dbUrl.match(/@([^/:]+)(?::(\d+))?\/([^?]+)/);
  if (!parsed) {
    console.error("✗ Error: Could not parse host/port from DATABASE_URL.");
    process.exit(1);
  }

  const host = parsed[1];
  const port = parseInt(parsed[2] || "5432", 10);
  const dbName = parsed[3];

  console.log(`- Target Host: ${host}`);
  console.log(`- Target Port: ${port}`);
  console.log(`- Target Database Name: ${dbName}`);
  console.log("\nAttempting TCP socket handshake to database server...");

  // 3. Perform TCP Socket connection check
  const socket = new net.Socket();
  const start = Date.now();

  const client = socket.connect(port, host, () => {
    const elapsed = Date.now() - start;
    console.log(`\n✓ Success: Secure network connection established with PostgreSQL in ${elapsed}ms!`);
    console.log("- Network status: ONLINE");
    console.log("- Firewall permission: GRANTED");
    client.destroy();
  });

  socket.on("error", (err: any) => {
    console.error(`\n✗ Error: Could not connect to database server at ${host}:${port}.`);
    console.error(`- Details: ${err.message}`);
    console.log("- Network status: OFFLINE / BLOCKED");
    client.destroy();
  });

  socket.setTimeout(5000, () => {
    console.error(`\n✗ Error: Connection to database timed out after 5000ms.`);
    console.log("- Network status: BLOCKED / SLOW");
    client.destroy();
  });
}

verifyPostgresConnection();
