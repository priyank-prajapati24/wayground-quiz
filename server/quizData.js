export const SAMPLE_QUIZZES = [
  {
    id: "quiz-1",
    title: "Classroom Algebra & Math Quiz",
    description: "Standard live classroom assessment with equations, variables and mental math",
    category: "Math",
    questions: [
      {
        id: "q1",
        question: "If a = 3 and c = 5, what is the value of: a + c",
        options: [
          { text: "8", isCorrect: true, color: "#88d500" },   // Lime Green
          { text: "15", isCorrect: false, color: "#9b51e0" }, // Purple
          { text: "2", isCorrect: false, color: "#ff7675" },  // Orange
          { text: "35", isCorrect: false, color: "#00cec9" }  // Cyan
        ],
        timeLimit: 15
      },
      {
        id: "q2",
        question: "Solve for x: 2x + 10 = 24",
        options: [
          { text: "7", isCorrect: true, color: "#88d500" },
          { text: "14", isCorrect: false, color: "#9b51e0" },
          { text: "12", isCorrect: false, color: "#ff7675" },
          { text: "5", isCorrect: false, color: "#00cec9" }
        ],
        timeLimit: 20
      },
      {
        id: "q3",
        question: "Which of the following numbers is a Prime Number?",
        options: [
          { text: "27", isCorrect: false, color: "#88d500" },
          { text: "31", isCorrect: true, color: "#9b51e0" },
          { text: "49", isCorrect: false, color: "#ff7675" },
          { text: "51", isCorrect: false, color: "#00cec9" }
        ],
        timeLimit: 15
      },
      {
        id: "q4",
        question: "What is the square root of 144?",
        options: [
          { text: "10", isCorrect: false, color: "#88d500" },
          { text: "11", isCorrect: false, color: "#9b51e0" },
          { text: "12", isCorrect: true, color: "#ff7675" },
          { text: "14", isCorrect: false, color: "#00cec9" }
        ],
        timeLimit: 15
      }
    ]
  },
  {
    id: "quiz-2",
    title: "General Science & Tech Challenge",
    description: "Test student knowledge across physics, biology, and computer technology",
    category: "Science",
    questions: [
      {
        id: "s1",
        question: "What chemical element has the symbol 'Fe'?",
        options: [
          { text: "Gold", isCorrect: false, color: "#88d500" },
          { text: "Iron", isCorrect: true, color: "#9b51e0" },
          { text: "Silver", isCorrect: false, color: "#ff7675" },
          { text: "Lead", isCorrect: false, color: "#00cec9" }
        ],
        timeLimit: 15
      },
      {
        id: "s2",
        question: "Which planet is known as the Red Planet?",
        options: [
          { text: "Venus", isCorrect: false, color: "#88d500" },
          { text: "Jupiter", isCorrect: false, color: "#9b51e0" },
          { text: "Mars", isCorrect: true, color: "#ff7675" },
          { text: "Mercury", isCorrect: false, color: "#00cec9" }
        ],
        timeLimit: 15
      },
      {
        id: "s3",
        question: "What speed does light travel in a vacuum approximately?",
        options: [
          { text: "300,000 km/s", isCorrect: true, color: "#88d500" },
          { text: "150,000 km/s", isCorrect: false, color: "#9b51e0" },
          { text: "1,000,000 km/s", isCorrect: false, color: "#ff7675" },
          { text: "30,000 km/s", isCorrect: false, color: "#00cec9" }
        ],
        timeLimit: 20
      }
    ]
  }
];
