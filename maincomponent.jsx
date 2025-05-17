"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { createClient } from "@supabase/supabase-js";

// ======= REPLACE THESE =======
const SUPABASE_URL = "https://your-supabase-url.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key";
// =============================

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function MainComponent() {
  const commonWords = useMemo(() => [
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "I",
    "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
    "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
    "or", "an", "will", "my", "one", "all", "would", "there", "their", "what",
    "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
    "when", "make", "can", "like", "time", "no", "just", "him", "know",
    "take", "people", "into", "year", "your", "good", "some", "could", "them",
    "see", "other", "than", "then", "now", "look", "only", "come", "its",
    "over", "think", "also", "back", "after", "use", "two", "how", "our",
    "work", "first", "well", "way", "even", "new", "want", "because", "any",
    "these", "give", "day", "most", "us"
  ], []);

  const [user, setUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  const generateRandomText = useCallback(() => {
    const wordCount = 50;
    return Array.from({ length: wordCount }, () =>
      commonWords[Math.floor(Math.random() * commonWords.length)]
    ).join(" ");
  }, [commonWords]);

  const [text, setText] = useState(generateRandomText());
  const [input, setInput] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [testActive, setTestActive] = useState(false);
  const [testComplete, setTestComplete] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const inputRef = useRef(null);

  // 🛠️ FIXED WPM CALCULATION
  const calculateWPM = useCallback(() => {
    if (!startTime) return 0;
    const timeElapsed = (Date.now() - startTime) / 1000 / 60; // in minutes
    const wordsTyped = input.trim().split(/\s+/).filter(Boolean).length;
    const raw = Math.round(wordsTyped / timeElapsed) || 0;
    return Math.round((raw * accuracy) / 100);
  }, [input, startTime, accuracy]);

  const calculateAccuracy = useCallback(() => {
    if (!input.length) return 100;
    let correct = 0;
    for (let i = 0; i < input.length && i < text.length; i++) {
      if (input[i] === text[i]) correct++;
    }
    return Math.round((correct / input.length) * 100);
  }, [input, text]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );

    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (testActive && timeLeft > 0) {
      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setTestActive(false);
            setTestComplete(true);
            return 0;
          }
          return prev - 1;
        });
        setWpm(calculateWPM());
        setAccuracy(calculateAccuracy());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [testActive, timeLeft, calculateWPM, calculateAccuracy]);

  useEffect(() => {
    if (testComplete && user) {
      submitScore();
    }
  }, [testComplete, user, wpm, accuracy]);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [testComplete]);

  useEffect(() => {
    let tabPressed = false;

    const onKeyDown = (e) => {
      if (e.key === "Tab") tabPressed = true;
      else if (e.key === "Enter" && tabPressed) {
        e.preventDefault();
        restartTest();
      }
    };
    const onKeyUp = (e) => {
      if (e.key === "Tab") tabPressed = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const handleInput = (e) => {
    if (!testActive && !testComplete) {
      setTestActive(true);
      setStartTime(Date.now());
    }
    setInput(e.target.value);
  };

  const restartTest = () => {
    setText(generateRandomText());
    setInput("");
    setStartTime(null);
    setTimeLeft(30);
    setWpm(0);
    setAccuracy(100);
    setTestActive(false);
    setTestComplete(false);
    inputRef.current?.focus();
  };

  const submitScore = async () => {
    if (!user) return;
    try {
      const { error } = await supabase.from("leaderboard").insert([
        { user_email: user.email, wpm, accuracy },
      ]);
      if (error) throw error;
      fetchLeaderboard();
    } catch (error) {
      console.error("Failed to submit score:", error.message);
    }
  };

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      const { data, error } = await supabase
        .from("leaderboard")
        .select("*")
        .order("wpm", { ascending: false })
        .limit(10);
      if (error) throw error;
      setLeaderboard(data);
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error.message);
    }
    setLoadingLeaderboard(false);
  };

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "github" });
    if (error) alert("Error signing in: " + error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div
      className={`min-h-screen p-8 font-mono flex flex-col items-center ${
        darkMode ? "bg-[#323437] text-[#646669]" : "bg-white text-black"
      }`}
    >
      {/* Header */}
      <div className="w-full max-w-[1200px] mb-8 flex justify-between items-center">
        <h1 className={`text-2xl font-bold ${darkMode ? "text-[#d1d0c5]" : "text-black"}`}>
          monkeytype
        </h1>
        <div className="flex gap-8 items-center">
          <div className="text-center">
            <p className={`${darkMode ? "text-[#646669]" : "text-gray-600"} text-sm`}>time</p>
            <p className={`text-xl font-bold ${darkMode ? "text-[#d1d0c5]" : "text-black"}`}>
              {timeLeft}
            </p>
          </div>
          {user ? (
            <>
              <p
                className={`text-sm text-ellipsis max-w-[140px] ${
                  darkMode ? "text-[#646669]" : "text-gray-600"
                }`}
                title={user.email}
              >
                {user.email}
              </p>
              <button
                onClick={signOut}
                className="text-sm font-semibold text-red-400 hover:text-red-600"
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={signIn}
              className="text-sm font-semibold text-green-400 hover:text-green-600"
            >
              Sign in (GitHub)
            </button>
          )}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`rounded px-2 py-1 ${
              darkMode ? "bg-[#646669] text-[#323437]" : "bg-gray-800 text-white"
            }`}
          >
            {darkMode ? "Light Mode" : "Dark Mode"}
          </button>
        </div>
      </div>

      {/* Text to type */}
      <div
        className={`w-full max-w-[1200px] p-4 rounded ${
          darkMode ? "bg-[#292b2d]" : "bg-gray-200"
        } select-none`}
        style={{ userSelect: "none" }}
      >
        {text.split("").map((char, i) => {
          let className = "";
          if (i < input.length) {
            className = char === input[i] ? "text-green-400" : "text-red-400";
          } else if (i === input.length) {
            className = "underline decoration-yellow-300 underline-offset-2";
          }
          return (
            <span key={i} className={className}>
              {char}
            </span>
          );
        })}
      </div>
      {/* Input */}
      <textarea
        ref={inputRef}
        value={input}
        onChange={handleInput}
        disabled={testComplete}
        rows={3}
        spellCheck={false}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        className={`mt-6 w-full max-w-[1200px] p-4 rounded font-mono text-lg ${
          darkMode
            ? "bg-[#323437] text-[#d1d0c5] caret-yellow-400"
            : "bg-white text-black caret-yellow-600"
        } resize-none focus:outline-yellow-400`}
        placeholder="Start typing here..."
      />

      {/* Stats & Restart */}
      <div className="w-full max-w-[1200px] mt-4 flex justify-between items-center">
        <div className="flex gap-8">
          <div>
            <p className="text-sm text-gray-400">WPM</p>
            <p className="text-xl font-semibold">{wpm}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Accuracy</p>
            <p className="text-xl font-semibold">{accuracy}%</p>
          </div>
        </div>
        <button
          onClick={restartTest}
          className="rounded bg-yellow-400 px-4 py-2 font-semibold text-black hover:bg-yellow-500"
        >
          Restart (Tab + Enter)
        </button>
      </div>

      {/* Leaderboard */}
      <div
        className={`w-full max-w-[1200px] mt-12 p-4 rounded ${
          darkMode ? "bg-[#292b2d]" : "bg-gray-200"
        }`}
      >
        <h2 className="text-xl font-bold mb-4">Leaderboard</h2>
        {loadingLeaderboard ? (
          <p>Loading leaderboard...</p>
        ) : leaderboard.length === 0 ? (
          <p>No scores yet.</p>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={darkMode ? "border-b border-gray-700" : "border-b border-gray-300"}>
                <th className="py-2 px-4">Rank</th>
                <th className="py-2 px-4">User</th>
                <th className="py-2 px-4">WPM</th>
                <th className="py-2 px-4">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => (
                <tr
                  key={entry.id}
                  className={i % 2 === 0 ? (darkMode ? "bg-[#3a3b3d]" : "bg-gray-100") : ""}
                >
                  <td className="py-2 px-4">{i + 1}</td>
                  <td
                    className="py-2 px-4 truncate max-w-[200px]"
                    title={entry.user_email}
                  >
                    {entry.user_email}
                  </td>
                  <td className="py-2 px-4">{entry.wpm}</td>
                  <td className="py-2 px-4">{entry.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default MainComponent;