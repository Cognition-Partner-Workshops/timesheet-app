const mongoose = require('mongoose');

const testSeriesSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
    },
    category: {
      type: String,
      required: [true, 'Please add a category'],
      enum: [
        'Banking',
        'SSC',
        'Railways',
        'Insurance',
        'Teaching',
        'Defence',
        'State Exams',
        'UPSC',
        'Other',
      ],
    },
    image: {
      type: String,
      default: '',
    },
    tests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Test',
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    price: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TestSeries', testSeriesSchema);
