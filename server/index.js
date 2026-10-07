import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { SAMPLE_QUIZZES } from './quizData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Configure Socket.io with high-concurrency performance tuning for 300+ students
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  perMessageDeflate: false, // Disabling compression reduces server CPU load for high client counts
  pingTimeout: 30000,
  pingInterval: 10000
});

app.use(express.json());

// Get Local IPv4 Address for QR Code Scanning over local Wi-Fi / LAN
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIp();
const PORT = process.env.PORT || 3000;

// Serve API endpoint for local IP info and quizzes
app.get('/api/info', (req, res) => {
  res.json({
    ip: LOCAL_IP,
    port: PORT,
    joinUrl: `http://${LOCAL_IP}:${PORT}`
  });
});

app.get('/api/quizzes', (req, res) => {
  res.json(SAMPLE_QUIZZES);
});

// In-Memory Game Rooms Store
const rooms = new Map();

// Helper: Generate unique 6-digit game PIN
function generateGamePin() {
  let pin;
  do {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(pin));
  return pin;
}

// Room Timer Handler
function startRoomTimer(pin) {
  const room = rooms.get(pin);
  if (!room) return;

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
  }

  const currentQ = room.quiz.questions[room.currentQuestionIndex];
  if (!room.timeLeft) {
    room.timeLeft = currentQ.timeLimit || 15;
  }
  room.isPaused = false;

  io.to(pin).emit('timer-update', {
    timeLeft: room.timeLeft,
    isPaused: room.isPaused
  });

  room.timerInterval = setInterval(() => {
    if (room.isPaused) return;

    room.timeLeft -= 1;
    io.to(pin).emit('timer-update', {
      timeLeft: room.timeLeft,
      isPaused: room.isPaused
    });

    if (room.timeLeft <= 0) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
      // Auto-end timer when time runs out
      handleEndQuestion(pin);
    }
  }, 1000);
}

function handleEndQuestion(pin) {
  const room = rooms.get(pin);
  if (!room) return;

  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }

  room.status = 'question-ended';
  const currentQ = room.quiz.questions[room.currentQuestionIndex];

  // Calculate question breakdown & update player totals
  const optionCounts = [0, 0, 0, 0];
  const leaderboard = [];

  for (const player of room.players.values()) {
    const qAnswer = player.answers[room.currentQuestionIndex];
    if (qAnswer && qAnswer.optionIndex !== undefined) {
      optionCounts[qAnswer.optionIndex] = (optionCounts[qAnswer.optionIndex] || 0) + 1;
    }
    leaderboard.push({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      score: player.score,
      streak: player.streak,
      lastAnswerCorrect: qAnswer ? qAnswer.isCorrect : false
    });
  }

  // Sort leaderboard high to low
  leaderboard.sort((a, b) => b.score - a.score);

  io.to(pin).emit('question-ended', {
    correctOptionIndex: currentQ.options.findIndex(o => o.isCorrect),
    optionCounts,
    leaderboard: leaderboard.slice(0, 10), // Top 10 for performance
    totalParticipants: room.players.size,
    answeredCount: Array.from(room.players.values()).filter(p => p.answers[room.currentQuestionIndex] !== undefined).length
  });
}

