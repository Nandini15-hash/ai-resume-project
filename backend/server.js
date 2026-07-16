import express from "express";
import cors from "cors";
import multer from "multer";
import pdfParse from "pdf-parse";
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
});

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

app.get("/", (req, res) => {
  res.json({
    message: "AI Resume Analyzer API Running 🚀",
  });
});

app.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Resume PDF is required.",
      });
    }

    const jobDescription = req.body.jobDescription;

    if (!jobDescription || jobDescription.trim() === "") {
      return res.status(400).json({
        error: "Job description is required.",
      });
    }

    // Read PDF
    const pdfData = await pdfParse(req.file.buffer);

    const resumeText = pdfData.text;

    const prompt = `
You are an expert ATS Resume Analyzer.

Compare the following resume with the job description.

Resume:
${resumeText}

Job Description:
${jobDescription}

Return ONLY VALID JSON.

Do not include markdown.
Do not include explanation.
Do not include triple backticks.

Return exactly this structure:

{
  "score": 90,
  "missingSkills": [],
  "strengths": [],
  "weaknesses": [],
  "summary": "",
  "coverLetter": "",
  "interviewQuestions": [],
  "suggestions": []
}

Rules:

score:
Integer between 0 and 100.

missingSkills:
Array of strings.

strengths:
Array of strings.

weaknesses:
Array of strings.

summary:
Professional paragraph.

coverLetter:
Professional cover letter.

interviewQuestions:
10 interview questions.

suggestions:
10 ATS improvement suggestions.

Return ONLY JSON.
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are an ATS Resume Analyzer that always responds with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    let response =
      completion.choices[0].message.content.trim();

    // Remove markdown if model adds it
    response = response.replace(/```json/g, "");
    response = response.replace(/```/g, "");
    response = response.trim();

    let json;

    try {
      json = JSON.parse(response);
    } catch (err) {
      console.error("JSON Parse Error:", err);

      return res.status(500).json({
        error: "AI returned invalid JSON.",
        raw: response,
      });
    }

    res.json(json);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});