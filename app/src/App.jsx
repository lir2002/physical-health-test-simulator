import React, { useState, useEffect, useRef } from 'react';
import q2025Data from './data/questions-2025.json';
import q2026Data from './data/questions-2026.json';

// Fisher-Yates Shuffle
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function App() {
  // Views: 'dashboard', 'study-setup', 'study', 'exam-setup', 'exam', 'report-detail', 'history'
  const [view, setView] = useState('dashboard');
  
  // Voice engine state
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem('voice_enabled');
    return saved === 'true';
  });

  const [selectedVoice, setSelectedVoice] = useState(null);

  // Load voices and select preferred Chinese male voice
  useEffect(() => {
    const loadVoices = () => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      const allVoices = window.speechSynthesis.getVoices();
      const zhVoices = allVoices.filter(v => v.lang.toLowerCase().includes('zh'));
      
      if (zhVoices.length > 0) {
        // Preferred order: Yunxi (online natural), Kangkang (local Windows male), any male, fallback to first zh
        let voice = zhVoices.find(v => v.name.toLowerCase().includes('yunxi'));
        if (!voice) voice = zhVoices.find(v => v.name.toLowerCase().includes('kangkang'));
        if (!voice) voice = zhVoices.find(v => v.name.toLowerCase().includes('male'));
        if (!voice) voice = zhVoices[0];
        setSelectedVoice(voice);
      }
    };

    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);
  
  // History data
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('simulator_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Current session variables
  const [currentReport, setCurrentReport] = useState(null);
  
  // Voice utility
  const speakText = (text) => {
    if (!voiceEnabled) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.0;
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Speech synthesis failed", e);
    }
  };

  useEffect(() => {
    localStorage.setItem('voice_enabled', voiceEnabled);
    if (!voiceEnabled) {
      window.speechSynthesis.cancel(); // Stop reading immediately when toggled off
    }
  }, [voiceEnabled]);

  useEffect(() => {
    localStorage.setItem('simulator_history', JSON.stringify(history));
  }, [history]);

  // Clean speech when switching screens
  useEffect(() => {
    window.speechSynthesis.cancel();
  }, [view]);

  // ==========================================
  // STUDY MODE STATE
  // ==========================================
  const [studyPoolYear, setStudyPoolYear] = useState(2025); // 2025 or 2026
  const [studyQuestions, setStudyQuestions] = useState([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [studySelectedAnswer, setStudySelectedAnswer] = useState('');
  const [studyAnswered, setStudyAnswered] = useState(false);
  const [studyIsCorrect, setStudyIsCorrect] = useState(false);
  const [studyHistory, setStudyHistory] = useState([]); // Array of record
  const autoAdvanceTimer = useRef(null);

  const [studySecondsUsed, setStudySecondsUsed] = useState(0);
  const studyTimerRef = useRef(null);

  const [toastMsg, setToastMsg] = useState('');
  const [showExitStudyModal, setShowExitStudyModal] = useState(false);
  const [showDropProgressModal, setShowDropProgressModal] = useState(false);
  const [droppingYear, setDroppingYear] = useState(2025);
  const [exitTrigger, setExitTrigger] = useState('end-study'); // 'end-study' or 'return-home'
  const [trendTab, setTrendTab] = useState('study'); // 'study' or 'exam'
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Loaded saved study session 2025 if any
  const [savedStudy2025, setSavedStudy2025] = useState(() => {
    const saved = localStorage.getItem('saved_study_session_2025');
    return saved ? JSON.parse(saved) : null;
  });

  // Loaded saved study session 2026 if any
  const [savedStudy2026, setSavedStudy2026] = useState(() => {
    const saved = localStorage.getItem('saved_study_session_2026');
    return saved ? JSON.parse(saved) : null;
  });

  // Study Timer effect
  useEffect(() => {
    if (view === 'study' && !showExitStudyModal) {
      studyTimerRef.current = setInterval(() => {
        setStudySecondsUsed(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (studyTimerRef.current) clearInterval(studyTimerRef.current);
    };
  }, [view, showExitStudyModal]);

  const saveStudyProgress = (showToast = false) => {
    if (studyHistory.length === 0) {
      if (studyPoolYear === 2025) {
        localStorage.removeItem('saved_study_session_2025');
        setSavedStudy2025(null);
      } else {
        localStorage.removeItem('saved_study_session_2026');
        setSavedStudy2026(null);
      }
      return;
    }
    
    const session = {
      year: studyPoolYear,
      questions: studyQuestions,
      index: studyIndex,
      history: studyHistory,
      timeUsed: studySecondsUsed,
      lastExitTime: new Date().toLocaleString()
    };
    
    if (studyPoolYear === 2025) {
      localStorage.setItem('saved_study_session_2025', JSON.stringify(session));
      setSavedStudy2025(session);
    } else {
      localStorage.setItem('saved_study_session_2026', JSON.stringify(session));
      setSavedStudy2026(session);
    }
    
    if (showToast) {
      setToastMsg('学习进度已保存！');
      setTimeout(() => setToastMsg(''), 2000);
    }
  };

  const startStudy = (year) => {
    const saved = year === 2025 ? savedStudy2025 : savedStudy2026;
    if (saved) {
      const promptText = year === 2025 
        ? "已存在未完成的 2025 年学习进度。开始新的学习将清除该进度，确认要开始新的学习吗？" 
        : "已存在未完成的 2026 年预测题学习进度。开始新的学习将清除该进度，确认要开始新的学习吗？";
      if (!window.confirm(promptText)) {
        return;
      }
    }
    
    // Proceed to start fresh for this year
    if (year === 2025) {
      localStorage.removeItem('saved_study_session_2025');
      setSavedStudy2025(null);
    } else {
      localStorage.removeItem('saved_study_session_2026');
      setSavedStudy2026(null);
    }

    const rawPool = year === 2025 ? q2025Data : q2026Data;
    const shuffledPool = shuffle(rawPool);
    setStudyPoolYear(year);
    setStudyQuestions(shuffledPool);
    setStudyIndex(0);
    setStudySelectedAnswer('');
    setStudyAnswered(false);
    setStudyIsCorrect(false);
    setStudyHistory([]);
    setStudySecondsUsed(0);
    setView('study');
  };

  const resumeStudy = (year) => {
    const saved = year === 2025 ? savedStudy2025 : savedStudy2026;
    if (!saved) return;
    setStudyPoolYear(saved.year);
    setStudyQuestions(saved.questions);
    setStudyIndex(saved.index);
    setStudyHistory(saved.history);
    setStudySecondsUsed(saved.timeUsed || 0);
    
    const currentQ = saved.questions[saved.index];
    const record = saved.history.find(h => h.id === currentQ.id);
    if (record) {
      setStudySelectedAnswer(record.userAnswer);
      setStudyIsCorrect(record.correct);
      setStudyAnswered(true);
    } else {
      setStudySelectedAnswer('');
      setStudyAnswered(false);
      setStudyIsCorrect(false);
    }
    setView('study');
  };

  const handleStudyAnswer = (option) => {
    if (studyAnswered) return;
    const q = studyQuestions[studyIndex];
    const correct = option === q.answer;
    
    setStudySelectedAnswer(option);
    setStudyIsCorrect(correct);
    setStudyAnswered(true);

    const record = {
      id: q.id,
      stem: q.stem,
      type: q.type,
      year: q.year,
      options: q.options,
      correctAnswer: q.answer,
      userAnswer: option,
      correct,
      explanation: q.explanation
    };

    setStudyHistory(prev => [...prev, record]);

    if (correct) {
      // Auto advance in 3 seconds
      autoAdvanceTimer.current = setTimeout(() => {
        nextStudyQuestion();
      }, 3000);
    } else {
      // Speak explanation immediately
      speakText(q.explanation);
    }
  };

  const nextStudyQuestion = () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    if (studyIndex < studyQuestions.length - 1) {
      setStudyIndex(prev => prev + 1);
      setStudySelectedAnswer('');
      setStudyAnswered(false);
      setStudyIsCorrect(false);
    } else {
      finishStudy();
    }
  };

  const prevStudyQuestion = () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    if (studyIndex > 0) {
      const prevQ = studyQuestions[studyIndex - 1];
      const prevRecord = studyHistory.find(h => h.id === prevQ.id);
      
      setStudyIndex(prev => prev - 1);
      if (prevRecord) {
        setStudySelectedAnswer(prevRecord.userAnswer);
        setStudyIsCorrect(prevRecord.correct);
        setStudyAnswered(true);
      } else {
        setStudySelectedAnswer('');
        setStudyAnswered(false);
        setStudyIsCorrect(false);
      }
    }
  };

  const exitStudyWithReport = () => {
    setShowExitStudyModal(false);
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    window.speechSynthesis.cancel();
    
    // Clear saved progress for current year
    if (studyPoolYear === 2025) {
      localStorage.removeItem('saved_study_session_2025');
      setSavedStudy2025(null);
    } else {
      localStorage.removeItem('saved_study_session_2026');
      setSavedStudy2026(null);
    }

    if (studyHistory.length === 0) {
      setView('dashboard');
      return;
    }

    const correctCount = studyHistory.filter(h => h.correct).length;
    const wrongCount = studyHistory.length - correctCount;
    const accuracy = Math.round((correctCount / studyHistory.length) * 100);

    const studyCount = history.filter(h => h.type === 'study').length;
    const report = {
      id: 'report-' + Date.now(),
      type: 'study',
      title: `第 ${studyCount + 1} 次学习报告 (${studyPoolYear}年真题突破)`,
      date: new Date().toLocaleString(),
      total: studyHistory.length,
      correct: correctCount,
      wrong: wrongCount,
      accuracy,
      details: studyHistory,
      completed: false,
      timeUsed: studySecondsUsed
    };

    setHistory(prev => [report, ...prev]);
    setCurrentReport(report);
    setView('report-detail');
  };

  const exitStudyWithProgress = () => {
    setShowExitStudyModal(false);
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    window.speechSynthesis.cancel();
    saveStudyProgress();
    setView('dashboard');
  };

  const exitStudyDiscard = () => {
    setShowExitStudyModal(false);
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    window.speechSynthesis.cancel();
    
    // Clear progress for current year
    if (studyPoolYear === 2025) {
      localStorage.removeItem('saved_study_session_2025');
      setSavedStudy2025(null);
    } else {
      localStorage.removeItem('saved_study_session_2026');
      setSavedStudy2026(null);
    }
    
    setView('dashboard');
  };

  const dropProgressWithReport = () => {
    const saved = droppingYear === 2025 ? savedStudy2025 : savedStudy2026;
    if (!saved) return;
    
    const correctCount = saved.history.filter(h => h.correct).length;
    const wrongCount = saved.history.length - correctCount;
    const accuracy = Math.round((correctCount / saved.history.length) * 100);

    const studyCount = history.filter(h => h.type === 'study').length;
    const report = {
      id: 'report-' + Date.now(),
      type: 'study',
      title: `第 ${studyCount + 1} 次学习报告 (${saved.year}年真题突破)`,
      date: new Date().toLocaleString(),
      total: saved.history.length,
      correct: correctCount,
      wrong: wrongCount,
      accuracy,
      details: saved.history,
      completed: false,
      timeUsed: saved.timeUsed || 0
    };

    setHistory(prev => [report, ...prev]);
    
    if (droppingYear === 2025) {
      localStorage.removeItem('saved_study_session_2025');
      setSavedStudy2025(null);
    } else {
      localStorage.removeItem('saved_study_session_2026');
      setSavedStudy2026(null);
    }
    setShowDropProgressModal(false);
  };

  const dropProgressDiscard = () => {
    if (droppingYear === 2025) {
      localStorage.removeItem('saved_study_session_2025');
      setSavedStudy2025(null);
    } else {
      localStorage.removeItem('saved_study_session_2026');
      setSavedStudy2026(null);
    }
    setShowDropProgressModal(false);
  };

  const finishStudy = () => {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    window.speechSynthesis.cancel();
    
    // Clear saved progress for current year
    if (studyPoolYear === 2025) {
      localStorage.removeItem('saved_study_session_2025');
      setSavedStudy2025(null);
    } else {
      localStorage.removeItem('saved_study_session_2026');
      setSavedStudy2026(null);
    }
    
    if (studyHistory.length === 0) {
      setView('dashboard');
      return;
    }

    const correctCount = studyHistory.filter(h => h.correct).length;
    const wrongCount = studyHistory.length - correctCount;
    const accuracy = Math.round((correctCount / studyHistory.length) * 100);

    const studyCount = history.filter(h => h.type === 'study').length;
    const report = {
      id: 'report-' + Date.now(),
      type: 'study',
      title: `第 ${studyCount + 1} 次学习报告 (${studyPoolYear}年真题通关)`,
      date: new Date().toLocaleString(),
      total: studyHistory.length,
      correct: correctCount,
      wrong: wrongCount,
      accuracy,
      details: studyHistory,
      completed: true,
      timeUsed: studySecondsUsed
    };

    setHistory(prev => [report, ...prev]);
    setCurrentReport(report);
    setView('report-detail');
  };

  // ==========================================
  // EXAM MODE STATE
  // ==========================================
  const [examInclude2026, setExamInclude2026] = useState(false);
  const [examQuestions, setExamQuestions] = useState([]);
  const [examIndex, setExamIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState({}); // { [questionId]: selectedOption }
  const [examSecondsLeft, setExamSecondsLeft] = useState(1800); // 30 minutes
  const examTimerRef = useRef(null);

  const startExam = (include2026) => {
    // Collect pools
    let tfPool = q2025Data.filter(q => q.type === 'tf');
    let mcPool = q2025Data.filter(q => q.type === 'mc');

    if (include2026) {
      tfPool = [...tfPool, ...q2026Data.filter(q => q.type === 'tf')];
      mcPool = [...mcPool, ...q2026Data.filter(q => q.type === 'mc')];
    }

    // Sample 10 TF and 15 MC
    const sampledTF = shuffle(tfPool).slice(0, 10);
    const sampledMC = shuffle(mcPool).slice(0, 15);
    const fullExam = [...sampledTF, ...sampledMC]; // Total 25 questions

    setExamInclude2026(include2026);
    setExamQuestions(fullExam);
    setExamIndex(0);
    setExamAnswers({});
    setExamSecondsLeft(1800);
    setView('exam');
  };

  // Exam Countdown effect
  useEffect(() => {
    if (view === 'exam') {
      examTimerRef.current = setInterval(() => {
        setExamSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(examTimerRef.current);
            submitExam(true); // Auto-submit when time is up
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (examTimerRef.current) clearInterval(examTimerRef.current);
    };
  }, [view]);

  const handleExamAnswer = (option) => {
    const currentQ = examQuestions[examIndex];
    setExamAnswers(prev => ({
      ...prev,
      [currentQ.id]: option
    }));
  };

  const submitExam = (auto = false) => {
    if (examTimerRef.current) clearInterval(examTimerRef.current);

    // Calculate score
    const examDetails = examQuestions.map(q => {
      const userAnswer = examAnswers[q.id] || '';
      const correct = userAnswer === q.answer;
      return {
        id: q.id,
        stem: q.stem,
        type: q.type,
        year: q.year,
        options: q.options,
        correctAnswer: q.answer,
        userAnswer,
        correct,
        explanation: q.explanation
      };
    });

    const correctCount = examDetails.filter(d => d.correct).length;
    const wrongCount = examQuestions.length - correctCount;
    // Each question is 4 points, total 100 points
    const score = correctCount * 4;

    const examCount = history.filter(h => h.type === 'exam').length;
    const report = {
      id: 'report-' + Date.now(),
      type: 'exam',
      title: `第 ${examCount + 1} 次模拟考报告 (${examInclude2026 ? "2025+2026 混合" : "2025 全真"})`,
      date: new Date().toLocaleString(),
      total: examQuestions.length,
      correct: correctCount,
      wrong: wrongCount,
      accuracy: Math.round((correctCount / examQuestions.length) * 100),
      score,
      details: examDetails,
      timeUsed: 1800 - examSecondsLeft,
      completed: true,
      autoSubmitted: auto
    };

    setHistory(prev => [report, ...prev]);
    setCurrentReport(report);
    setView('report-detail');
  };

  // Helper to format remaining seconds into MM:SS (or HH:MM:SS if >= 1 hour)
  const formatTime = (seconds) => {
    if (seconds >= 3600) {
      const hrs = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Navigation for Report Review
  const [reviewIdx, setReviewIdx] = useState(0);

  // ==========================================
  // RENDER SECTIONS
  // ==========================================
  
  // Render Custom SVG Trend Chart
  const renderTrendChart = () => {
    const filteredHistory = history.filter(h => h.type === trendTab);

    if (filteredHistory.length < 2) {
      return (
        <div className="trend-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>📊 做题趋势分析</h2>
            <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
              <button
                className="btn"
                style={{
                  padding: '0.3rem 0.85rem',
                  fontSize: '0.85rem',
                  background: trendTab === 'study' ? 'var(--color-primary)' : 'transparent',
                  color: 'var(--text-bright)',
                  border: 'none',
                  boxShadow: 'none',
                  minWidth: '70px'
                }}
                onClick={() => setTrendTab('study')}
              >
                学习模式
              </button>
              <button
                className="btn"
                style={{
                  padding: '0.3rem 0.85rem',
                  fontSize: '0.85rem',
                  background: trendTab === 'exam' ? 'var(--color-accent)' : 'transparent',
                  color: 'var(--text-bright)',
                  border: 'none',
                  boxShadow: 'none',
                  minWidth: '70px'
                }}
                onClick={() => setTrendTab('exam')}
              >
                模拟考试
              </button>
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
            <p>📊 暂无足够历史数据，完成至少 2 次{trendTab === 'study' ? '智能学习' : '全真模拟考试'}以生成趋势图！</p>
          </div>
        </div>
      );
    }

    // Sort history chronologically (oldest first)
    const sortedHistory = [...filteredHistory].reverse();
    const dataPoints = sortedHistory.map((item, idx) => ({
      index: idx,
      value: item.type === 'exam' ? item.score : item.accuracy,
      date: item.date.split(' ')[0]
    }));

    const width = 600;
    const height = 200;
    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Map function
    const getX = (idx) => {
      if (dataPoints.length === 1) return paddingLeft + chartWidth / 2;
      return paddingLeft + (idx / (dataPoints.length - 1)) * chartWidth;
    };

    const getY = (val) => {
      return paddingTop + chartHeight - (val / 100) * chartHeight;
    };

    // Build SVG Path
    let dPath = '';
    dataPoints.forEach((pt, i) => {
      const x = getX(i);
      const y = getY(pt.value);
      if (i === 0) {
        dPath += `M ${x} ${y}`;
      } else {
        dPath += ` L ${x} ${y}`;
      }
    });

    return (
      <div className="trend-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>📊 做题趋势分析</h2>
          <div style={{ display: 'flex', gap: '0.25rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            <button
              className="btn"
              style={{
                padding: '0.3rem 0.85rem',
                fontSize: '0.85rem',
                background: trendTab === 'study' ? 'var(--color-primary)' : 'transparent',
                color: 'var(--text-bright)',
                border: 'none',
                boxShadow: 'none',
                minWidth: '70px'
              }}
              onClick={() => setTrendTab('study')}
            >
              学习模式
            </button>
            <button
              className="btn"
              style={{
                padding: '0.3rem 0.85rem',
                fontSize: '0.85rem',
                background: trendTab === 'exam' ? 'var(--color-accent)' : 'transparent',
                color: 'var(--text-bright)',
                border: 'none',
                boxShadow: 'none',
                minWidth: '70px'
              }}
              onClick={() => setTrendTab('exam')}
            >
              模拟考试
            </button>
          </div>
        </div>

        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          📈 {trendTab === 'study' ? '智能学习正确率趋势' : '模拟考试得分趋势'}
        </h3>

        <svg viewBox={`0 0 ${width} ${height}`} className="trend-svg">
          {/* Y Axis Grid lines */}
          {[0, 25, 50, 75, 100].map((val, idx) => {
            const y = getY(val);
            return (
              <g key={idx}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                <text x={paddingLeft - 8} y={y + 4} fill="var(--text-muted)" fontSize="10" textAnchor="end">
                  {trendTab === 'study' ? `${val}%` : `${val}分`}
                </text>
              </g>
            );
          })}

          {/* Line Path */}
          <path d={dPath} fill="none" stroke={`url(#${trendTab}Gradient)`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Dots */}
          {dataPoints.map((pt, i) => {
            const x = getX(i);
            const y = getY(pt.value);
            const dotColor = trendTab === 'exam' ? 'var(--color-accent)' : 'var(--color-primary)';
            return (
              <g key={i}>
                <circle 
                  cx={x} 
                  cy={y} 
                  r="5" 
                  fill={dotColor} 
                  stroke="var(--bg-primary)" 
                  strokeWidth="2" 
                  className="trend-dot"
                />
                <text x={x} y={height - 12} fill="var(--text-muted)" fontSize="9" textAnchor="middle" transform={`rotate(15, ${x}, ${height - 12})`}>
                  {pt.date}
                </text>
              </g>
            );
          })}

          {/* Gradient Definitions */}
          <defs>
            <linearGradient id="studyGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-secondary)" />
              <stop offset="100%" stopColor="var(--color-primary)" />
            </linearGradient>
            <linearGradient id="examGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--color-primary)" />
              <stop offset="100%" stopColor="var(--color-accent)" />
            </linearGradient>
          </defs>
        </svg>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center', fontSize: '0.8rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: trendTab === 'study' ? 'var(--color-primary)' : 'var(--color-muted)' }}></span> 学习模式
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: trendTab === 'exam' ? 'var(--color-accent)' : 'var(--color-muted)' }}></span> 模拟考试
          </span>
        </div>
      </div>
    );
  };
  const handleHeaderHomeClick = () => {
    if (view === 'study') {
      if (studyHistory.length === 0) {
        if (studyPoolYear === 2025) {
          localStorage.removeItem('saved_study_session_2025');
          setSavedStudy2025(null);
        } else {
          localStorage.removeItem('saved_study_session_2026');
          setSavedStudy2026(null);
        }
        setView('dashboard');
      } else {
        setExitTrigger('return-home');
        setShowExitStudyModal(true);
      }
    } else if (view === 'exam') {
      if (window.confirm("确定要退出考试吗？当前答题数据将丢弃。")) {
        setView('dashboard');
      }
    } else {
      setView('dashboard');
    }
  };

  return (
    <div className="app-container">
      {/* App Header */}
      <header className="app-header">
        <div className="logo" onClick={handleHeaderHomeClick}>
          <div className="logo-icon">PH</div>
          <div className="logo-text">
            <h3>体育与健康测试 <span className="title-gradient">智能模拟训练系统</span></h3>
          </div>
        </div>
        
        <div className="nav-actions">
          {/* Voice toggle in corner */}
          <div className="voice-switcher-container">
            <span className="voice-label">🔊 错题解读朗读</span>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={voiceEnabled} 
                onChange={(e) => setVoiceEnabled(e.target.checked)} 
              />
              <span className="slider"></span>
            </label>
          </div>
          
          {view !== 'dashboard' && (
            <button className="btn btn-secondary" onClick={handleHeaderHomeClick}>
              返回主页
            </button>
          )}
        </div>
      </header>

      {/* ========================================================
          DASHBOARD VIEW
          ======================================================== */}
      {view === 'dashboard' && (
        <div>
          {/* Saved Study Progress Banner 2025 */}
          {savedStudy2025 && (
            <div className="glass-panel" style={{ marginBottom: '1.5rem', border: '1px solid var(--color-primary)', background: 'rgba(99, 102, 241, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem', color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📝 发现未完成的 2025 年学习进度
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                    题库: 2025年真题突破 | 进度: 第 {savedStudy2025.index + 1} 题 / 共 {savedStudy2025.questions.length} 题 | 已答: {savedStudy2025.history.length} 题
                    {savedStudy2025.history.length > 0 && ` | 当前正确率: ${Math.round((savedStudy2025.history.filter(h => h.correct).length / savedStudy2025.history.length) * 100)}%`}
                    <br />
                    已学用时: <span style={{ color: 'var(--text-bright)', fontWeight: 500 }}>{formatTime(savedStudy2025.timeUsed || 0)}</span> | 上次退出时间: <span style={{ color: 'var(--text-bright)', fontWeight: 500 }}>{savedStudy2025.lastExitTime || '无'}</span>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn btn-primary" onClick={() => resumeStudy(2025)}>
                    继续学习
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setDroppingYear(2025);
                      setShowDropProgressModal(true);
                    }}
                  >
                    放弃进度
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Saved Study Progress Banner 2026 */}
          {savedStudy2026 && (
            <div className="glass-panel" style={{ marginBottom: '2rem', border: '1px solid var(--color-accent)', background: 'rgba(168, 85, 247, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem', color: 'var(--text-bright)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🎯 发现未完成的 2026 年预测题学习进度
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
                    题库: 2026年预测考题 | 进度: 第 {savedStudy2026.index + 1} 题 / 共 {savedStudy2026.questions.length} 题 | 已答: {savedStudy2026.history.length} 题
                    {savedStudy2026.history.length > 0 && ` | 当前正确率: ${Math.round((savedStudy2026.history.filter(h => h.correct).length / savedStudy2026.history.length) * 100)}%`}
                    <br />
                    已学用时: <span style={{ color: 'var(--text-bright)', fontWeight: 500 }}>{formatTime(savedStudy2026.timeUsed || 0)}</span> | 上次退出时间: <span style={{ color: 'var(--text-bright)', fontWeight: 500 }}>{savedStudy2026.lastExitTime || '无'}</span>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="btn btn-accent" onClick={() => resumeStudy(2026)}>
                    继续学习
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => {
                      setDroppingYear(2026);
                      setShowDropProgressModal(true);
                    }}
                  >
                    放弃进度
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Overview Hero Section */}
          <div className="glass-panel" style={{ marginBottom: '2.5rem', textAlign: 'center', background: 'linear-gradient(135deg, rgba(99,102,241,0.05) 0%, rgba(168,85,247,0.05) 100%)' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 800 }}>
              高效通关 <span className="title-gradient">体育健康考试</span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '650px', margin: '0 auto 2rem' }}>
              系统完整收录 2025 年体育中考理论考试真题及 2026 年最新大纲预测考题。支持随机智能学习、错题语音朗读、全真考场模拟及个人成长趋势报告。
            </p>
            
            {/* Quick stats grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', justifyContent: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '1rem 2rem', borderRadius: 'var(--radius-md)', minWidth: '150px' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                  {history.filter(h => h.type === 'study').length}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>累计学习场次</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '1rem 2rem', borderRadius: 'var(--radius-md)', minWidth: '150px' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-secondary)' }}>
                  {history.filter(h => h.type === 'study').length > 0 
                    ? Math.round(history.filter(h => h.type === 'study').reduce((acc, h) => acc + h.accuracy, 0) / history.filter(h => h.type === 'study').length) 
                    : 0}%
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>平均学习正确率</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '1rem 2rem', borderRadius: 'var(--radius-md)', minWidth: '150px' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-success)' }}>
                  {history.filter(h => h.type === 'exam').length}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>累计考试场次</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '1rem 2rem', borderRadius: 'var(--radius-md)', minWidth: '150px' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-success)' }}>
                  {history.filter(h => h.type === 'exam').length > 0 
                    ? Math.round(history.filter(h => h.type === 'exam').reduce((acc, h) => acc + (h.score || 0), 0) / history.filter(h => h.type === 'exam').length)
                    : 0}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>模拟考平均分</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '1rem 2rem', borderRadius: 'var(--radius-md)', minWidth: '150px' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                  {formatTime(history.filter(h => h.type === 'study').reduce((acc, h) => acc + (h.timeUsed || 0), 0))}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>累计学习用时</div>
              </div>
            </div>
          </div>

          {/* Action Modes Grid */}
          <div className="dashboard-grid">
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '2.5rem' }}>📚</span>
                  <span className="meta-pill meta-pill-accent">2025考题</span>
                </div>
                <h3 className="card-title">2025 理论真题突破</h3>
                <p className="card-desc">
                  专为 2025 年体育中考设计的完整真题库，包含 79 道判断题及 120 道单项选择题。支持随机抽题、智能判分与详细解读。
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => startStudy(2025)}>
                开始学习
              </button>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '2.5rem' }}>🎯</span>
                  <span className="meta-pill" style={{ background: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>2026预测</span>
                </div>
                <h3 className="card-title">2026 预测考题前瞻</h3>
                <p className="card-desc">
                  依据 2026 年最新中考大纲（包括深圳市体育中考新规、十五运会常识、应急救护与伤情防范）精心整理的 100 道前瞻试题。
                </p>
              </div>
              <button className="btn btn-accent" onClick={() => startStudy(2026)}>
                抢先研习
              </button>
            </div>

            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '2.5rem' }}>⏱️</span>
                  <span className="meta-pill" style={{ background: 'rgba(244,63,94,0.15)', color: '#fb7185' }}>全真限时</span>
                </div>
                <h3 className="card-title">全真模拟考试</h3>
                <p className="card-desc">
                  模拟考场真实环境：30分钟限时，随机抽取10道判断题与15道选择题。每题4分，满分100分。支持自由翻页检查，提交后提供详尽错题集 review。
                </p>
              </div>
              <button className="btn btn-primary" onClick={() => setView('exam-setup')} style={{ background: 'linear-gradient(135deg, var(--color-accent) 0%, #db2777 100%)', boxShadow: '0 4px 14px rgba(244,63,94,0.3)' }}>
                进入模拟考场
              </button>
            </div>
          </div>

          {/* Lower Section: Trend & History */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
            {/* Trend Report */}
            <div className="glass-panel">
              {renderTrendChart()}
            </div>

            {/* History list */}
            <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.5rem' }}>📜 历史记录</h2>
              </div>

              {history.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <input
                    type="text"
                    placeholder="🔍 搜索报告名称或日期..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 1rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-bright)',
                      outline: 'none',
                      fontSize: '0.9rem',
                      transition: 'all var(--transition-fast)'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
                  />
                </div>
              )}
              
              {history.length === 0 ? (
                <div style={{ textAlign: 'center', margin: 'auto 0', padding: '2rem 0', color: 'var(--text-muted)' }}>
                  <p>📭 暂无做题历史，快去挑战你的第一次练习吧！</p>
                </div>
              ) : (() => {
                const filtered = history.filter(h => {
                  const query = historySearchQuery.toLowerCase();
                  return h.title.toLowerCase().includes(query) || h.date.toLowerCase().includes(query);
                });
                
                if (filtered.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', margin: 'auto 0', padding: '2rem 0', color: 'var(--text-muted)' }}>
                      <p>🔍 没有找到匹配的做题记录</p>
                    </div>
                  );
                }

                return (
                  <div className="history-list">
                    {filtered.map((h) => {
                      const isExam = h.type === 'exam';
                      const badgeClass = isExam 
                        ? (h.score >= 80 ? 'history-score-success' : (h.score >= 60 ? 'history-score-warning' : 'history-score-error'))
                        : (h.accuracy >= 80 ? 'history-score-success' : (h.accuracy >= 60 ? 'history-score-warning' : 'history-score-error'));
                      
                      return (
                        <div key={h.id} className="history-item">
                          <div className="history-info">
                            <span className="history-type">
                              {isExam ? '📝 ' : '📖 '} {h.title}
                            </span>
                            <span className="history-date">{h.date}</span>
                          </div>
                          <div className={`history-score-badge ${badgeClass}`}>
                            {isExam ? `${h.score} 分` : `正确率 ${h.accuracy}%`}
                            <div style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '0.2rem' }}>
                              {isExam ? `错 ${h.wrong} / 答 ${h.total}` : `练习数 ${h.total}`}
                            </div>
                            {h.timeUsed !== undefined && (
                              <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.1rem' }}>
                                ⏱️ 用时: {formatTime(h.timeUsed)}
                              </div>
                            )}
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', marginTop: '0.5rem', width: '100%' }}
                              onClick={() => {
                                setCurrentReport(h);
                                setReviewIdx(0); // Reset review index on clicking report
                                setView('report-detail');
                              }}
                            >
                              查看报告
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          STUDY MODE
          ======================================================== */}
      {view === 'study' && studyQuestions.length > 0 && (
        <div className="glass-panel">
          <div className="question-container">
            {/* Header info */}
            <div className="question-meta">
              <div>
                <span className="meta-pill meta-pill-accent">
                  📖 {studyPoolYear === 2025 ? '2025年真题库' : '2026预测考题'}
                </span>
                <span className="meta-pill" style={{ marginLeft: '0.5rem' }}>
                  {studyQuestions[studyIndex].type === 'tf' ? '判断题' : '单项选择题'}
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {studyHistory.length > 0 && (
                  <span className="meta-pill" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                    🎯 当前正确率: {Math.round((studyHistory.filter(h => h.correct).length / studyHistory.length) * 100)}%
                  </span>
                )}
                <span className="meta-pill">
                  ⏱️ 已用时: {formatTime(studySecondsUsed)}
                </span>
                <span className="meta-pill">
                  进度: {studyIndex + 1} / {studyQuestions.length}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="progress-bar-bg">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${((studyIndex + 1) / studyQuestions.length) * 100}%` }}
              ></div>
            </div>

            {/* Question stem */}
            <div className="question-stem">
              {studyQuestions[studyIndex].stem}
            </div>

            {/* Answer buttons */}
            <div className="options-list">
              {studyQuestions[studyIndex].type === 'tf' ? (
                // True or False choices
                [
                  { key: 'T', val: '正确 (对)' },
                  { key: 'F', val: '错误 (错)' }
                ].map((opt) => {
                  const q = studyQuestions[studyIndex];
                  let btnClass = '';
                  
                  if (studyAnswered) {
                    if (opt.key === q.answer) {
                      btnClass = 'correct';
                    } else if (studySelectedAnswer === opt.key) {
                      btnClass = 'incorrect';
                    }
                    btnClass += ' disabled';
                  }

                  return (
                    <button 
                      key={opt.key}
                      className={`option-button ${btnClass}`}
                      onClick={() => handleStudyAnswer(opt.key)}
                      disabled={studyAnswered}
                    >
                      <div className="option-prefix">{opt.key === 'T' ? '√' : '×'}</div>
                      <div style={{ alignSelf: 'center' }}>{opt.val}</div>
                    </button>
                  );
                })
              ) : (
                // Multiple choices
                studyQuestions[studyIndex].options.map((optionText, idx) => {
                  const optionLetters = ['A', 'B', 'C', 'D'];
                  const letter = optionLetters[idx];
                  const q = studyQuestions[studyIndex];
                  let btnClass = '';

                  if (studyAnswered) {
                    if (letter === q.answer) {
                      btnClass = 'correct';
                    } else if (studySelectedAnswer === letter) {
                      btnClass = 'incorrect';
                    }
                    btnClass += ' disabled';
                  }

                  return (
                    <button
                      key={letter}
                      className={`option-button ${btnClass}`}
                      onClick={() => handleStudyAnswer(letter)}
                      disabled={studyAnswered}
                    >
                      <div className="option-prefix">{letter}</div>
                      <div style={{ alignSelf: 'center' }}>{optionText}</div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Immediate explanation if answered and wrong */}
            {studyAnswered && !studyIsCorrect && (
              <div className="explanation-panel">
                <div className="explanation-title">
                  💡 错题解析:
                </div>
                <div className="explanation-text">
                  {studyQuestions[studyIndex].explanation}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="section-nav-footer">
              <button 
                className="btn btn-secondary" 
                onClick={prevStudyQuestion}
                disabled={studyIndex === 0}
              >
                上一题
              </button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    if (studyHistory.length === 0) {
                      exitStudyDiscard();
                    } else {
                      exitStudyWithProgress();
                    }
                  }}
                >
                  💾 保存进度并退出
                </button>

                <button 
                  className="btn btn-secondary" 
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                  onClick={() => {
                    if (studyHistory.length === 0) {
                      exitStudyDiscard();
                    } else {
                      setExitTrigger('end-study');
                      setShowExitStudyModal(true);
                    }
                  }}
                >
                  结束学习并退出
                </button>
              </div>

              <button 
                className="btn btn-primary" 
                onClick={nextStudyQuestion}
                disabled={!studyAnswered} // Cannot move next unless answered
              >
                {studyIndex === studyQuestions.length - 1 ? '完成学习' : '下一题'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          EXAM SETUP VIEW
          ======================================================== */}
      {view === 'exam-setup' && (
        <div className="glass-panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '1.5rem', textAlign: 'center' }}>🎯 模拟考试设置</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', textAlign: 'center', lineHeight: '1.6' }}>
            根据体育考试标准：随机抽取 10 道判断题及 15 道单选题，每题 4 分，满分 100 分。时间限制 30 分钟。
          </p>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>选择考试题库范围：</h3>
            
            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1rem' 
              }}
            >
              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  cursor: 'pointer',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: !examInclude2026 ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                  border: `1px solid ${!examInclude2026 ? 'var(--color-primary)' : 'transparent'}`
                }}
                onClick={() => setExamInclude2026(false)}
              >
                <input 
                  type="radio" 
                  name="examPool" 
                  checked={!examInclude2026}
                  onChange={() => {}}
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-bright)' }}>2025年 理论真题库</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>只抽取 2025 年体育中考的真题题目。</div>
                </div>
              </label>

              <label 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem', 
                  cursor: 'pointer',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: examInclude2026 ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
                  border: `1px solid ${examInclude2026 ? 'var(--color-secondary)' : 'transparent'}`
                }}
                onClick={() => setExamInclude2026(true)}
              >
                <input 
                  type="radio" 
                  name="examPool" 
                  checked={examInclude2026}
                  onChange={() => {}}
                  style={{ accentColor: 'var(--color-secondary)' }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-bright)' }}>2025真题 + 2026预测混合题库</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>题库范围扩大，混合 2026 年最新大纲及政策预测考题。</div>
                </div>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setView('dashboard')}>
              取消
            </button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => startExam(examInclude2026)}>
              🏁 开始模拟考试
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          EXAM MODE
          ======================================================== */}
      {view === 'exam' && examQuestions.length > 0 && (
        <div className="glass-panel">
          {/* Exam Header */}
          <div className="question-meta" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <span className="meta-pill" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}>
                📝 模拟考场
              </span>
              <span className="meta-pill" style={{ marginLeft: '0.5rem' }}>
                当前: {examIndex + 1} / {examQuestions.length} ({examQuestions[examIndex].type === 'tf' ? '判断题' : '单项选择题'})
              </span>
            </div>
            
            {/* Timer countdown */}
            <div className={`timer-container ${
              examSecondsLeft > 300 
                ? 'timer-normal' 
                : (examSecondsLeft > 60 ? 'timer-warning' : 'timer-danger')
            }`}>
              ⏱️ 倒计时: {formatTime(examSecondsLeft)}
            </div>
          </div>

          {/* Progress bar */}
          <div className="progress-bar-bg">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${((Object.keys(examAnswers).length) / examQuestions.length) * 100}%` }}
            ></div>
          </div>

          {/* Question stem */}
          <div className="question-stem">
            {examQuestions[examIndex].stem}
          </div>

          {/* Option buttons */}
          <div className="options-list">
            {examQuestions[examIndex].type === 'tf' ? (
              // TF choices
              [
                { key: 'T', val: '正确 (对)' },
                { key: 'F', val: '错误 (错)' }
              ].map((opt) => {
                const isSelected = examAnswers[examQuestions[examIndex].id] === opt.key;
                return (
                  <button
                    key={opt.key}
                    className={`option-button ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleExamAnswer(opt.key)}
                  >
                    <div className="option-prefix">{opt.key === 'T' ? '√' : '×'}</div>
                    <div style={{ alignSelf: 'center' }}>{opt.val}</div>
                  </button>
                );
              })
            ) : (
              // MC choices
              examQuestions[examIndex].options.map((optionText, idx) => {
                const optionLetters = ['A', 'B', 'C', 'D'];
                const letter = optionLetters[idx];
                const isSelected = examAnswers[examQuestions[examIndex].id] === letter;
                
                return (
                  <button
                    key={letter}
                    className={`option-button ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleExamAnswer(letter)}
                  >
                    <div className="option-prefix">{letter}</div>
                    <div style={{ alignSelf: 'center' }}>{optionText}</div>
                  </button>
                );
              })
            )}
          </div>

          {/* Exam Grid Jumper / Reviewer */}
          <div style={{ margin: '2rem 0', padding: '1.5rem', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>答题卡分布 (点击可快速切换题目)：</h4>
            <div className="exam-review-grid" style={{ margin: 0 }}>
              {examQuestions.map((q, idx) => {
                const answered = examAnswers[q.id] !== undefined;
                return (
                  <div
                    key={q.id}
                    className={`review-cell ${answered ? 'correct' : 'skipped'} ${examIndex === idx ? 'active' : ''}`}
                    onClick={() => setExamIndex(idx)}
                    style={{
                      background: answered ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                      borderColor: answered ? 'var(--color-primary)' : 'var(--border-color)',
                      color: answered ? 'white' : 'var(--text-muted)'
                    }}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Exam Nav buttons */}
          <div className="section-nav-footer">
            <button 
              className="btn btn-secondary" 
              onClick={() => setExamIndex(prev => prev - 1)}
              disabled={examIndex === 0}
            >
              上一题
            </button>

            <button 
              className="btn btn-secondary" 
              style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
              onClick={() => {
                if (window.confirm("确定要提前结束考试并交卷吗？未答题目将记为错误。")) {
                  submitExam();
                }
              }}
            >
              提前交卷
            </button>

            {examIndex < examQuestions.length - 1 ? (
              <button 
                className="btn btn-primary" 
                onClick={() => setExamIndex(prev => prev + 1)}
              >
                下一题
              </button>
            ) : (
              <button 
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, var(--color-success) 0%, #059669 100%)', boxShadow: '0 4px 14px rgba(16,185,129,0.3)' }}
                onClick={() => {
                  if (window.confirm("确认要提交试卷吗？")) {
                    submitExam();
                  }
                }}
              >
                提交试卷
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          REPORT DETAIL VIEW
          ======================================================== */}
      {view === 'report-detail' && currentReport && (
        <div className="glass-panel">
          <h2 style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '0.5rem' }}>
            🎉 {currentReport.title}
          </h2>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
            提交时间: {currentReport.date}
          </div>

          {/* Stats overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
            {currentReport.score !== undefined && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: currentReport.score >= 80 ? 'var(--color-success)' : (currentReport.score >= 60 ? 'var(--color-warning)' : 'var(--color-error)') }}>
                  {currentReport.score} <span style={{ fontSize: '1rem', fontWeight: 500 }}>分</span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>考试得分 (满分100)</div>
              </div>
            )}

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>
                {currentReport.accuracy}%
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>答题正确率</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-success)' }}>
                {currentReport.correct}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>正确题数</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-error)' }}>
                {currentReport.wrong}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>错误题数</div>
            </div>

            {currentReport.timeUsed !== undefined && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '1.5rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-secondary)' }}>
                  {formatTime(currentReport.timeUsed)}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>本次练习用时</div>
              </div>
            )}
          </div>

          {/* Grid display of Correct / Wrong questions */}
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '1.5rem', marginBottom: '2.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-bright)' }}>
              🎯 题目对错速览表 (点击题号查看详细解析)：
            </h3>
            
            <div className="exam-review-grid">
              {currentReport.details.map((q, idx) => {
                const statusClass = q.correct ? 'correct' : 'incorrect';
                return (
                  <div
                    key={q.id}
                    className={`review-cell ${statusClass} ${reviewIdx === idx ? 'active' : ''}`}
                    onClick={() => {
                      setReviewIdx(idx);
                      // Trigger speech readout of description automatically if voice switch is enabled
                      speakText(q.explanation);
                    }}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected question review panel */}
          {currentReport.details.length > 0 && (
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '2rem', marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <span className="meta-pill meta-pill-accent">
                  题号: {reviewIdx + 1} ({currentReport.details[reviewIdx].type === 'tf' ? '判断题' : '选择题'})
                </span>
                
                <span className="meta-pill" style={{ 
                  background: currentReport.details[reviewIdx].correct ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                  color: currentReport.details[reviewIdx].correct ? 'var(--color-success)' : 'var(--color-error)'
                }}>
                  {currentReport.details[reviewIdx].correct ? '✓ 回答正确' : '✗ 回答错误'}
                </span>
              </div>

              <div className="question-stem" style={{ fontSize: '1.15rem' }}>
                {currentReport.details[reviewIdx].stem}
              </div>

              {/* Show selected option vs correct option */}
              <div className="options-list" style={{ pointerEvents: 'none' }}>
                {currentReport.details[reviewIdx].type === 'tf' ? (
                  // TF option visual
                  [
                    { key: 'T', val: '正确 (对)' },
                    { key: 'F', val: '错误 (错)' }
                  ].map((opt) => {
                    const isCorrectChoice = opt.key === currentReport.details[reviewIdx].correctAnswer;
                    const isUserChoice = opt.key === currentReport.details[reviewIdx].userAnswer;
                    
                    let btnClass = '';
                    if (isCorrectChoice) btnClass = 'correct';
                    else if (isUserChoice) btnClass = 'incorrect';

                    return (
                      <button key={opt.key} className={`option-button ${btnClass}`}>
                        <div className="option-prefix">{opt.key === 'T' ? '√' : '×'}</div>
                        <div>{opt.val}</div>
                      </button>
                    );
                  })
                ) : (
                  // MC option visual
                  currentReport.details[reviewIdx].options.map((optionText, idx) => {
                    const optionLetters = ['A', 'B', 'C', 'D'];
                    const letter = optionLetters[idx];
                    const isCorrectChoice = letter === currentReport.details[reviewIdx].correctAnswer;
                    const isUserChoice = letter === currentReport.details[reviewIdx].userAnswer;
                    
                    let btnClass = '';
                    if (isCorrectChoice) btnClass = 'correct';
                    else if (isUserChoice) btnClass = 'incorrect';

                    return (
                      <button key={letter} className={`option-button ${btnClass}`}>
                        <div className="option-prefix">{letter}</div>
                        <div>{optionText}</div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Detailed explanation */}
              <div className="explanation-panel" style={{ borderLeftColor: 'var(--color-primary)', margin: 0 }}>
                <div className="explanation-title" style={{ color: 'var(--color-primary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>💡 科学解读:</span>
                  {voiceEnabled && (
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.1rem 0.5rem', fontSize: '0.7rem' }} 
                      onClick={() => speakText(currentReport.details[reviewIdx].explanation)}
                    >
                      🔊 重新播放朗读
                    </button>
                  )}
                </div>
                <div className="explanation-text">
                  {currentReport.details[reviewIdx].explanation}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => setView('dashboard')}>
              返回仪表盘主页
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification Popup */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(99, 102, 241, 0.95)',
          border: '1px solid var(--border-hover)',
          color: 'white',
          padding: '0.85rem 1.75rem',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
          fontSize: '0.95rem',
          fontWeight: 600,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          animation: 'slideDown 0.2s ease-out',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          💾 {toastMsg}
        </div>
      )}

      {/* Exit Study Session Confirmation Modal */}
      {showExitStudyModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontSize: '1.5rem' }}>{exitTrigger === 'return-home' ? '🏠' : '🚪'}</span>
              <h3 style={{ fontSize: '1.25rem' }}>{exitTrigger === 'return-home' ? '返回主页' : '结束当前学习'}</h3>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
              您当前已回答 <strong>{studyHistory.length}</strong> 道题目，其中正确 <strong>{studyHistory.filter(h => h.correct).length}</strong> 道。请选择您想要进行的操作：
            </p>
            
            <div className="modal-options-list">
              {exitTrigger === 'return-home' && (
                <div className="modal-option-card" onClick={exitStudyWithProgress}>
                  <div className="modal-option-title">💾 暂存当前进度并返回主页</div>
                  <div className="modal-option-desc">
                    暂存当前的答题进度、已用时间，下次在主页可随时继续学习。
                  </div>
                </div>
              )}

              <div className="modal-option-card" onClick={exitStudyWithReport}>
                <div className="modal-option-title">📊 生成答题报告并退出</div>
                <div className="modal-option-desc">
                  保存当前的答题对错数据，并在主页的“历史记录”中生成一份归档报告（可查看错题解析）。
                </div>
              </div>
              
              <div className="modal-option-card" style={{ borderLeft: '3px solid var(--color-error)' }} onClick={exitStudyDiscard}>
                <div className="modal-option-title" style={{ color: 'var(--color-error)' }}>❌ 不保存直接退出</div>
                <div className="modal-option-desc">
                  不保存学习进度，也不生成历史记录报告。本次学习数据将全部清除。
                </div>
              </div>
            </div>
            
            <button 
              className="btn btn-secondary" 
              style={{ marginTop: '0.5rem', width: '100%' }}
              onClick={() => setShowExitStudyModal(false)}
            >
              继续答题
            </button>
          </div>
        </div>
      )}

      {/* Drop Saved Progress Confirmation Modal */}
      {showDropProgressModal && (droppingYear === 2025 ? savedStudy2025 : savedStudy2026) && (() => {
        const activeSaved = droppingYear === 2025 ? savedStudy2025 : savedStudy2026;
        return (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <span style={{ fontSize: '1.5rem' }}>🗑️</span>
                <h3 style={{ fontSize: '1.25rem' }}>放弃当前学习进度 ({droppingYear}年)</h3>
              </div>
              
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
                放弃当前学习进度后，您将无法恢复它。该进度包含 <strong>{activeSaved.history.length}</strong> 道已解答题目。您想在删除进度前保存当前的答题历史报告吗？
              </p>
              
              <div className="modal-options-list">
                <div className="modal-option-card" onClick={dropProgressWithReport}>
                  <div className="modal-option-title">📊 保存历史报告并清除进度</div>
                  <div className="modal-option-desc">
                    保存当前答题记录作为一份归档报告（可在主页的历史记录中查看），然后清除该未完成进度。
                  </div>
                </div>
                
                <div className="modal-option-card" style={{ borderLeft: '3px solid var(--color-error)' }} onClick={dropProgressDiscard}>
                  <div className="modal-option-title" style={{ color: 'var(--color-error)' }}>🗑️ 直接清除，不保存报告</div>
                  <div className="modal-option-desc">
                    直接清除此学习进度，不生成任何历史档案。本次学习数据将全部丢失。
                  </div>
                </div>
              </div>
              
              <button 
                className="btn btn-secondary" 
                style={{ marginTop: '0.5rem', width: '100%' }}
                onClick={() => setShowDropProgressModal(false)}
              >
                取消
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
