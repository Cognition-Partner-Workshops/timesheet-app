const XLSX = require('xlsx');

const parseExcelFile = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  return parseRows(data);
};

const parseCSVFile = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  return parseRows(data);
};

const parseJSONFile = (fileContent) => {
  try {
    const data = JSON.parse(fileContent);
    if (!Array.isArray(data)) {
      return { success: false, errors: ['JSON must be an array of questions'] };
    }

    const questions = [];
    const errors = [];

    data.forEach((item, index) => {
      const rowNum = index + 1;
      const validation = validateJSONQuestion(item, rowNum);

      if (validation.errors.length > 0) {
        errors.push(...validation.errors);
      } else {
        questions.push(validation.question);
      }
    });

    return { success: errors.length === 0, questions, errors };
  } catch (err) {
    return { success: false, errors: ['Invalid JSON format'] };
  }
};

const parseRows = (data) => {
  const questions = [];
  const errors = [];

  data.forEach((row, index) => {
    const rowNum = index + 2; // +2 because row 1 is header, data starts at row 2
    const validation = validateRow(row, rowNum);

    if (validation.errors.length > 0) {
      errors.push(...validation.errors);
    } else {
      questions.push(validation.question);
    }
  });

  return { success: errors.length === 0, questions, errors };
};

const validateRow = (row, rowNum) => {
  const errors = [];

  const questionNumber = row['QuestionNumber'] || row['questionNumber'] || row['Question Number'];
  const section = row['Section'] || row['section'] || 'General';
  const questionText = row['QuestionText'] || row['questionText'] || row['Question Text'] || row['Question'];
  const optionA = row['OptionA'] || row['optionA'] || row['Option A'] || row['A'];
  const optionB = row['OptionB'] || row['optionB'] || row['Option B'] || row['B'];
  const optionC = row['OptionC'] || row['optionC'] || row['Option C'] || row['C'];
  const optionD = row['OptionD'] || row['optionD'] || row['Option D'] || row['D'];
  const correctAnswer = (row['CorrectAnswer'] || row['correctAnswer'] || row['Correct Answer'] || row['Answer'] || '').toString().toUpperCase().trim();
  const explanation = row['Explanation'] || row['explanation'] || '';
  const marks = row['Marks'] || row['marks'] || 1;

  if (!questionText) {
    errors.push(`Row ${rowNum}: Question text is required`);
  }
  if (!optionA || !optionB || !optionC || !optionD) {
    errors.push(`Row ${rowNum}: All four options (A, B, C, D) are required`);
  }
  if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
    errors.push(`Row ${rowNum}: Correct answer must be A, B, C, or D (got: "${correctAnswer}")`);
  }

  const question = {
    questionNumber: questionNumber || rowNum - 1,
    section,
    questionText: questionText ? questionText.toString() : '',
    options: [
      { optionId: 'A', text: optionA ? optionA.toString() : '' },
      { optionId: 'B', text: optionB ? optionB.toString() : '' },
      { optionId: 'C', text: optionC ? optionC.toString() : '' },
      { optionId: 'D', text: optionD ? optionD.toString() : '' },
    ],
    correctAnswer,
    explanation: explanation ? explanation.toString() : '',
    marks: Number(marks) || 1,
  };

  return { errors, question };
};

const validateJSONQuestion = (item, rowNum) => {
  const errors = [];

  if (!item.questionText) {
    errors.push(`Question ${rowNum}: questionText is required`);
  }

  if (!item.options || !Array.isArray(item.options) || item.options.length !== 4) {
    errors.push(`Question ${rowNum}: Must have exactly 4 options`);
  } else {
    const validIds = ['A', 'B', 'C', 'D'];
    item.options.forEach((opt, i) => {
      if (!opt.optionId || !validIds.includes(opt.optionId)) {
        errors.push(`Question ${rowNum}: Option ${i + 1} must have optionId A, B, C, or D`);
      }
      if (!opt.text) {
        errors.push(`Question ${rowNum}: Option ${opt.optionId || i + 1} must have text`);
      }
    });
  }

  const correctAnswer = (item.correctAnswer || '').toString().toUpperCase().trim();
  if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
    errors.push(`Question ${rowNum}: correctAnswer must be A, B, C, or D`);
  }

  const question = {
    questionNumber: item.questionNumber || rowNum,
    section: item.section || 'General',
    questionText: item.questionText || '',
    options: item.options || [],
    correctAnswer,
    explanation: item.explanation || '',
    marks: Number(item.marks) || 1,
  };

  return { errors, question };
};

module.exports = { parseExcelFile, parseCSVFile, parseJSONFile };