// Socket.io Connection & Event Handling
io.on('connection', (socket) => {
  // Create Room (Host)
  socket.on('create-room', ({ quizId, customQuiz }) => {
    const quiz = customQuiz || SAMPLE_QUIZZES.find(q => q.id === quizId) || SAMPLE_QUIZZES[0];
    const pin = generateGamePin();

    const room = {
      pin,
      quiz,
      hostSocketId: socket.id,
      status: 'lobby', // lobby | active | question-ended | finished
      currentQuestionIndex: 0,
      timeLeft: 0,
      isPaused: false,
      players: new Map(), // socketId -> player object
      timerInterval: null
    };

    rooms.set(pin, room);
    socket.join(pin);

    socket.emit('room-created', {
      pin,
      quizTitle: quiz.title,
      totalQuestions: quiz.questions.length,
      joinUrl: `http://${LOCAL_IP}:${PORT}`
    });
  });

  // Join Room (Participant)
  socket.on('join-room', ({ pin, name, avatar }) => {
    const room = rooms.get(pin);

    if (!room) {
      return socket.emit('join-error', { message: 'Game PIN not found. Check the code and try again.' });
    }

    if (room.status !== 'lobby') {
      return socket.emit('join-error', { message: 'This game has already started.' });
    }

    const player = {
      id: socket.id,
      name: name.trim() || `Student ${room.players.size + 1}`,
      avatar: avatar || '🤖',
      score: 0,
      streak: 0,
      answers: {} // questionIndex -> { optionIndex, isCorrect, speedMs }
    };

    room.players.set(socket.id, player);
    socket.join(pin);

    // Notify player of successful join
    socket.emit('joined-success', {
      pin,
      player,
      quizTitle: room.quiz.title
    });

    // Notify host & all clients of updated participant roster
    const playersList = Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score
    }));

    io.to(pin).emit('players-update', {
      totalPlayers: room.players.size,
      players: playersList
    });
  });

  // Start Quiz (Host)
  socket.on('start-quiz', ({ pin }) => {
    const room = rooms.get(pin);
    if (!room || room.hostSocketId !== socket.id) return;

    room.status = 'active';
    room.currentQuestionIndex = 0;
    const firstQ = room.quiz.questions[0];
    room.timeLeft = firstQ.timeLimit || 15;

    io.to(pin).emit('quiz-started', {
      questionIndex: 0,
      totalQuestions: room.quiz.questions.length,
      question: {
        text: firstQ.question,
        options: firstQ.options.map(o => ({ text: o.text, color: o.color })),
        timeLimit: firstQ.timeLimit
      },
      answeredCount: 0,
      totalParticipants: room.players.size
    });

    startRoomTimer(pin);
  });

  // Timer Controls (Host)
  socket.on('timer-control', ({ pin, action }) => {
    const room = rooms.get(pin);
    if (!room || room.hostSocketId !== socket.id) return;

    if (action === 'add15') {
      room.timeLeft += 15;
    } else if (action === 'pause') {
      room.isPaused = !room.isPaused;
    } else if (action === 'restart') {
      const currentQ = room.quiz.questions[room.currentQuestionIndex];
      room.timeLeft = currentQ.timeLimit || 15;
    } else if (action === 'end') {
      handleEndQuestion(pin);
      return;
    }

    io.to(pin).emit('timer-update', {
      timeLeft: room.timeLeft,
      isPaused: room.isPaused
    });
  });

  // Submit Answer (Participant)
  socket.on('submit-answer', ({ pin, optionIndex, timeRemaining }) => {
    const room = rooms.get(pin);
    if (!room || room.status !== 'active') return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const currentQIndex = room.currentQuestionIndex;
    if (player.answers[currentQIndex] !== undefined) return; // Already submitted

    const currentQ = room.quiz.questions[currentQIndex];
    const isCorrect = currentQ.options[optionIndex]?.isCorrect || false;

    // Speed bonus calculation (max 1000 pts: 500 base + up to 500 speed bonus)
    let pointsEarned = 0;
    if (isCorrect) {
      const timeRatio = Math.max(0, timeRemaining / (currentQ.timeLimit || 15));
      pointsEarned = Math.round(500 + 500 * timeRatio);
      player.streak += 1;
      if (player.streak > 1) pointsEarned += Math.min(player.streak * 50, 200); // Streak bonus
      player.score += pointsEarned;
    } else {
      player.streak = 0;
    }

    player.answers[currentQIndex] = {
      optionIndex,
      isCorrect,
      pointsEarned
    };

    // Acknowledge submission to the player
    socket.emit('answer-recorded', {
      isCorrect,
      pointsEarned,
      currentScore: player.score,
      streak: player.streak
    });

    // Send lightweight submission progress update to Host & room
    const answeredCount = Array.from(room.players.values()).filter(p => p.answers[currentQIndex] !== undefined).length;
    const totalParticipants = room.players.size;

    // Send participant status list update
    const participantStatuses = Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      submitted: p.answers[currentQIndex] !== undefined
    }));

    io.to(pin).emit('submission-progress', {
      answeredCount,
      totalParticipants,
      participantStatuses
    });

    // Auto-advance if all participants answered
    if (answeredCount >= totalParticipants && totalParticipants > 0) {
      handleEndQuestion(pin);
    }
  });

  // Next Question / Finish Quiz (Host)
  socket.on('next-question', ({ pin }) => {
    const room = rooms.get(pin);
    if (!room || room.hostSocketId !== socket.id) return;

    room.currentQuestionIndex += 1;

    if (room.currentQuestionIndex >= room.quiz.questions.length) {
      // Quiz Complete
      room.status = 'finished';
      if (room.timerInterval) clearInterval(room.timerInterval);

      const finalLeaderboard = Array.from(room.players.values())
        .map(p => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          score: p.score,
          accuracy: Math.round((Object.values(p.answers).filter(a => a.isCorrect).length / room.quiz.questions.length) * 100) || 0
        }))
        .sort((a, b) => b.score - a.score);

      io.to(pin).emit('quiz-finished', {
        leaderboard: finalLeaderboard,
        podium: finalLeaderboard.slice(0, 3)
      });
    } else {
      // Load Next Question
      room.status = 'active';
      const q = room.quiz.questions[room.currentQuestionIndex];
      room.timeLeft = q.timeLimit || 15;

      // Reset statuses for new question
      const participantStatuses = Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        submitted: false
      }));

      io.to(pin).emit('question-next', {
        questionIndex: room.currentQuestionIndex,
        totalQuestions: room.quiz.questions.length,
        question: {
          text: q.question,
          options: q.options.map(o => ({ text: o.text, color: o.color })),
          timeLimit: q.timeLimit
        },
        answeredCount: 0,
        totalParticipants: room.players.size,
        participantStatuses
      });

      startRoomTimer(pin);
    }
  });

  // Handle Disconnect
  socket.on('disconnect', () => {
    for (const [pin, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        const playersList = Array.from(room.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          score: p.score
        }));
        io.to(pin).emit('players-update', {
          totalPlayers: room.players.size,
          players: playersList
        });
      }
    }
  });
});

// Serve built static Vite frontend if dist folder exists
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Wayground Live Quiz Server running on http://localhost:${PORT}`);
  console.log(`📱 LAN Network Access for QR Code Join: http://${LOCAL_IP}:${PORT}`);
});
