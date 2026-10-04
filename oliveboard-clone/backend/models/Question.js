const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Test',
      required: true,
    },
    questionText: {
      type: String,
      required: [true, 'Please add question text'],
    },
    options: [
      {
        optionId: {
          type: String,
          enum: ['A', 'B', 'C', 'D'],
          required: true,
        },
        text: {
          type: String,
          required: true,
        },
      },
    ],
    correctAnswer: {
      type: String,
      enum: ['A', 'B', 'C', 'D'],
      required: [true, 'Please add the correct answer'],
    },
    explanation: {
      type: String,
      default: '',
    },
    section: {
      type: String,
      default: 'General',
    },
    marks: {
      type: Number,
      default: 1,
    },
    questionNumber: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Question', questionSchema);
