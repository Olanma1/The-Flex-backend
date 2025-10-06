const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const router = express.Router();

const MOCK_PATH = path.join(__dirname, '..', 'mock', 'hostaway_reviews.json');
const APPROVALS_PATH = path.join(__dirname, '..', 'mock', 'approvals.json');

// helper: parse Hostaway date to ISO
function parseHostawayDate(dt) {
  if (!dt) return null;
  return new Date(dt.replace(' ', 'T')).toISOString();
}

async function loadMock() {
  const raw = await fs.readFile(MOCK_PATH, 'utf8');
  return JSON.parse(raw);
}

async function loadApprovals() {
  try {
    return await fs.readJson(APPROVALS_PATH);
  } catch (e) {
    return {}; 
  }
}

function computeOverall(raw) {
  if (raw.rating !== null && raw.rating !== undefined) return raw.rating;
  if (Array.isArray(raw.reviewCategory) && raw.reviewCategory.length) {
    const sum = raw.reviewCategory.reduce((s, c) => s + (c.rating || 0), 0);
    return Math.round(sum / raw.reviewCategory.length);
  }
  return null;
}

function normalize(raw, approvalsMap = {}) {
  const overallRating = computeOverall(raw);
  const id = `hostaway-${raw.id}`;
  return {
    id,
    source: 'hostaway',
    rawId: raw.id,
    listingName: raw.listingName || null,
    listingId: raw.listingId || null,
    type: raw.type || null,
    channel: raw.channel || null,
    status: raw.status || null,
    guestName: raw.guestName || null,
    publicReview: raw.publicReview || null,
    reviewCategory: raw.reviewCategory || [],
    overallRating,
    submittedAt: parseHostawayDate(raw.submittedAt),
    approved: !!approvalsMap[id]
  };
}

// GET /api/reviews/hostaway
router.get('/hostaway', async (req, res) => {
  try {
    const parsed = await loadMock();
    const approvals = await loadApprovals();

    if (!parsed || !Array.isArray(parsed.result)) {
      return res.status(500).json({ error: 'Invalid mock data' });
    }

    let reviews = parsed.result.map(r => normalize(r, approvals));

    // filtering
    const { listing, rating_min, rating_max, date_from, date_to, status, type } = req.query;

    if (listing) {
      reviews = reviews.filter(r => (r.listingName || '').toLowerCase().includes(listing.toLowerCase()));
    }
    if (status) {
      reviews = reviews.filter(r => (r.status || '').toLowerCase() === status.toLowerCase());
    }
    if (type) {
      reviews = reviews.filter(r => (r.type || '').toLowerCase() === type.toLowerCase());
    }
    if (rating_min) {
      const min = parseFloat(rating_min);
      reviews = reviews.filter(r => r.overallRating !== null && r.overallRating >= min);
    }
    if (rating_max) {
      const max = parseFloat(rating_max);
      reviews = reviews.filter(r => r.overallRating !== null && r.overallRating <= max);
    }
    if (date_from) {
      const from = new Date(date_from);
      reviews = reviews.filter(r => r.submittedAt && new Date(r.submittedAt) >= from);
    }
    if (date_to) {
      const to = new Date(date_to);
      reviews = reviews.filter(r => r.submittedAt && new Date(r.submittedAt) <= to);
    }

    // list by group
    const byListing = {};
    reviews.forEach(r => {
      const key = r.listingName || 'Unknown Listing';
      if (!byListing[key]) byListing[key] = { listingName: key, reviews: [], averageRating: null };
      byListing[key].reviews.push(r);
    });
    Object.values(byListing).forEach(g => {
      const ratings = g.reviews.map(x => x.overallRating).filter(Boolean);
      g.averageRating = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length) : null;
    });

    res.json({
      source: 'hostaway',
      count: reviews.length,
      byListing,
      reviews,
      generatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch hostaway reviews' });
  }
});

router.post('/:id/approve', async (req, res) => {
  try {
    const id = req.params.id;
    const { approved } = req.body;
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'body must include { approved: boolean }' });
    }

    const approvals = await loadApprovals();
    approvals[id] = approved;

    await fs.writeJson(APPROVALS_PATH, approvals, { spaces: 2 });

    res.json({ id, approved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save approval' });
  }
});

module.exports = router;
