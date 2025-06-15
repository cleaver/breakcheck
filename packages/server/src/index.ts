import express from "express";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Breakcheck REST Server is running!");
});

// Example of a future endpoint
app.post("/compare", async (req, res) => {
  try {
    // const config = req.body;
    // const summary = await runComparison(config);
    // res.json(summary);
    res.status(501).json({ message: "Endpoint not yet implemented." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred." });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
