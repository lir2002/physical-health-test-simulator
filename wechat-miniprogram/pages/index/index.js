// pages/index/index.js
const questions2025 = require('../../data/questions-2025.js');
const questions2026 = require('../../data/questions-2026.js');

Page({
  data: {
    // Current active view: 'dashboard', 'study-setup', 'study', 'exam-setup', 'exam', 'report-detail'
    view: 'dashboard',
    
    // History & Sessions
    history: [],
    savedStudy2025: null,
    savedStudy2026: null,
    searchQuery: '',
    
    // Navigation / Modal States
    showDropConfirmModal: false,
    droppingYear: null,
    showExitStudyModal: false,
    exitTrigger: '',
    
    // Study Mode States
    studyPoolYear: 2025,
    studyQuestions: [],
    studyIndex: 0,
    studyHistory: [],
    studySecondsUsed: 0,
    studyAnswered: false,
    studySelectedAnswer: '',
    studyIsCorrect: false,
    studyCorrectnessRate: 0,
    
    // Exam Mode States
    examPoolYear: 2025,
    examQuestions: [],
    examIndex: 0,
    examAnswers: {}, // key: questionId, value: userOption
    examAnsweredCount: 0,
    examTimeRemaining: 1800, // 30 mins
    reviewIdx: 0,
    
    // Report detail view state
    currentReport: null,
    
    // Dashboard chart tab: 'study' or 'exam'
    chartTab: 'study',
    
    // General utils / toast
    toastMsg: '',
    
    // Custom formatted timers
    formattedStudyTime: '00:00',
    formattedExamTime: '30:00',
    
    // Constant letters for multiple choice
    option_letters: ['A', 'B', 'C', 'D'],
    
    // Computed states
    formattedSavedTime2025: '00:00',
    savedStudy2025_correctness: 0,
    formattedSavedTime2026: '00:00',
    savedStudy2026_correctness: 0,
    stat_totalStudyTime: '00:00',
    stat_studyAccuracy: 0,
    stat_totalStudySessions: 0,
    stat_totalExamSessions: 0,
    stat_avgExamScore: 0,
    filteredHistory: [],
    studyHistory_correctCount: 0,
    voiceEnabled: false,
    showPageContainer: false
  },

  // Timers
  studyTimerInterval: null,
  examTimerInterval: null,
  autoAdvanceTimeout: null,

  onLoad: function () {
    this.loadDataFromStorage();
  },

  onUnload: function () {
    this.clearAllTimers();
    this.cancelSpeech();
  },

  onHide: function () {
    this.clearAllTimers();
    this.cancelSpeech();
  },

  onShow: function() {
    this.loadDataFromStorage();
    if (this.data.view === 'dashboard') {
      setTimeout(() => this.drawTrendChart(), 100);
    }
  },

  // ----------------------------------------------------------------
  // DATA AND CACHING
  // ----------------------------------------------------------------
  loadDataFromStorage: function(callback) {
    try {
      const history = wx.getStorageSync('simulator_history') || [];
      const saved2025 = wx.getStorageSync('saved_study_session_2025') || null;
      const saved2026 = wx.getStorageSync('saved_study_session_2026') || null;
      const voiceEnabled = wx.getStorageSync('voice_enabled') || false;
      
      this.setData({
        history: history,
        savedStudy2025: saved2025,
        savedStudy2026: saved2026,
        voiceEnabled: voiceEnabled
      }, () => {
        this.updateComputedData();
        if (typeof callback === 'function') {
          callback();
        }
      });
    } catch(e) {
      console.error('Failed to load storage data', e);
      if (typeof callback === 'function') {
        callback();
      }
    }
  },

  saveHistoryToStorage: function(newHistory) {
    try {
      wx.setStorageSync('simulator_history', newHistory);
      this.setData({ history: newHistory }, () => {
        this.updateComputedData();
      });
    } catch (e) {
      console.error('Failed to save history', e);
    }
  },

  updateComputedData: function() {
    const history = this.data.history || [];
    const saved2025 = this.data.savedStudy2025;
    const saved2026 = this.data.savedStudy2026;
    const query = (this.data.searchQuery || '').trim().toLowerCase();
    
    // 1. Session correctness and times
    let formattedSavedTime2025 = '00:00';
    let savedStudy2025_correctness = 0;
    let savedStudy2025_exitTime = '无';
    if (saved2025) {
      formattedSavedTime2025 = this.formatTimeDisplay(saved2025.timeUsed || 0);
      if (saved2025.history && saved2025.history.length > 0) {
        const corrects = saved2025.history.filter(h => h.correct).length;
        savedStudy2025_correctness = Math.round((corrects / saved2025.history.length) * 100);
      }
      if (saved2025.lastModified) {
        savedStudy2025_exitTime = this.formatTimestamp(saved2025.lastModified);
      }
    }
    
    let formattedSavedTime2026 = '00:00';
    let savedStudy2026_correctness = 0;
    let savedStudy2026_exitTime = '无';
    if (saved2026) {
      formattedSavedTime2026 = this.formatTimeDisplay(saved2026.timeUsed || 0);
      if (saved2026.history && saved2026.history.length > 0) {
        const corrects = saved2026.history.filter(h => h.correct).length;
        savedStudy2026_correctness = Math.round((corrects / saved2026.history.length) * 100);
      }
      if (saved2026.lastModified) {
        savedStudy2026_exitTime = this.formatTimestamp(saved2026.lastModified);
      }
    }
    
    // 2. Dashboard Stats Card Metrics
    const studyRecords = history.filter(h => h.type === 'study');
    const examRecords = history.filter(h => h.type === 'exam');
    
    // 累计学习用时 (Study only)
    const totalStudySeconds = studyRecords.reduce((acc, r) => acc + (r.timeUsed || 0), 0);
    const stat_totalStudyTime = this.formatTimeDisplay(totalStudySeconds);
    
    // 平均学习正确率 (Study only)
    let stat_studyAccuracy = 0;
    if (studyRecords.length > 0) {
      const avgAcc = studyRecords.reduce((acc, r) => acc + (r.accuracy || 0), 0);
      stat_studyAccuracy = Math.round(avgAcc / studyRecords.length);
    }
    
    // 累计学习场次
    const stat_totalStudySessions = studyRecords.length;
    
    // 累计模拟考试
    const stat_totalExamSessions = examRecords.length;
    
    // 模拟考平均分
    let stat_avgExamScore = 0;
    if (examRecords.length > 0) {
      const totalScore = examRecords.reduce((acc, r) => acc + (r.score !== undefined ? r.score : 0), 0);
      stat_avgExamScore = Math.round(totalScore / examRecords.length);
    }
    
    // 3. Filtered History List
    const filtered = history
      .filter(item => {
        if (!query) return true;
        const titleMatch = (item.title || '').toLowerCase().includes(query);
        const dateMatch = (item.date || '').toLowerCase().includes(query);
        return titleMatch || dateMatch;
      })
      .map(item => {
        return {
          ...item,
          formattedTime: this.formatTimeDisplay(item.timeUsed || 0)
        };
      });
      
    // 4. Study history correct count
    const studyHistory_correctCount = this.data.studyHistory.filter(h => h.correct).length;
    
    this.setData({
      formattedSavedTime2025,
      savedStudy2025_correctness,
      savedStudy2025_exitTime,
      formattedSavedTime2026,
      savedStudy2026_correctness,
      savedStudy2026_exitTime,
      stat_totalStudyTime,
      stat_studyAccuracy,
      stat_totalStudySessions,
      stat_totalExamSessions,
      stat_avgExamScore,
      filteredHistory: filtered,
      studyHistory_correctCount
    });
  },

  // ----------------------------------------------------------------
  // TOAST HANDLER
  // ----------------------------------------------------------------
  showToast: function(msg) {
    this.setData({ toastMsg: msg });
    setTimeout(() => {
      this.setData({ toastMsg: '' });
    }, 3000);
  },

  // ----------------------------------------------------------------
  // NAVIGATION & VIEW SWITCHING
  // ----------------------------------------------------------------
  switchView: function(e) {
    const targetView = e.currentTarget.dataset.view;
    this.clearAllTimers();
    
    this.setData({ 
      view: targetView,
      showPageContainer: targetView !== 'dashboard'
    });
    
    if (targetView === 'dashboard') {
      this.loadDataFromStorage();
      setTimeout(() => this.drawTrendChart(), 100);
    }
  },

  handleHeaderHomeClick: function() {
    if (this.data.view === 'study') {
      if (this.data.studyHistory.length === 0) {
        // Direct exit for 0-answer session
        if (this.data.studyPoolYear === 2025) {
          wx.removeStorageSync('saved_study_session_2025');
        } else {
          wx.removeStorageSync('saved_study_session_2026');
        }
        this.loadDataFromStorage(() => {
          this.setData({ 
            view: 'dashboard',
            showPageContainer: false
          });
          setTimeout(() => this.drawTrendChart(), 100);
        });
      } else {
        // Show pause prompt
        this.setData({
          exitTrigger: 'return-home',
          showExitStudyModal: true,
          showPageContainer: true
        });
        this.pauseStudyTimer();
      }
    } else if (this.data.view === 'exam') {
      // Exiting active exam defaults to submit prompt, but let's just ask to submit or discard
      wx.showModal({
        title: '退出确认',
        content: '退出当前考试将不会保存任何考试记录，确认退出吗？',
        cancelText: '继续考试',
        confirmText: '确认退出',
        success: (res) => {
          if (res.confirm) {
            this.setData({ 
              view: 'dashboard',
              showPageContainer: false
            });
            setTimeout(() => this.drawTrendChart(), 100);
          }
        }
      });
    } else {
      this.setData({ 
        view: 'dashboard',
        showPageContainer: false
      });
      setTimeout(() => this.drawTrendChart(), 100);
    }
  },

  // ----------------------------------------------------------------
  // STUDY SETUP AND LIFE-CYCLE
  // ----------------------------------------------------------------
  selectStudyYear: function(e) {
    const year = parseInt(e.currentTarget.dataset.year);
    this.setData({ studyPoolYear: year });
  },

  startNewStudy: function() {
    const year = this.data.studyPoolYear;
    const saved = year === 2025 ? this.data.savedStudy2025 : this.data.savedStudy2026;
    
    if (saved) {
      wx.showModal({
        title: '温馨提示',
        content: `检测到您有未完成的 ${year} 年练习进度，是否继续上次练习？`,
        cancelText: '重新开始',
        confirmText: '继续上次',
        success: (res) => {
          if (res.confirm) {
            this.resumeStudy(year);
          } else if (res.cancel) {
            // Confirm start new study and discard previous
            wx.showModal({
              title: '确认重置',
              content: '开始新练习将覆盖并清除您当前的保存进度，确认开始新练习吗？',
              success: (confirmRes) => {
                if (confirmRes.confirm) {
                  this.executeStartNewStudy();
                }
              }
            });
          }
        }
      });
    } else {
      this.executeStartNewStudy();
    }
  },

  executeStartNewStudy: function() {
    const year = this.data.studyPoolYear;
    const questions = year === 2025 ? questions2025 : questions2026;
    
    // Shuffle helper
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    
    this.setData({
      view: 'study',
      showPageContainer: true,
      studyQuestions: shuffled,
      studyIndex: 0,
      studyHistory: [],
      studySecondsUsed: 0,
      studyAnswered: false,
      studySelectedAnswer: '',
      studyIsCorrect: false,
      studyCorrectnessRate: 0
    });
    
    this.startStudyTimer();
  },

  resumeStudy: function(e) {
    let year;
    if (e && typeof e === 'object' && e.currentTarget) {
      year = parseInt(e.currentTarget.dataset.year);
    } else {
      year = parseInt(e);
    }
    const saved = year === 2025 ? this.data.savedStudy2025 : this.data.savedStudy2026;
    
    if (!saved) return;
    
    this.setData({
      view: 'study',
      showPageContainer: true,
      studyPoolYear: saved.year,
      studyQuestions: saved.questions,
      studyIndex: saved.index,
      studyHistory: saved.history,
      studySecondsUsed: saved.timeUsed || 0
    });
    
    // Restore states for current question if already answered
    const currentQ = saved.questions[saved.index];
    const record = saved.history.find(h => h.id === currentQ.id);
    if (record) {
      this.setData({
        studySelectedAnswer: record.userAnswer,
        studyIsCorrect: record.correct,
        studyAnswered: true
      });
    } else {
      this.setData({
        studySelectedAnswer: '',
        studyAnswered: false,
        studyIsCorrect: false
      });
    }
    
    // Recalculate correctness rate
    this.updateStudyCorrectnessRate();
    this.startStudyTimer();
  },

  confirmDropStudy: function(e) {
    const year = parseInt(e.currentTarget.dataset.year);
    this.setData({
      droppingYear: year,
      showDropConfirmModal: true,
      showPageContainer: true
    });
  },

  cancelDrop: function() {
    this.setData({
      showDropConfirmModal: false,
      droppingYear: null,
      showPageContainer: this.data.view !== 'dashboard'
    });
  },

  executeDrop: function(e) {
    const archive = e.currentTarget.dataset.archive === 'true';
    const year = this.data.droppingYear;
    const saved = year === 2025 ? this.data.savedStudy2025 : this.data.savedStudy2026;
    
    if (saved && archive && saved.history.length > 0) {
      // Archive session as a report
      const correctCount = saved.history.filter(h => h.correct).length;
      const wrongCount = saved.history.length - correctCount;
      const accuracy = Math.round((correctCount / saved.history.length) * 100);
      
      const newReport = {
        id: 'study-report-' + Date.now(),
        type: 'study',
        year: year,
        date: this.getFormattedDate(),
        total: saved.history.length,
        correct: correctCount,
        wrong: wrongCount,
        accuracy: accuracy,
        timeUsed: saved.timeUsed || 0,
        details: saved.history,
        archived: true
      };
      
      // Chronological title count
      const studyReportsCount = this.data.history.filter(h => h.type === 'study').length;
      newReport.title = `第${studyReportsCount + 1}次学习报告 (${year}年真题突破)`;
      
      const updatedHistory = [newReport, ...this.data.history];
      wx.setStorageSync('simulator_history', updatedHistory);
      this.showToast('练习进度已归档至历史记录');
    }
    
    // Delete session
    if (year === 2025) {
      wx.removeStorageSync('saved_study_session_2025');
    } else {
      wx.removeStorageSync('saved_study_session_2026');
    }
    
    this.loadDataFromStorage(() => {
      this.setData({
        showDropConfirmModal: false,
        droppingYear: null,
        showPageContainer: false
      });
      this.showToast('已放弃该学习进度');
      setTimeout(() => this.drawTrendChart(), 100);
    });
  },

  // ----------------------------------------------------------------
  // STUDY RUNTIME LOGIC
  // ----------------------------------------------------------------
  handleStudyAnswer: function(e) {
    if (this.data.studyAnswered) return;
    const option = e.currentTarget.dataset.option;
    const q = this.data.studyQuestions[this.data.studyIndex];
    const correct = option === q.answer;
    
    this.setData({
      studySelectedAnswer: option,
      studyIsCorrect: correct,
      studyAnswered: true
    });
    
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
    
    const updatedHistory = [...this.data.studyHistory, record];
    this.setData({ studyHistory: updatedHistory }, () => {
      this.updateStudyCorrectnessRate();
    });
    
    // Play tone feedback immediately if voice/sound toggle is active
    this.playStudyFeedbackSound(correct);
    
    if (correct) {
      this.autoAdvanceTimeout = setTimeout(() => {
        this.nextStudyQuestion();
      }, 3000);
    } else {
      setTimeout(() => {
        this.playVoice(q.explanation);
      }, 450);
    }
  },

  nextStudyQuestion: function() {
    this.clearAutoAdvance();
    this.cancelSpeech();
    if (this.data.studyIndex < this.data.studyQuestions.length - 1) {
      const nextIdx = this.data.studyIndex + 1;
      this.setData({
        studyIndex: nextIdx,
        studySelectedAnswer: '',
        studyAnswered: false,
        studyIsCorrect: false
      });
      
      // Load previous answers if returning to answered ones
      const nextQ = this.data.studyQuestions[nextIdx];
      const prevRecord = this.data.studyHistory.find(h => h.id === nextQ.id);
      if (prevRecord) {
        this.setData({
          studySelectedAnswer: prevRecord.userAnswer,
          studyAnswered: true,
          studyIsCorrect: prevRecord.correct
        });
      }
    } else {
      this.finishStudy();
    }
  },

  prevStudyQuestion: function() {
    this.clearAutoAdvance();
    this.cancelSpeech();
    if (this.data.studyIndex > 0) {
      const prevIdx = this.data.studyIndex - 1;
      const prevQ = this.data.studyQuestions[prevIdx];
      const prevRecord = this.data.studyHistory.find(h => h.id === prevQ.id);
      
      this.setData({
        studyIndex: prevIdx,
        studySelectedAnswer: prevRecord ? prevRecord.userAnswer : '',
        studyAnswered: prevRecord ? true : false,
        studyIsCorrect: prevRecord ? prevRecord.correct : false
      });
    }
  },

  updateStudyCorrectnessRate: function() {
    const total = this.data.studyHistory.length;
    if (total === 0) {
      this.setData({ studyCorrectnessRate: 0 });
      return;
    }
    const corrects = this.data.studyHistory.filter(h => h.correct).length;
    const rate = Math.round((corrects / total) * 100);
    this.setData({ studyCorrectnessRate: rate });
  },

  saveAndExitStudy: function() {
    this.clearAllTimers();
    
    const session = {
      year: this.data.studyPoolYear,
      questions: this.data.studyQuestions,
      index: this.data.studyIndex,
      history: this.data.studyHistory,
      timeUsed: this.data.studySecondsUsed,
      lastModified: Date.now()
    };
    
    if (this.data.studyPoolYear === 2025) {
      wx.setStorageSync('saved_study_session_2025', session);
    } else {
      wx.setStorageSync('saved_study_session_2026', session);
    }
    
    this.loadDataFromStorage(() => {
      this.setData({
        view: 'dashboard',
        showExitStudyModal: false,
        showPageContainer: false
      });
      this.showToast('学习进度已保存');
      setTimeout(() => this.drawTrendChart(), 100);
    });
  },

  discardAndExitStudy: function() {
    this.clearAllTimers();
    
    if (this.data.studyPoolYear === 2025) {
      wx.removeStorageSync('saved_study_session_2025');
    } else {
      wx.removeStorageSync('saved_study_session_2026');
    }
    
    this.loadDataFromStorage(() => {
      this.setData({
        view: 'dashboard',
        showExitStudyModal: false,
        showPageContainer: false
      });
      this.showToast('已放弃当前修改');
      setTimeout(() => this.drawTrendChart(), 100);
    });
  },

  generateReportAndExitStudy: function() {
    this.clearAllTimers();
    
    if (this.data.studyHistory.length === 0) {
      this.discardAndExitStudy();
      return;
    }
    
    const correctCount = this.data.studyHistory.filter(h => h.correct).length;
    const wrongCount = this.data.studyHistory.length - correctCount;
    const accuracy = Math.round((correctCount / this.data.studyHistory.length) * 100);
    
    const newReport = {
      id: 'study-report-' + Date.now(),
      type: 'study',
      year: this.data.studyPoolYear,
      date: this.getFormattedDate(),
      total: this.data.studyHistory.length,
      correct: correctCount,
      wrong: wrongCount,
      accuracy: accuracy,
      timeUsed: this.data.studySecondsUsed,
      details: this.data.studyHistory
    };
    
    // Chronological title count
    const studyReportsCount = this.data.history.filter(h => h.type === 'study').length;
    newReport.title = `第${studyReportsCount + 1}次学习报告 (${this.data.studyPoolYear}年真题突破)`;
    
    const updatedHistory = [newReport, ...this.data.history];
    wx.setStorageSync('simulator_history', updatedHistory);
    
    // Clean saved session
    if (this.data.studyPoolYear === 2025) {
      wx.removeStorageSync('saved_study_session_2025');
    } else {
      wx.removeStorageSync('saved_study_session_2026');
    }
    
    this.loadDataFromStorage(() => {
      this.setData({
        view: 'dashboard',
        showExitStudyModal: false,
        showPageContainer: false
      });
      this.showToast('学习进度已生成报告');
      setTimeout(() => this.drawTrendChart(), 100);
    });
  },

  finishStudy: function() {
    this.clearAllTimers();
    
    if (this.data.studyHistory.length === 0) {
      this.setData({ 
        view: 'dashboard',
        showPageContainer: false
      });
      setTimeout(() => this.drawTrendChart(), 100);
      return;
    }
    
    const correctCount = this.data.studyHistory.filter(h => h.correct).length;
    const wrongCount = this.data.studyHistory.length - correctCount;
    const accuracy = Math.round((correctCount / this.data.studyHistory.length) * 100);
    
    const newReport = {
      id: 'study-report-' + Date.now(),
      type: 'study',
      year: this.data.studyPoolYear,
      date: this.getFormattedDate(),
      total: this.data.studyHistory.length,
      correct: correctCount,
      wrong: wrongCount,
      accuracy: accuracy,
      timeUsed: this.data.studySecondsUsed,
      details: this.data.studyHistory
    };
    
    // Chronological title count
    const studyReportsCount = this.data.history.filter(h => h.type === 'study').length;
    newReport.title = `第${studyReportsCount + 1}次学习报告 (${this.data.studyPoolYear}年真题突破)`;
    
    const updatedHistory = [newReport, ...this.data.history];
    wx.setStorageSync('simulator_history', updatedHistory);
    
    // Clean saved session
    if (this.data.studyPoolYear === 2025) {
      wx.removeStorageSync('saved_study_session_2025');
    } else {
      wx.removeStorageSync('saved_study_session_2026');
    }
    
    this.loadDataFromStorage(() => {
      this.setData({
        currentReport: newReport,
        reviewIdx: 0,
        view: 'report-detail',
        showPageContainer: true
      });
      this.showToast('学习结束，报告已生成！');
    });
  },

  resumeStudyTimer: function() {
    this.setData({ 
      showExitStudyModal: false,
      showPageContainer: this.data.view !== 'dashboard'
    });
    this.startStudyTimer();
  },

  // ----------------------------------------------------------------
  // EXAM SETUP AND LIFE-CYCLE
  // ----------------------------------------------------------------
  selectExamYear: function(e) {
    const year = parseInt(e.currentTarget.dataset.year);
    this.setData({ examPoolYear: year });
  },

  startExam: function() {
    const year = this.data.examPoolYear;
    const questions = year === 2025 ? questions2025 : questions2026;
    
    // Filter by type
    const tfPool = questions.filter(q => q.type === 'tf');
    const mcPool = questions.filter(q => q.type === 'mc');
    
    if (tfPool.length < 10 || mcPool.length < 15) {
      this.showToast('真题库题目数量不足，无法抽取25道题。');
      return;
    }
    
    // Random select 10 T/F & 15 MC
    const selectedTF = [...tfPool].sort(() => Math.random() - 0.5).slice(0, 10);
    const selectedMC = [...mcPool].sort(() => Math.random() - 0.5).slice(0, 15);
    
    const examSet = [...selectedTF, ...selectedMC];
    
    this.setData({
      view: 'exam',
      showPageContainer: true,
      examQuestions: examSet,
      examIndex: 0,
      examAnswers: {},
      examAnsweredCount: 0,
      examTimeRemaining: 1800
    });
    
    this.startExamTimer();
  },

  // ----------------------------------------------------------------
  // EXAM RUNTIME LOGIC
  // ----------------------------------------------------------------
  selectExamQuestion: function(e) {
    const idx = parseInt(e.currentTarget.dataset.idx);
    this.setData({ examIndex: idx });
  },

  handleExamAnswer: function(e) {
    const option = e.currentTarget.dataset.option;
    const q = this.data.examQuestions[this.data.examIndex];
    
    const updatedAnswers = { ...this.data.examAnswers, [q.id]: option };
    const answeredCount = Object.keys(updatedAnswers).length;
    this.setData({ 
      examAnswers: updatedAnswers,
      examAnsweredCount: answeredCount
    });
  },

  nextExamQuestion: function() {
    if (this.data.examIndex < this.data.examQuestions.length - 1) {
      this.setData({ examIndex: this.data.examIndex + 1 });
    }
  },

  prevExamQuestion: function() {
    if (this.data.examIndex > 0) {
      this.setData({ examIndex: this.data.examIndex - 1 });
    }
  },

  submitExam: function() {
    wx.showModal({
      title: '提交考试',
      content: '确定要提交当前答卷吗？',
      success: (res) => {
        if (res.confirm) {
          this.executeExamSubmission();
        }
      }
    });
  },

  executeExamSubmission: function() {
    this.clearAllTimers();
    
    const timeUsed = 1800 - this.data.examTimeRemaining;
    const details = this.data.examQuestions.map(q => {
      const userAnswer = this.data.examAnswers[q.id];
      const correct = userAnswer === q.answer;
      return {
        id: q.id,
        stem: q.stem,
        type: q.type,
        year: q.year,
        options: q.options,
        correctAnswer: q.answer,
        userAnswer: userAnswer || '',
        correct: correct,
        explanation: q.explanation
      };
    });
    
    const correctCount = details.filter(d => d.correct).length;
    const score = correctCount * 4; // 4 points each (25 questions total)
    const accuracy = Math.round((correctCount / 25) * 100);
    
    // Chronological title count
    const examReportsCount = this.data.history.filter(h => h.type === 'exam').length;
    const title = `第${examReportsCount + 1}次模拟考报告 (${this.data.examPoolYear}年试卷)`;
    
    const newReport = {
      id: 'exam-report-' + Date.now(),
      type: 'exam',
      year: this.data.examPoolYear,
      date: this.getFormattedDate(),
      total: 25,
      correct: correctCount,
      wrong: 25 - correctCount,
      accuracy: accuracy,
      score: score,
      timeUsed: timeUsed,
      details: details,
      title: title
    };
    
    const updatedHistory = [newReport, ...this.data.history];
    this.saveHistoryToStorage(updatedHistory);
    
    this.setData({
      currentReport: newReport,
      reviewIdx: 0,
      view: 'report-detail',
      showPageContainer: true
    });
    
    this.showToast('交卷成功，得分: ' + score);
  },

  // ----------------------------------------------------------------
  // REPORT DETAIL ACTIONS
  // ----------------------------------------------------------------
  selectReviewQuestion: function(e) {
    const idx = parseInt(e.currentTarget.dataset.idx);
    this.setData({ reviewIdx: idx }, () => {
      const report = this.data.currentReport;
      if (report && report.details && report.details[idx]) {
        this.playVoice(report.details[idx].explanation);
      }
    });
  },

  viewReport: function(e) {
    const id = e.currentTarget.dataset.id;
    const report = this.data.history.find(h => h.id === id);
    if (report) {
      this.setData({
        currentReport: report,
        reviewIdx: 0,
        view: 'report-detail',
        showPageContainer: true
      });
    }
  },

  deleteReport: function(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '删除记录',
      content: '确认要删除这条练习记录吗？此操作无法撤销。',
      success: (res) => {
        if (res.confirm) {
          const updated = this.data.history.filter(h => h.id !== id);
          this.saveHistoryToStorage(updated);
          this.showToast('记录已删除');
          setTimeout(() => this.drawTrendChart(), 100);
        }
      }
    });
  },

  // ----------------------------------------------------------------
  // TIMERS HELPERS
  // ----------------------------------------------------------------
  startStudyTimer: function() {
    this.clearStudyTimer();
    this.studyTimerInterval = setInterval(() => {
      const nextSec = this.data.studySecondsUsed + 1;
      this.setData({
        studySecondsUsed: nextSec,
        formattedStudyTime: this.formatTimeDisplay(nextSec)
      });
    }, 1000);
  },

  pauseStudyTimer: function() {
    this.clearStudyTimer();
  },

  clearStudyTimer: function() {
    if (this.studyTimerInterval) {
      clearInterval(this.studyTimerInterval);
      this.studyTimerInterval = null;
    }
  },

  startExamTimer: function() {
    this.clearExamTimer();
    this.setData({ formattedExamTime: this.formatTimeDisplay(this.data.examTimeRemaining) });
    this.examTimerInterval = setInterval(() => {
      const nextRemaining = this.data.examTimeRemaining - 1;
      if (nextRemaining <= 0) {
        this.clearExamTimer();
        this.setData({
          examTimeRemaining: 0,
          formattedExamTime: '00:00'
        });
        this.showToast('考试时间结束，自动提交答卷！');
        this.executeExamSubmission();
      } else {
        this.setData({
          examTimeRemaining: nextRemaining,
          formattedExamTime: this.formatTimeDisplay(nextRemaining)
        });
      }
    }, 1000);
  },

  clearExamTimer: function() {
    if (this.examTimerInterval) {
      clearInterval(this.examTimerInterval);
      this.examTimerInterval = null;
    }
  },

  clearAutoAdvance: function() {
    if (this.autoAdvanceTimeout) {
      clearTimeout(this.autoAdvanceTimeout);
      this.autoAdvanceTimeout = null;
    }
  },

  clearAllTimers: function() {
    this.clearStudyTimer();
    this.clearExamTimer();
    this.clearAutoAdvance();
    this.cancelSpeech();
  },

  formatTimeDisplay: function(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    
    const mm = m < 10 ? '0' + m : m;
    const ss = s < 10 ? '0' + s : s;
    
    if (h > 0) {
      const hh = h < 10 ? '0' + h : h;
      return `${hh}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  },

  // ----------------------------------------------------------------
  // SEARCH HANDLER
  // ----------------------------------------------------------------
  onSearchInput: function(e) {
    const val = e.detail.value;
    this.setData({ searchQuery: val }, () => {
      this.updateComputedData();
    });
  },

  // ----------------------------------------------------------------
  // DATE UTIL
  // ----------------------------------------------------------------
  getFormattedDate: function() {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hour = d.getHours();
    const min = d.getMinutes();
    
    const mm = month < 10 ? '0' + month : month;
    const dd = day < 10 ? '0' + day : day;
    const hh = hour < 10 ? '0' + hour : hour;
    const mi = min < 10 ? '0' + min : min;
    
    return `${year}-${mm}-${dd} ${hh}:${mi}`;
  },

  formatTimestamp: function(ts) {
    if (!ts) return '无';
    const d = new Date(ts);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hour = d.getHours();
    const min = d.getMinutes();
    
    const mm = month < 10 ? '0' + month : month;
    const dd = day < 10 ? '0' + day : day;
    const hh = hour < 10 ? '0' + hour : hour;
    const mi = min < 10 ? '0' + min : min;
    
    return `${year}-${mm}-${dd} ${hh}:${mi}`;
  },

  // ----------------------------------------------------------------
  // DYNAMIC CANVAS TREND CHART DRAWING
  // ----------------------------------------------------------------
  selectChartTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ chartTab: tab }, () => {
      this.drawTrendChart();
    });
  },

  drawTrendChart: function() {
    const query = this.createSelectorQuery();
    query.select('#trendCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return;
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        
        // Handle device pixel ratio for sharp canvas drawing
        const dpr = wx.getSystemInfoSync().pixelRatio;
        const width = res[0].width;
        const height = res[0].height;
        
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        
        // Filter history by mode
        const mode = this.data.chartTab; // 'study' or 'exam'
        const relevantHistory = this.data.history
          .filter(h => h.type === mode)
          .slice(0, 10) // Last 10 records
          .reverse(); // Chronological order
          
        // Background clear
        ctx.clearRect(0, 0, width, height);
        
        if (relevantHistory.length === 0) {
          // Render Empty State
          ctx.fillStyle = '#8f94a6';
          ctx.font = '13px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('暂无练习数据，开始学习或考试以生成趋势', width / 2, height / 2);
          return;
        }
        
        // Chart Paddings
        const paddingLeft = 40;
        const paddingRight = 20;
        const paddingTop = 30;
        const paddingBottom = 30;
        const graphWidth = width - paddingLeft - paddingRight;
        const graphHeight = height - paddingTop - paddingBottom;
        
        // Setup Grid Lines (3 horizontal lines)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        const yLines = 3;
        for (let i = 0; i <= yLines; i++) {
          const y = paddingTop + (graphHeight / yLines) * i;
          ctx.beginPath();
          ctx.moveTo(paddingLeft, y);
          ctx.lineTo(width - paddingRight, y);
          ctx.stroke();
          
          // Draw Y-axis Labels
          ctx.fillStyle = '#8f94a6';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          
          let val = 0;
          if (mode === 'study') {
            val = Math.round(100 - (100 / yLines) * i);
            ctx.fillText(val + '%', paddingLeft - 8, y);
          } else {
            val = Math.round(100 - (100 / yLines) * i);
            ctx.fillText(val + '分', paddingLeft - 8, y);
          }
        }
        
        // Coordinates Calculation
        const points = [];
        const xStep = relevantHistory.length > 1 ? graphWidth / (relevantHistory.length - 1) : graphWidth;
        
        relevantHistory.forEach((item, index) => {
          const x = paddingLeft + xStep * index;
          const value = mode === 'study' ? item.accuracy : (item.score !== undefined ? item.score : 0);
          const y = paddingTop + graphHeight - (value / 100) * graphHeight;
          points.push({ x, y, value, label: index + 1 });
        });
        
        // Draw Chart Path / Line
        ctx.strokeStyle = mode === 'study' ? '#6366f1' : '#a855f7';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        
        points.forEach((pt, index) => {
          if (index === 0) {
            ctx.moveTo(pt.x, pt.y);
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        });
        ctx.stroke();
        
        // Draw Dots and Values
        points.forEach((pt) => {
          // Outer circle
          ctx.fillStyle = mode === 'study' ? 'rgba(99, 102, 241, 0.2)' : 'rgba(168, 85, 247, 0.2)';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 7, 0, 2 * Math.PI);
          ctx.fill();
          
          // Inner dot
          ctx.fillStyle = mode === 'study' ? '#6366f1' : '#a855f7';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 3.5, 0, 2 * Math.PI);
          ctx.fill();
          
          // Value text above dot
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(pt.value + (mode === 'study' ? '%' : ''), pt.x, pt.y - 10);
          
          // X-axis indices
          ctx.fillStyle = '#8f94a6';
          ctx.font = '9px sans-serif';
          ctx.fillText('第' + pt.label + '次', pt.x, height - 10);
        });
      });
  },

  onVoiceToggleChange: function(e) {
    const enabled = e.detail.value;
    try {
      wx.setStorageSync('voice_enabled', enabled);
    } catch(err) {
      console.error(err);
    }
    this.setData({ voiceEnabled: enabled });
    if (!enabled) {
      this.cancelSpeech();
    }
  },

  splitTextIntoSegments: function(text) {
    if (!text) return [];
    const cleanText = text.replace(/[\\*#_`]/g, '').trim();
    if (!cleanText) return [];
    
    // Split by major punctuation: period, exclamation, question mark, semicolon, and newlines
    const majorRegex = /[。\n\r\t!?;！？；]/g;
    const majorSegments = cleanText.split(majorRegex).map(s => s.trim()).filter(s => s.length > 0);
    
    const finalSegments = [];
    const maxLen = 25; // Max characters per TTS request to avoid Youdao/Baidu 504 timeouts
    
    for (let segment of majorSegments) {
      if (segment.length <= maxLen) {
        finalSegments.push(segment);
      } else {
        // Split by minor punctuation: commas and pause commas
        const minorRegex = /[，、,]/g;
        const minorSegments = segment.split(minorRegex).map(s => s.trim()).filter(s => s.length > 0);
        
        for (let subSeg of minorSegments) {
          if (subSeg.length <= maxLen) {
            finalSegments.push(subSeg);
          } else {
            // Chunk by character count if still too long
            let start = 0;
            while (start < subSeg.length) {
              finalSegments.push(subSeg.substring(start, start + maxLen));
              start += maxLen;
            }
          }
        }
      }
    }
    return finalSegments;
  },

  playQueueNext: function() {
    if (!this.data.voiceEnabled) {
      this.cancelSpeech();
      return;
    }
    
    if (!this.audioQueue || this.audioQueueIndex >= this.audioQueue.length) {
      console.log('Audio queue finished or empty');
      if (this.audioContext) {
        try {
          this.audioContext.destroy();
        } catch(e) {}
      }
      this.audioContext = null;
      this.audioQueue = null;
      this.audioQueueIndex = 0;
      return;
    }
    
    const segmentText = this.audioQueue[this.audioQueueIndex];
    console.log(`Playing audio queue index ${this.audioQueueIndex}/${this.audioQueue.length}: "${segmentText}"`);
    
    if (this.audioContext) {
      try {
        this.audioContext.destroy();
      } catch(e) {
        console.error('Error destroying audio context', e);
      }
      this.audioContext = null;
    }
    
    const encodedText = encodeURIComponent(segmentText);
    const youdaoUrl = `https://dict.youdao.com/dictvoice?audio=${encodedText}&le=zh`;
    const baiduUrl = `https://tts.baidu.com/text2audio?lan=zh&ie=UTF-8&spd=5&text=${encodedText}`;
    
    const attemptPlay = (url, isFallback) => {
      console.log(`Downloading audio from: ${url}`);
      
      const audioContext = wx.createInnerAudioContext();
      this.audioContext = audioContext;
      
      if (wx.setInnerAudioOption) {
        wx.setInnerAudioOption({
          obeyMuteSwitch: false,
          speakerOn: true,
          success: () => console.log('setInnerAudioOption success'),
          fail: (err) => console.error('setInnerAudioOption fail', err)
        });
      }
      
      let isTimedOut = false;
      let downloadTask = null;
      
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        console.warn(`Download timed out (5s limit) for: ${url}`);
        if (downloadTask) {
          try {
            downloadTask.abort();
          } catch(e) {}
        }
        handleFailure();
      }, 5000);
      
      downloadTask = wx.downloadFile({
        url: url,
        success: (res) => {
          if (isTimedOut) return;
          clearTimeout(timeoutId);
          
          if (res.statusCode === 200 && res.tempFilePath) {
            console.log(`Successfully downloaded audio to ${res.tempFilePath}`);
            audioContext.src = res.tempFilePath;
            
            audioContext.onPlay(() => {
              console.log(`Audio segment ${this.audioQueueIndex} (${isFallback ? 'Baidu' : 'Youdao'}) started successfully`);
            });
            
            audioContext.onEnded(() => {
              console.log(`Audio segment ${this.audioQueueIndex} (${isFallback ? 'Baidu' : 'Youdao'}) ended`);
              // Clean up temp file asynchronously to prevent bloating local storage
              try {
                const fs = wx.getFileSystemManager();
                fs.unlink({
                  filePath: res.tempFilePath,
                  success: () => console.log(`Cleaned up temp file: ${res.tempFilePath}`),
                  fail: (err) => console.warn(`Failed to clean up temp file: ${res.tempFilePath}`, err)
                });
              } catch(e) {}
              
              this.audioQueueIndex++;
              this.playQueueNext();
            });
            
            audioContext.onError((playErr) => {
              console.error(`Playback error for downloaded local file, code:`, playErr.errCode, 'msg:', playErr.errMsg);
              try {
                const fs = wx.getFileSystemManager();
                fs.unlink({ filePath: res.tempFilePath });
              } catch(e) {}
              handleFailure();
            });
            
            audioContext.play();
          } else {
            console.warn(`Download returned non-200 status: ${res.statusCode}`);
            handleFailure();
          }
        },
        fail: (err) => {
          if (isTimedOut) return;
          clearTimeout(timeoutId);
          console.warn(`Download failed:`, err);
          handleFailure();
        }
      });
      
      const handleFailure = () => {
        try {
          audioContext.destroy();
        } catch(e) {}
        if (this.audioContext === audioContext) {
          this.audioContext = null;
        }
        
        if (!isFallback) {
          console.log(`Youdao download/play failed, attempting Baidu fallback...`);
          attemptPlay(baiduUrl, true);
        } else {
          console.error(`All downloads and playbacks failed for segment ${this.audioQueueIndex}`);
          wx.showToast({
            title: `播放失败，请在设置中授权“同声传译”插件`,
            icon: 'none',
            duration: 3500
          });
          this.audioQueueIndex++;
          this.playQueueNext();
        }
      };
    };
    
    // Start with Youdao
    attemptPlay(youdaoUrl, false);
  },

  playVoice: function(text) {
    console.log('playVoice called with text length:', text ? text.length : 0);
    if (!this.data.voiceEnabled) {
      console.log('playVoice ignored: voiceEnabled is false');
      return;
    }
    if (!text) return;
    
    this.cancelSpeech();
    
    const cleanText = text.replace(/[\\*#_`]/g, '').trim();
    if (!cleanText) return;

    // Try using WeChat's official speech synthesis plugin (WechatSI) first
    let wechatSI = null;
    try {
      wechatSI = requirePlugin("WechatSI");
    } catch(e) {
      console.warn("WechatSI plugin is not loaded in app.json:", e);
    }

    if (wechatSI && typeof wechatSI.textToSpeech === 'function') {
      console.log("Attempting text-to-speech using official WechatSI plugin...");
      
      const audioContext = wx.createInnerAudioContext();
      this.audioContext = audioContext;
      
      if (wx.setInnerAudioOption) {
        wx.setInnerAudioOption({
          obeyMuteSwitch: false,
          speakerOn: true
        });
      }

      wechatSI.textToSpeech({
        lang: "zh_CN",
        tts: true,
        content: cleanText,
        success: (res) => {
          console.log("WechatSI TTS synthesis successful:", res.filename);
          if (this.audioContext === audioContext) {
            audioContext.src = res.filename;
            
            audioContext.onPlay(() => {
              console.log("WechatSI playback started successfully");
            });
            
            audioContext.onEnded(() => {
              console.log("WechatSI playback ended");
              if (this.audioContext === audioContext) {
                this.audioContext = null;
              }
              try {
                audioContext.destroy();
              } catch(e) {}
            });
            
            audioContext.onError((err) => {
              console.error("WechatSI playback error:", err);
              try {
                audioContext.destroy();
              } catch(e) {}
              if (this.audioContext === audioContext) {
                this.audioContext = null;
              }
              // Fallback to queue player if playback fails
              this.fallbackToQueuePlayer(cleanText);
            });
            
            audioContext.play();
          }
        },
        fail: (err) => {
          console.warn("WechatSI TTS synthesis failed:", err);
          try {
            audioContext.destroy();
          } catch(e) {}
          if (this.audioContext === audioContext) {
            this.audioContext = null;
          }
          // Fallback to queue player
          this.fallbackToQueuePlayer(cleanText);
        }
      });
    } else {
      console.log("WechatSI plugin not available, using fallback queue player...");
      this.fallbackToQueuePlayer(cleanText);
    }
  },

  fallbackToQueuePlayer: function(text) {
    this.audioQueue = this.splitTextIntoSegments(text);
    this.audioQueueIndex = 0;
    console.log('Split speech into queue for fallback player:', this.audioQueue);
    this.playQueueNext();
  },

  playStudyFeedbackSound: function(correct) {
    if (!wx.createWebAudioContext) {
      console.warn('wx.createWebAudioContext is not supported on this platform');
      return;
    }
    
    try {
      if (!this.feedbackAudioContext) {
        this.feedbackAudioContext = wx.createWebAudioContext();
      }
      const ctx = this.feedbackAudioContext;
      
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      
      const playTone = ({ frequency, start, duration, type = 'sine', peak = 0.06 }) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const startAt = ctx.currentTime + start;
        const endAt = startAt + duration;
        
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(peak, startAt + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
        
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(startAt);
        oscillator.stop(endAt + 0.02);
      };
      
      if (correct) {
        [
          { frequency: 523.25, start: 0, duration: 0.11 },
          { frequency: 659.25, start: 0.08, duration: 0.12 },
          { frequency: 783.99, start: 0.17, duration: 0.16, peak: 0.05 },
        ].forEach(playTone);
      } else {
        [
          { frequency: 440, start: 0, duration: 0.11, type: 'square', peak: 0.075 },
          { frequency: 349.23, start: 0.1, duration: 0.13, type: 'triangle', peak: 0.07 },
          { frequency: 261.63, start: 0.22, duration: 0.18, type: 'triangle', peak: 0.06 },
        ].forEach(playTone);
      }
    } catch (e) {
      console.warn('Error playing feedback sound', e);
    }
  },

  cancelSpeech: function() {
    console.log('cancelSpeech called');
    this.audioQueue = null;
    this.audioQueueIndex = 0;
    if (this.audioContext) {
      try {
        this.audioContext.stop();
        this.audioContext.destroy();
        this.audioContext = null;
        console.log('Audio context stopped and destroyed successfully');
      } catch(e) {
        console.error('Error stopping/destroying audio context', e);
      }
    }
  },

  replayStudyVoice: function() {
    const q = this.data.studyQuestions[this.data.studyIndex];
    if (q) {
      this.playVoice(q.explanation);
    }
  },

  replayReportVoice: function() {
    const report = this.data.currentReport;
    if (report && report.details && report.details[this.data.reviewIdx]) {
      this.playVoice(report.details[this.data.reviewIdx].explanation);
    }
  },

  // ----------------------------------------------------------------
  // BACK BUTTON INTERCEPTION & NAVIGATION
  // ----------------------------------------------------------------
  onPageContainerLeave: function() {
    console.log('onPageContainerLeave triggered');
    
    // If showPageContainer is already false in our JS data state, this leave event
    // was triggered programmatically by setData({ showPageContainer: false }), not by a user gesture.
    // We must ignore programmatic closes to prevent infinite toggle loops and flickering.
    if (!this.data.showPageContainer) {
      console.log('Ignoring programmatic page-container leave');
      return;
    }
    
    this.handleBackNavigation();
    
    // Sync state to false immediately to match native closed state
    this.setData({ showPageContainer: false });
    
    // Re-enable page-container after native transitions settle to prevent layout flickering
    setTimeout(() => {
      const isChildActive = this.data.view !== 'dashboard' || this.data.showExitStudyModal || this.data.showDropConfirmModal;
      if (isChildActive) {
        this.setData({ showPageContainer: true });
      }
    }, 250);
  },

  handleBackNavigation: function() {
    if (this.data.showExitStudyModal) {
      this.resumeStudyTimer();
      return;
    }
    if (this.data.showDropConfirmModal) {
      this.cancelDrop();
      return;
    }
    this.handleHeaderHomeClick();
  }
});
