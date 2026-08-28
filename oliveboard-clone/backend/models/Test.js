const mongoose = require('mongoose');

const testSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a test title'],
      trim: true,
    },
    testSeries: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestSeries',
      required: true,
    },
    duration: {
      type: Number,
      required: [true, 'Please add duration in minutes'],
    },
    totalMarks: {
      type: Number,
      required: [true, 'Please add total marks'],
    },
    negativeMarking: {
      type: Number,
      default: 0,
    },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Test', testSchema);
