import { createLogger } from "breakcheck-core";
import express from "express";

// Create a logger configured for JSON output (REST API)
const logger = createLogger({ useJsonLogs: true });

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  logger.info("Health check endpoint accessed");
  res.send("Breakcheck REST Server is running!");
});

// Example of a future endpoint
app.post("/compare", async (req, res) => {
  try {
    logger.info({ body: req.body }, "Compare endpoint called");
    // const config = req.body;
    // const summary = await runComparison(config);
    // res.json(summary);
    res.status(501).json({ message: "Endpoint not yet implemented." });
  } catch (error) {
    logger.error({ err: error }, "Error in compare endpoint");
    res.status(500).json({ message: "An error occurred." });
  }
});

app.listen(port, () => {
  logger.info({ port }, "Breakcheck REST server started");
});
