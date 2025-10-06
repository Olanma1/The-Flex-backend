import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.get("/api/reviews/hostaway", async (req, res) => {
  try {
    const mockFilePath = path.join(__dirname, "mockReviews.json");

    // Ensure the file exists
    if (!(await fs.pathExists(mockFilePath))) {
      return res.status(404).json({
        status: "error",
        message: "mockReviews.json not found in backend directory",
      });
    }

    const mockData = await fs.readJson(mockFilePath);

    const normalized = mockData.result.map((r) => ({
      id: r.id,
      guest: r.guestName,
      listing: r.listingName,
      rating: r.rating ?? 0,
      type: r.type,
      date: r.submittedAt,
      text: r.publicReview,
      categories: r.reviewCategory,
    }));

    res.json({ status: "success", data: normalized });
  } catch (err) {
    console.error("Error loading reviews:", err);
    res
      .status(500)
      .json({ status: "error", message: "Failed to load reviews" });
  }
});

const properties = [
  { id: 85974, name: "Cozy Apartment in Lekki", description: "A stylish modern apartment with ocean views." },
  { id: 85975, name: "Ikeja Executive Suite", description: "Close to the airport, quiet and comfortable." },
];

const propertyReviews = {
  85974: [
    { id: 1, guest: "Jane Doe", rating: 5, text: "Loved it! So clean and peaceful." },
    { id: 2, guest: "John Smith", rating: 4, text: "Great location and comfortable stay." },
  ],
  85975: [
    { id: 3, guest: "Mary Johnson", rating: 5, text: "Excellent experience!" },
  ],
};

app.get("/properties/:id", (req, res) => {
  const propertyId = parseInt(req.params.id);
  const property = properties.find((p) => p.id === propertyId);

  if (!property) {
    return res.status(404).json({ message: "Property not found" });
  }

  res.json(property);
});

app.get("/properties/:id/reviews", (req, res) => {
  const propertyId = parseInt(req.params.id);
  const approved = req.query.approved === "true";
  const reviews = propertyReviews[propertyId] || [];

  res.json(approved ? reviews.filter((r) => r.approved !== false) : reviews);
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
