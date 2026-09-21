import Busboy from "busboy";
import pdfParse from "pdf-parse";
import Groq from "groq-sdk";

// This is a Vercel Serverless Function (not a Next.js route), deployed
// automatically from the frontend/api/ folder. It replaces the old
// standalone Express server (backend/server.js), which never ran in
// production and is why the frontend's "http://localhost:5000/analyze"
// call always failed once the site was live on Vercel.

// Vercel doesn't auto-parse multipart/form-data bodies, so we turn off
// the default body parser and read the incoming file ourselves.
export const config = {
  api: {
    bodyParser: false,
  },
};

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

function parseMultipartForm(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: {
        // Keep uploads comfortably under Vercel's request body limit.
        fileSize: 4 * 1024 * 1024, // 4MB
      },
    });

    let jobDescription = "";
    let resumeBuffer = null;
    let fileTooLarge = false;

    busboy.on("field", (name, value) => {
      if (name === "jobDescription") {
        jobDescription = value;
      }
    });

    busboy.on("file", (name, file) => {
      const chunks = [];

      file.on("data", (chunk) => chunks.push(chunk));

      file.on("limit", () => {
        fileTooLarge = true;
      });

      file.on("end", () => {
        if (name === "resume") {
          resumeBuffer = Buffer.concat(chunks);
        }
      });
    });

    busboy.on("finish", () => {
      if (fileTooLarge) {
        reject(new Error("FILE_TOO_LARGE"));
        return;
      }
      resolve({ jobDescription, resumeBuffer });
    });

    busboy.on("error", reject);

    req.pipe(busboy);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const { jobDescription, resumeBuffer } = await parseMultipartForm(req);

    if (!resumeBuffer) {
      return res.status(400).json({ error: "Resume PDF is required." });
    }

    if (!jobDescription || jobDescription.trim() === "") {
      return res.status(400).json({ error: "Job description is required." });
    }

    const pdfData = await pdfParse(resumeBuffer);
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

    let response = completion.choices[0].message.content.trim();

    // Remove markdown fencing if the model adds it anyway.
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

    return res.status(200).json(json);
  } catch (error) {
    console.error(error);

    if (error.message === "FILE_TOO_LARGE") {
      return res.status(413).json({
        error: "Resume PDF is too large (max 4MB).",
      });
    }

    return res.status(500).json({
      error: "Internal Server Error",
      details: error.message,
    });
  }
}
