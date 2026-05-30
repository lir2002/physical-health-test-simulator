const fs = require('fs');
const path = require('path');

function parseFile(filePath, year) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Split by ### to get each question block
  const blocks = content.split('###').slice(1);
  const questions = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 3) continue;

    const title = lines[0];
    const isTF = title.includes('判断');
    const isMC = title.includes('选择') || title.includes('单项');
    const type = isTF ? 'tf' : (isMC ? 'mc' : 'unknown');

    if (type === 'unknown') {
      console.log(`Skipping unknown type: ${title}`);
      continue;
    }

    // Find 原题, 答案, 解读
    let stemRaw = '';
    let answerRaw = '';
    let explanationRaw = '';

    let currentSection = '';
    for (const line of lines.slice(1)) {
      if (line.startsWith('**原题：**')) {
        currentSection = 'stem';
        stemRaw += line.replace('**原题：**', '').trim() + '\n';
      } else if (line.startsWith('**答案：**')) {
        currentSection = 'answer';
        answerRaw += line.replace('**答案：**', '').trim() + '\n';
      } else if (line.startsWith('**解读：**')) {
        currentSection = 'explanation';
        explanationRaw += line.replace('**解读：**', '').trim() + '\n';
      } else {
        if (currentSection === 'stem') {
          stemRaw += line + '\n';
        } else if (currentSection === 'answer') {
          answerRaw += line + '\n';
        } else if (currentSection === 'explanation') {
          explanationRaw += line + '\n';
        }
      }
    }

    stemRaw = stemRaw.trim();
    answerRaw = answerRaw.trim();
    explanationRaw = explanationRaw.trim();

    // Clean up question number at start of stem (e.g. "1. ", "10. ", "10、", etc.)
    let stemCleaned = stemRaw.replace(/^\d+[\.．、\s]*/, '').trim();

    let options = [];
    let answer = '';

    if (isTF) {
      // True/False answer processing
      if (answerRaw.includes('√') || answerRaw.includes('对') || answerRaw.includes('正确')) {
        answer = 'T';
      } else if (answerRaw.includes('×') || answerRaw.includes('错') || answerRaw.includes('错误')) {
        answer = 'F';
      } else {
        console.warn(`Unknown TF answer format: ${answerRaw} in block ${title}`);
      }
    } else {
      // Multiple Choice processing
      // Extract answer letter (A, B, C, D)
      const ansMatch = answerRaw.match(/^([A-D])/i);
      if (ansMatch) {
        answer = ansMatch[1].toUpperCase();
      } else {
        console.warn(`Unknown MC answer format: ${answerRaw} in block ${title}`);
      }

      // Parse options. Options can be in the same line or on different lines.
      // We will look for A., B., C., D. or A、 B、 C、 D、
      // Let's combine the stemCleaned back into single line for easy regex if needed,
      // but let's see. Let's inspect the structure:
      // Option matches
      const optRegex = /([A-D])[\.．、\s]+([^\n]*?)(?=(?:\s+[A-D][\.．、\s]|\s*$))/g;
      
      // Let's replace newlines in stemCleaned with spaces to help match options if they are on same line,
      // but if they are on different lines, we can match them line by line.
      // Let's write a robust extraction:
      let optionsMap = {};
      let match;
      
      // We search for matches in the whole stemCleaned.
      // If we find A., B., C., we extract them.
      // Let's use a simpler and more reliable parser for options.
      // Let's find index of A., B., C.
      const indexA = stemCleaned.search(/(?:^|\s|[()（）])[A][\.．、\s]/);
      const indexB = stemCleaned.search(/(?:^|\s|[()（）])[B][\.．、\s]/);
      const indexC = stemCleaned.search(/(?:^|\s|[()（）])[C][\.．、\s]/);
      const indexD = stemCleaned.search(/(?:^|\s|[()（）])[D][\.．、\s]/);

      if (indexA !== -1) {
        // We have options inside the stem text!
        // Question stem is everything before indexA
        const questionText = stemCleaned.substring(0, indexA).trim();
        const optionsText = stemCleaned.substring(indexA);
        
        // Find options in optionsText
        const matches = [...optionsText.matchAll(/([A-D])[\.．、\s]+(.*?)(?=\s*[A-D][\.．、\s]|$)/gs)];
        for (const m of matches) {
          optionsMap[m[1].toUpperCase()] = m[2].trim();
        }
        stemCleaned = questionText;
      } else {
        // Maybe options are on newlines but without leading spaces?
        // Let's search line by line.
        const linesOfStem = stemRaw.replace(/^\d+[\.．、\s]*/, '').split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const stemLines = [];
        for (const line of linesOfStem) {
          const m = line.match(/^([A-D])[\.．、\s]+(.*)/i);
          if (m) {
            optionsMap[m[1].toUpperCase()] = m[2].trim();
          } else {
            stemLines.push(line);
          }
        }
        if (Object.keys(optionsMap).length > 0) {
          stemCleaned = stemLines.join('\n').trim();
        }
      }

      // Convert options map to sorted array
      const letters = ['A', 'B', 'C', 'D'];
      options = letters.map(l => optionsMap[l]).filter(val => val !== undefined);
      
      // Clean up question stem if it ends with "等", "A.", etc.
      stemCleaned = stemCleaned.replace(/\s*[A-D][\.．、\s].*$/, '').trim();
    }

    questions.push({
      id: `${year}-${type}-${questions.length + 1}`,
      type,
      year,
      title: title.trim(),
      stem: stemCleaned,
      options,
      answer,
      explanation: explanationRaw
    });
  }

  return questions;
}

