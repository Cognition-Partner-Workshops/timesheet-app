const express = require('express');
const { getNotesDatabase } = require('../database/notesDb');
const { authenticateUser } = require('../middleware/auth');
const { noteSchema, updateNoteSchema } = require('../validation/schemas');

const router = express.Router();

router.use(authenticateUser);

// Get all notes for authenticated user
router.get('/', async (req, res) => {
  try {
    const db = getNotesDatabase();
    const { tag, search } = req.query;

    const query = { user_email: req.userEmail };

    if (tag) {
      query.tags = tag;
    }

    if (search) {
      query.$or = [
        { title: new RegExp(search, 'i') },
        { content: new RegExp(search, 'i') }
      ];
    }

    const notes = await db.find(query).sort({ pinned: -1, updated_at: -1 });
    res.json({ notes });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific note
router.get('/:id', async (req, res) => {
  try {
    const db = getNotesDatabase();
    const note = await db.findOne({ _id: req.params.id, user_email: req.userEmail });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ note });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new note
router.post('/', async (req, res, next) => {
  try {
    const { error, value } = noteSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getNotesDatabase();
    const now = new Date().toISOString();

    const noteDoc = {
      title: value.title,
      content: value.content || '',
      tags: value.tags || [],
      category: value.category || '',
      pinned: value.pinned || false,
      user_email: req.userEmail,
      created_at: now,
      updated_at: now
    };

    const note = await db.insert(noteDoc);
    res.status(201).json({ message: 'Note created successfully', note });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// Update a note
router.put('/:id', async (req, res, next) => {
  try {
    const { error, value } = updateNoteSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    const db = getNotesDatabase();
    const existing = await db.findOne({ _id: req.params.id, user_email: req.userEmail });

    if (!existing) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (value.title !== undefined) updates.title = value.title;
    if (value.content !== undefined) updates.content = value.content;
    if (value.tags !== undefined) updates.tags = value.tags;
    if (value.category !== undefined) updates.category = value.category;
    if (value.pinned !== undefined) updates.pinned = value.pinned;

    await db.update({ _id: req.params.id, user_email: req.userEmail }, { $set: updates });

    const note = await db.findOne({ _id: req.params.id });
    res.json({ message: 'Note updated successfully', note });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Delete a note
router.delete('/:id', async (req, res) => {
  try {
    const db = getNotesDatabase();
    const existing = await db.findOne({ _id: req.params.id, user_email: req.userEmail });

    if (!existing) {
      return res.status(404).json({ error: 'Note not found' });
    }

    await db.remove({ _id: req.params.id, user_email: req.userEmail });
    res.json({ message: 'Note deleted successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;
