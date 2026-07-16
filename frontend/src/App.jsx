import { useState, useRef, useEffect } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  FaFileUpload,
  FaMoon,
  FaSun,
  FaCopy,
  FaDownload,
  FaCheckCircle,
  FaTimesCircle,
  FaRobot,
  FaSpinner,
} from "react-icons/fa";

import "./App.css";

function App() {
  const [resume, setResume] = useState(null);
  const [resumeName, setResumeName] = useState("");

  const [jobDescription, setJobDescription] = useState("");

  const [loading, setLoading] = useState(false);

  const [darkMode, setDarkMode] = useState(false);

  const [result, setResult] = useState(null);

  const analysisRef = useRef();

  useEffect(() => {
    document.body.className = darkMode ? "dark" : "";
  }, [darkMode]);

  const handleDrop = (e) => {
    e.preventDefault();

    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setResume(file);
      setResumeName(file.name);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const uploadResume = async () => {
    if (!resume || !jobDescription) {
      alert("Please upload resume and enter job description.");
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();

      formData.append("resume", resume);
      formData.append("jobDescription", jobDescription);

      const res = await axios.post(
        "http://localhost:5000/analyze",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setResult(res.data);
    } catch (err) {
      console.log(err);
      alert("Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const copyCoverLetter = () => {
    navigator.clipboard.writeText(result.coverLetter);
    alert("Copied!");
  };

  const downloadCoverLetter = () => {
    const pdf = new jsPDF();

    pdf.setFontSize(14);

    pdf.text(
      pdf.splitTextToSize(result.coverLetter, 180),
      10,
      20
    );

    pdf.save("CoverLetter.pdf");
  };

  const downloadAnalysis = async () => {
    const canvas = await html2canvas(analysisRef.current);

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");

    const width = 190;

    const height =
      (canvas.height * width) / canvas.width;

    pdf.addImage(
      imgData,
      "PNG",
      10,
      10,
      width,
      height
    );

    pdf.save("ResumeAnalysis.pdf");
  };

  const Circle = ({ score }) => {
    const radius = 75;

    const circumference =
      2 * Math.PI * radius;

    const offset =
      circumference -
      (score / 100) * circumference;

    return (
      <svg width="180" height="180">
        <circle
          cx="90"
          cy="90"
          r={radius}
          stroke="#444"
          strokeWidth="12"
          fill="transparent"
        />

        <circle
          cx="90"
          cy="90"
          r={radius}
          stroke="#00ff99"
          strokeWidth="12"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 90 90)"
        />

        <text
          x="90"
          y="98"
          textAnchor="middle"
          className="scoreText"
        >
          {score}%
        </text>
      </svg>
    );
  };

  return (
    <div className="app">

      <header>

        <h1>
          <FaRobot />
          AI Resume Analyzer
        </h1>

        <button
          className="themeBtn"
          onClick={() =>
            setDarkMode(!darkMode)
          }
        >
          {darkMode ? <FaSun /> : <FaMoon />}
        </button>

      </header>

      <div className="uploadCard">

        <div
          className="dropArea"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <FaFileUpload size={45} />

          <p>
            Drag & Drop Resume Here
          </p>

          <span>or</span>

          <input
            type="file"
            accept=".pdf"
            onChange={(e) => {
              setResume(e.target.files[0]);
              setResumeName(
                e.target.files[0].name
              );
            }}
          />

          {resumeName && (
            <h4>{resumeName}</h4>
          )}
        </div>

        <textarea
          placeholder="Paste Job Description..."
          value={jobDescription}
          onChange={(e) =>
            setJobDescription(
              e.target.value
            )
          }
        />

        <button
          className="analyzeBtn"
          onClick={uploadResume}
        >
          {loading ? (
            <>
              <FaSpinner className="spin" />
              Analyzing...
            </>
          ) : (
            "Analyze Resume"
          )}
        </button>

      </div>

      {result && (
        <div className="analysisSection" ref={analysisRef}>

          {/* ATS SCORE */}

          <div className="glassCard scoreCard">

            <h2>ATS Resume Score</h2>

            <Circle score={result.score} />

          </div>

          {/* Missing Skills */}

          <div className="glassCard">

            <h2>Missing Skills</h2>

            <div className="badgeContainer">
              {result.missingSkills &&
              result.missingSkills.length > 0 ? (
                result.missingSkills.map(
                  (skill, index) => (
                    <span
                      key={index}
                      className="badge red"
                    >
                      {skill}
                    </span>
                  )
                )
              ) : (
                <p>No missing skills 🎉</p>
              )}
            </div>

          </div>

          {/* Strengths */}

          <div className="glassCard">

            <h2>Resume Strengths</h2>

            <div className="listContainer">

              {result.strengths &&
                result.strengths.map(
                  (item, index) => (
                    <div
                      className="listItem success"
                      key={index}
                    >
                      <FaCheckCircle />

                      <span>{item}</span>
                    </div>
                  )
                )}

            </div>

          </div>

          {/* Weaknesses */}

          <div className="glassCard">

            <h2>Resume Weaknesses</h2>

            <div className="listContainer">

              {result.weaknesses &&
                result.weaknesses.map(
                  (item, index) => (
                    <div
                      className="listItem danger"
                      key={index}
                    >
                      <FaTimesCircle />

                      <span>{item}</span>
                    </div>
                  )
                )}

            </div>

          </div>

          {/* Summary */}

          <div className="glassCard">

            <h2>Resume Summary</h2>

            <p className="paragraph">
              {result.summary}
            </p>

          </div>

          {/* Cover Letter */}

          <div className="glassCard">

            <div className="cardHeader">

              <h2>AI Cover Letter</h2>

              <div>

                <button
                  className="smallBtn"
                  onClick={copyCoverLetter}
                >
                  <FaCopy />

                  Copy
                </button>

                <button
                  className="smallBtn"
                  onClick={downloadCoverLetter}
                >
                  <FaDownload />

                  PDF
                </button>

              </div>

            </div>

            <pre className="coverLetter">
              {result.coverLetter}
            </pre>

          </div>

          {/* Interview Questions */}

          <div className="glassCard">

            <h2>Interview Questions</h2>

            <div className="listContainer">

              {result.interviewQuestions &&
                result.interviewQuestions.map(
                  (question, index) => (
                    <div
                      className="question"
                      key={index}
                    >
                      <span>
                        {index + 1}.
                      </span>

                      <p>{question}</p>
                    </div>
                  )
                )}

            </div>

          </div>

          {/* Suggestions */}

          <div className="glassCard">

            <h2>
              ATS Improvement Suggestions
            </h2>

            <div className="listContainer">

              {result.suggestions &&
                result.suggestions.map(
                  (item, index) => (
                    <div
                      className="listItem"
                      key={index}
                    >
                      ✔ {item}
                    </div>
                  )
                )}

            </div>

          </div>

          {/* Download */}

          <div className="downloadArea">

            <button
              className="downloadBtn"
              onClick={downloadAnalysis}
            >
              <FaDownload />

              Download Complete Analysis
            </button>

          </div>

        </div>
      )}

    </div>
  );
}

export default App;