const file2025 = path.join(__dirname, 'Questions-2025.md');
const file2026 = path.join(__dirname, 'Questions-predict-2026.md');

const q2025 = parseFile(file2025, 2025);
const q2026 = parseFile(file2026, 2026);

console.log(`Parsed 2025: ${q2025.length} questions`);
console.log(`- TF: ${q2025.filter(q => q.type === 'tf').length}`);
console.log(`- MC: ${q2025.filter(q => q.type === 'mc').length}`);

console.log(`Parsed 2026: ${q2026.length} questions`);
console.log(`- TF: ${q2026.filter(q => q.type === 'tf').length}`);
console.log(`- MC: ${q2026.filter(q => q.type === 'mc').length}`);

// Test printing one MCQ of each to verify options parsing
const mc25 = q2025.find(q => q.type === 'mc');
console.log('\nSample 2025 MC:');
console.log(JSON.stringify(mc25, null, 2));

const mc26 = q2026.find(q => q.type === 'mc');
console.log('\nSample 2026 MC:');
console.log(JSON.stringify(mc26, null, 2));

// Save to JSON files (root)
fs.writeFileSync(path.join(__dirname, 'questions-2025.json'), JSON.stringify(q2025, null, 2));
fs.writeFileSync(path.join(__dirname, 'questions-2026.json'), JSON.stringify(q2026, null, 2));
console.log('Saved JSON files to root!');

// Save to App data directory
const appDataDir = path.join(__dirname, 'app', 'src', 'data');
if (fs.existsSync(appDataDir)) {
  fs.writeFileSync(path.join(appDataDir, 'questions-2025.json'), JSON.stringify(q2025, null, 2));
  fs.writeFileSync(path.join(appDataDir, 'questions-2026.json'), JSON.stringify(q2026, null, 2));
  console.log('Saved JSON files to React App (app/src/data/)!');
} else {
  console.warn('React App data directory not found at', appDataDir);
}

// Save to WeChat Mini Program data directory
const wechatDataDir = path.join(__dirname, 'wechat-miniprogram', 'data');
if (fs.existsSync(wechatDataDir)) {
  fs.writeFileSync(path.join(wechatDataDir, 'questions-2025.js'), `module.exports = ${JSON.stringify(q2025, null, 2)};\n`);
  fs.writeFileSync(path.join(wechatDataDir, 'questions-2026.js'), `module.exports = ${JSON.stringify(q2026, null, 2)};\n`);
  console.log('Saved JS files to WeChat Mini Program (wechat-miniprogram/data/)!');
} else {
  console.warn('WeChat Mini Program data directory not found at', wechatDataDir);
}

// Validation Check
function validate(questions, label) {
  let errors = 0;
  for (const q of questions) {
    if (!q.stem) {
      console.error(`[${label}] Question ${q.id} has empty stem`);
      errors++;
    }
    if (q.type === 'mc') {
      if (!q.options || q.options.length < 2) {
        console.error(`[${label}] Question ${q.id} has insufficient options:`, q.options);
        errors++;
      }
      if (!['A', 'B', 'C', 'D'].includes(q.answer)) {
        console.error(`[${label}] Question ${q.id} has invalid MC answer: ${q.answer}`);
        errors++;
      }
    } else if (q.type === 'tf') {
      if (q.answer !== 'T' && q.answer !== 'F') {
        console.error(`[${label}] Question ${q.id} has invalid TF answer: ${q.answer}`);
        errors++;
      }
    }
    if (!q.explanation) {
      console.error(`[${label}] Question ${q.id} has empty explanation`);
      errors++;
    }
  }
  console.log(`[${label}] Validation complete. Errors found: ${errors}`);
}

validate(q2025, '2025');
validate(q2026, '2026');

