const Question = require('../models/Question');
const Test = require('../models/Test');
const { parseExcelFile, parseCSVFile, parseJSONFile } = require('../utils/parseQuestions');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// POST /api/admin/tests/:testId/questions — add single question
const addQuestion = async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId);
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    const { questionText, options, correctAnswer, explanation, section, marks, questionNumber } = req.body;

    const question = await Question.create({
      test: req.params.testId,
      questionText,
      options,
      correctAnswer,
      explanation,
      section,
      marks,
      questionNumber: questionNumber || test.questions.length + 1,
    });

    test.questions.push(question._id);
    await test.save();

    res.status(201).json(question);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/admin/tests/:testId/questions/bulk-upload — bulk upload questions
const bulkUploadQuestions = async (req, res) => {
  try {
    const test = await Test.findById(req.params.testId);
    if (!test) {
      return res.status(404).json({ message: 'Test not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }

    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    let result;

    if (ext === '.json') {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      result = parseJSONFile(fileContent);
    } else if (ext === '.csv') {
      result = parseCSVFile(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      result = parseExcelFile(filePath);
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Unsupported file format. Use .xlsx, .xls, .csv, or .json' });
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    if (result.errors.length > 0) {
      return res.status(400).json({
        message: 'Validation errors found',
        errors: result.errors,
        validQuestions: result.questions ? result.questions.length : 0,
        totalErrors: result.errors.length,
      });
    }

    // If preview mode, return parsed data without saving
    if (req.query.preview === 'true') {
      return res.json({
        message: 'Preview successful',
        questions: result.questions,
        totalQuestions: result.questions.length,
      });
    }

    // Save all questions
    const savedQuestions = [];
    for (const q of result.questions) {
      const question = await Question.create({
        test: req.params.testId,
        ...q,
      });
      savedQuestions.push(question);
      test.questions.push(question._id);
    }

    await test.save();

    res.status(201).json({
      message: `Successfully uploaded ${savedQuestions.length} questions`,
      totalQuestions: savedQuestions.length,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET /api/admin/tests/:testId/questions/template — download Excel template
const downloadTemplate = async (req, res) => {
  try {
    const templateData = [
      {
        QuestionNumber: 1,
        Section: 'Quantitative Aptitude',
        QuestionText: 'What is 25% of 400?',
        OptionA: '100',
        OptionB: '150',
        OptionC: '75',
        OptionD: '200',
        CorrectAnswer: 'A',
        Explanation: '25/100 * 400 = 100',
        Marks: 1,
      },
      {
        QuestionNumber: 2,
        Section: 'Reasoning',
        QuestionText: 'Find the odd one out: 2, 4, 6, 9, 10',
        OptionA: '2',
        OptionB: '6',
        OptionC: '9',
        OptionD: '10',
        CorrectAnswer: 'C',
        Explanation: '9 is odd, rest are even numbers',
        Marks: 1,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // QuestionNumber
      { wch: 25 }, // Section
      { wch: 50 }, // QuestionText
      { wch: 20 }, // OptionA
      { wch: 20 }, // OptionB
      { wch: 20 }, // OptionC
      { wch: 20 }, // OptionD
      { wch: 15 }, // CorrectAnswer
      { wch: 40 }, // Explanation
      { wch: 8 },  // Marks
    ];

    const templatePath = path.join(__dirname, '..', 'templates', 'question_template.xlsx');
    XLSX.writeFile(workbook, templatePath);

    res.download(templatePath, 'question_template.xlsx', (err) => {
      if (err) {
        res.status(500).json({ message: 'Error downloading template' });
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/admin/questions/:id — edit question
const updateQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const fields = ['questionText', 'options', 'correctAnswer', 'explanation', 'section', 'marks', 'questionNumber'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        question[field] = req.body[field];
      }
    });

    const updated = await question.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// DELETE /api/admin/questions/:id — delete question
const deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    await Test.findByIdAndUpdate(question.test, {
      $pull: { questions: question._id },
    });

    await Question.findByIdAndDelete(req.params.id);

    res.json({ message: 'Question deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  addQuestion,
  bulkUploadQuestions,
  downloadTemplate,
  updateQuestion,
  deleteQuestion,
};
