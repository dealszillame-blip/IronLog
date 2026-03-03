import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

/* ── Fonts & Global Styles ─────────────────────────────────────────────────── */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body { background: #070707; overscroll-behavior: none; }
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; }
    ::-webkit-scrollbar { display: none; }
    input, select, textarea, button { font-family: inherit; }
    select option { background: #111; color: #fff; }
    textarea { resize: none; }
    @keyframes slideUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes popIn    { from{opacity:0;transform:scale(0.93)}       to{opacity:1;transform:scale(1)}    }
    @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.3} }
    @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes shimmer  { from{background-position:-200% 0} to{background-position:200% 0} }
    .slide-up  { animation: slideUp 0.28s cubic-bezier(.22,.68,0,1.2) both; }
    .pop-in    { animation: popIn  0.22s cubic-bezier(.22,.68,0,1.2) both; }
    .pressable:active { opacity:0.7; transform:scale(0.97); }
    .cursor { display:inline-block; width:2px; height:14px; background:#c0392b; animation:blink 1s infinite; vertical-align:middle; margin-left:2px; }
    .thinking-dot { width:6px; height:6px; border-radius:50%; background:#c0392b; animation:pulse 1s infinite; }
    .thinking-dot:nth-child(2) { animation-delay:0.2s; }
    .thinking-dot:nth-child(3) { animation-delay:0.4s; }
  `}</style>
);

/* ── Default Program ───────────────────────────────────────────────────────── */
const DEFAULT_PROGRAM = {
  name: "Fierce 5",
  frequency: 3,
  workouts: [
    {
      id: "A", label: "WORKOUT A", color: "#c0392b",
      exercises: [
        { name: "Squat",           sets: 3, reps: 5,  increment: 2.5,  note: "Linear progression" },
        { name: "Bench Press",     sets: 3, reps: 5,  increment: 2.5,  note: "Linear progression" },
        { name: "Barbell Row",     sets: 3, reps: 5,  increment: 2.5,  note: "Linear progression" },
        { name: "Romanian DL",     sets: 3, reps: 8,  increment: 2.5,  note: "Accessory" },
        { name: "Dumbbell Press",  sets: 3, reps: 10, increment: 1.25, note: "Accessory" },
      ],
    },
    {
      id: "B", label: "WORKOUT B", color: "#1a6fb5",
      exercises: [
        { name: "Squat",          sets: 3, reps: 5,  increment: 2.5, note: "Linear progression" },
        { name: "Overhead Press", sets: 3, reps: 5,  increment: 2.5, note: "Linear progression" },
        { name: "Deadlift",       sets: 1, reps: 5,  increment: 5,   note: "Linear progression" },
        { name: "Incline Bench",  sets: 3, reps: 8,  increment: 2.5, note: "Accessory" },
        { name: "Lat Pulldown",   sets: 3, reps: 10, increment: 2.5, note: "Accessory" },
      ],
    },
  ],
};

/* ── Storage ───────────────────────────────────────────────────────────────── */
const KEY = "fierce5_ai_v4";
const emptyData = () => ({
  program: DEFAULT_PROGRAM,
  workouts: [],
  weights: {},
  nextWorkout: "A",
  startDate: new Date().toISOString(),
});
async function loadData() {
  try { const r = await window.storage.get(KEY); return r ? JSON.parse(r.value) : emptyData(); }
  catch { return emptyData(); }
}
async function saveData(d) {
  try { await window.storage.set(KEY, JSON.stringify(d)); } catch {}
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */
const e1rm    = (w, r) => r === 1 ? w : +(w * (1 + r / 30)).toFixed(1);
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
const fmtFull = (iso) => new Date(iso).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const roundKg = (v) => Math.round(v * 4) / 4;

function predictWeight(exerciseName, targetDateIso, data) {
  const history = data.workouts
    .filter(w => w.exercises.some(e => e.name === exerciseName))
    .map(w => {
      const ex = w.exercises.find(e => e.name === exerciseName);
      const best = ex.sets.length ? Math.max(...ex.sets.map(s => s.weight)) : null;
      return best ? { date: new Date(w.date), weight: best } : null;
    }).filter(Boolean).sort((a, b) => a.date - b.date);

  const wkDef = data.program.workouts.flatMap(w => w.exercises).find(e => e.name === exerciseName);
  const inc = wkDef?.increment ?? 2.5;
  const currentWeight = data.weights[exerciseName] ?? 0;

  if (history.length < 2) {
    if (!currentWeight) return null;
    const daysAhead = Math.max(0, (new Date(targetDateIso) - new Date()) / 86400000);
    const sessions = Math.floor((daysAhead / 7) * data.program.frequency);
    return roundKg(currentWeight + sessions * inc);
  }
  const t0 = history[0].date.getTime();
  const xs = history.map(h => (h.date.getTime() - t0) / 86400000);
  const ys = history.map(h => h.weight);
  const n = xs.length, mx = xs.reduce((a, x) => a + x, 0) / n, my = ys.reduce((a, y) => a + y, 0) / n;
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const intercept = my - slope * mx;
  const targetDays = (new Date(targetDateIso).getTime() - t0) / 86400000;
  const predicted = intercept + slope * targetDays;
  return predicted > 0 ? roundKg(predicted) : null;
}

/* ── Icons ─────────────────────────────────────────────────────────────────── */
const Ic = {
  bolt:     () => <svg viewBox="0 0 24 24" fill="currentColor" style={{width:16,height:16}}><path d="M13 2L4.09 12.26a1 1 0 00.82 1.6H11l-1 8.14 8.91-10.26a1 1 0 00-.82-1.6H13l1-8.14z"/></svg>,
  barbell:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><rect x="1" y="10" width="3" height="4" rx="1"/><rect x="20" y="10" width="3" height="4" rx="1"/><rect x="4" y="8" width="3" height="8" rx="1"/><rect x="17" y="8" width="3" height="8" rx="1"/><line x1="7" y1="12" x2="17" y2="12" strokeWidth="2.5"/></svg>,
  chart:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  chat:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  history:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 100.5-4M3 4v4h4"/></svg>,
  check:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{width:14,height:14}}><polyline points="20 6 9 17 4 12"/></svg>,
  trash:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
  send:     () => <svg viewBox="0 0 24 24" fill="currentColor" style={{width:16,height:16}}><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>,
  pencil:   () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  crystal:  () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  close:    () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:16,height:16}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  plus:     () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:16,height:16}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  settings: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
};

/* ── Shared styles ─────────────────────────────────────────────────────────── */
const inputStyle = { width:"100%", background:"#151515", border:"1px solid #232323", borderRadius:8, color:"#fff", padding:"11px 14px", fontSize:15, outline:"none" };
const labelStyle = { display:"block", color:"#444", fontSize:11, textTransform:"uppercase", letterSpacing:1.5, marginBottom:6 };
const toggleBtn  = (active) => ({ background:active?"#c0392b":"#161616", border:`1px solid ${active?"#c0392b":"#2a2a2a"}`, borderRadius:8, color:active?"#fff":"#555", padding:"8px 16px", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.15s" });

/* ══════════════════════════════════════════════════════════════════════════════
   AI CHAT TAB
══════════════════════════════════════════════════════════════════════════════ */
function AiChatTab({ data, onDataChange }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: `G'day! I'm your AI training coach 🏋️\n\nI can help you:\n• **Modify your program** — "change squat to 4 sets of 3"\n• **Log a workout** — "log today's workout A: squat 80kg x5, bench 60kg x5"\n• **Update weights** — "set my deadlift to 120kg"\n• **Switch programs** — "change me to a PPL routine"\n• **Ask anything** — "what weight should I use for bench next week?"\n\nWhat do you need?`,
      type: "text"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const buildSystemPrompt = (currentData) => `
You are an AI strength training coach embedded in a workout tracker app. The user follows the Fierce 5 program (or a custom variant) and trains in Australia using KILOGRAMS.

CURRENT APP STATE (JSON):
${JSON.stringify(currentData, null, 2)}

YOUR JOB:
You can both ANSWER questions and MODIFY the app data. When the user wants to make a change, respond with a JSON action block AND a friendly message.

RESPONSE FORMAT:
Always respond in this exact JSON structure:
{
  "message": "Your friendly reply to the user (use markdown: **bold**, bullet points with •)",
  "action": null | { "type": "UPDATE_DATA", "data": { ...complete updated data object } }
}

ACTION RULES:
- When modifying data, always return the COMPLETE updated data object (not just the changed parts)
- Use "action": null if just answering a question
- All weights in KG
- Increments should be realistic: 2.5kg for upper body, 5kg for deadlift, 1.25kg for dumbbells
- When adding exercises, use proper sets/reps/increment values
- When logging a workout, add to data.workouts array AND update data.weights for each exercise
- workout log format: { id: Date.now(), date: ISO string, workout: "A"|"B", label: "WORKOUT A", exercises: [{name, scheme, sets:[{weight,reps}]}] }
- When switching programs, completely replace data.program with a new structure

THINGS YOU CAN DO:
1. Change exercise in program (e.g. "replace bench with close-grip bench")
2. Change sets/reps/increment for any exercise
3. Add or remove exercises from any workout day
4. Add or remove entire workout days
5. Switch to a completely different program (PPL, 5/3/1, GZCLP, Starting Strength, etc.)
6. Log a past or current workout
7. Update current working weights
8. Answer questions about training, progression, form, nutrition
9. Predict/forecast weights (just answer, no action needed)
10. Explain the program or any exercise

TONE: Friendly Australian gym coach. Brief, direct, encouraging. No fluff.
`;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const apiMessages = newMessages
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
          system: buildSystemPrompt(data),
          messages: apiMessages,
        }),
      });

      const result = await response.json();
      const rawText = result.content?.[0]?.text || "{}";

      let parsed;
      try {
        const cleaned = rawText.replace(/```json\n?|\n?```/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { message: rawText, action: null };
      }

      const assistantMsg = {
        role: "assistant",
        content: parsed.message || "Done!",
        type: "text",
      };

      if (parsed.action?.type === "UPDATE_DATA" && parsed.action.data) {
        const updatedData = parsed.action.data;
        await onDataChange(updatedData);
        assistantMsg.hasAction = true;
      }

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Couldn't connect right now. Check your network and try again.",
        type: "error",
      }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // Render markdown-lite
  const renderContent = (text) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      // Bold
      const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={j} style={{color:"#e8e8e8"}}>{part.slice(2,-2)}</strong>
          : part
      );
      const isBullet = line.trim().startsWith("•") || line.trim().startsWith("-");
      return (
        <div key={i} style={{
          marginBottom: line === "" ? 6 : 2,
          paddingLeft: isBullet ? 4 : 0,
          color: isBullet ? "#aaa" : "#c8c8c8",
          fontSize: 14, lineHeight: 1.6,
        }}>{parts}</div>
      );
    });
  };

  const SUGGESTIONS = [
    "What's my next workout?",
    "Change squat to 4×3",
    "Switch me to PPL",
    "Log squat 100kg×5",
    "Add face pulls to Workout A",
    "What weight for bench next month?",
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"calc(100vh - 130px)" }}>
      {/* Header */}
      <div style={{ paddingBottom:12, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <div style={{
            width:32, height:32, borderRadius:8,
            background:"linear-gradient(135deg,#c0392b,#8b1a1a)",
            display:"flex", alignItems:"center", justifyContent:"center", color:"#fff",
          }}><Ic.bolt/></div>
          <div>
            <div style={{ fontFamily:"'Bebas Neue'", fontSize:22, letterSpacing:3, color:"#fff", lineHeight:1 }}>
              AI COACH
            </div>
            <div style={{ fontSize:10, color:"#3a3a3a", letterSpacing:1 }}>POWERED BY CLAUDE</div>
          </div>
          <div style={{
            marginLeft:"auto", background:"#0d1f0d", border:"1px solid #1a3a1a",
            borderRadius:20, padding:"3px 10px", fontSize:11, color:"#4caf50",
            display:"flex", alignItems:"center", gap:5,
          }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"#4caf50" }}/>
            ONLINE
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex:1, overflowY:"auto", display:"flex", flexDirection:"column",
        gap:12, paddingBottom:12,
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display:"flex",
            justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            animation: "slideUp 0.2s ease both",
          }}>
            {msg.role === "assistant" && (
              <div style={{
                width:28, height:28, borderRadius:7, flexShrink:0,
                background:"linear-gradient(135deg,#c0392b,#8b1a1a)",
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"#fff", marginRight:8, marginTop:2,
              }}><Ic.bolt/></div>
            )}
            <div style={{
              maxWidth:"82%",
              background: msg.role === "user"
                ? "linear-gradient(135deg,#c0392b,#9a2a1e)"
                : msg.type === "error" ? "#1a0a0a" : "#111",
              border: msg.role === "user" ? "none"
                : msg.type === "error" ? "1px solid #3a1a1a"
                : "1px solid #1e1e1e",
              borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
              padding:"11px 14px",
            }}>
              {msg.hasAction && (
                <div style={{
                  display:"flex", alignItems:"center", gap:5,
                  marginBottom:8, padding:"4px 8px",
                  background:"#0d1a0d", border:"1px solid #1a3a1a", borderRadius:6,
                }}>
                  <span style={{color:"#4caf50", fontSize:12}}>✓</span>
                  <span style={{color:"#4a7a4a", fontSize:11, fontWeight:600}}>Changes applied to your program</span>
                </div>
              )}
              {msg.role === "user"
                ? <div style={{color:"#fff", fontSize:14, lineHeight:1.6}}>{msg.content}</div>
                : renderContent(msg.content)
              }
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
            <div style={{
              width:28, height:28, borderRadius:7, flexShrink:0,
              background:"linear-gradient(135deg,#c0392b,#8b1a1a)",
              display:"flex", alignItems:"center", justifyContent:"center", color:"#fff",
            }}><Ic.bolt/></div>
            <div style={{
              background:"#111", border:"1px solid #1e1e1e",
              borderRadius:"4px 16px 16px 16px", padding:"14px 16px",
              display:"flex", gap:6, alignItems:"center",
            }}>
              <div className="thinking-dot"/>
              <div className="thinking-dot"/>
              <div className="thinking-dot"/>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Quick suggestions */}
      {messages.length <= 2 && (
        <div style={{
          display:"flex", gap:6, overflowX:"auto",
          paddingBottom:8, flexShrink:0,
        }}>
          {SUGGESTIONS.map((s, i) => (
            <button key={i} onClick={() => setInput(s)}
              className="pressable"
              style={{
                flexShrink:0, background:"#0f0f0f",
                border:"1px solid #1e1e1e", borderRadius:20,
                color:"#666", padding:"6px 12px", fontSize:12,
                cursor:"pointer", whiteSpace:"nowrap",
              }}>{s}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{
        display:"flex", gap:8, alignItems:"flex-end", flexShrink:0,
        paddingTop:8, borderTop:"1px solid #141414",
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask your coach anything..."
          rows={1}
          style={{
            flex:1, background:"#0f0f0f",
            border:"1px solid #1e1e1e", borderRadius:12,
            color:"#fff", padding:"12px 14px",
            fontSize:14, lineHeight:1.5, outline:"none",
            maxHeight:100, overflowY:"auto",
          }}
          onInput={e => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
          }}
        />
        <button onClick={sendMessage} disabled={!input.trim() || loading}
          style={{
            width:44, height:44, borderRadius:12, border:"none", cursor:"pointer",
            background: input.trim() && !loading
              ? "linear-gradient(135deg,#c0392b,#9a2a1e)" : "#111",
            color: input.trim() && !loading ? "#fff" : "#333",
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"all 0.2s", flexShrink:0,
          }}>
          <Ic.send/>
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   TAB: TODAY
══════════════════════════════════════════════════════════════════════════════ */
function TodayTab({ data, onSave }) {
  const wkDef = data.program.workouts.find(w => w.id === data.nextWorkout) || data.program.workouts[0];
  const accent = wkDef.color;

  const initExercises = () => wkDef.exercises.map(ex => ({
    name: ex.name, scheme: `${ex.sets}×${ex.reps}`,
    increment: ex.increment, note: ex.note,
    targetSets: ex.sets, targetReps: ex.reps,
    sets: Array.from({ length: ex.sets }, () => ({
      weight: String(data.weights[ex.name] ?? ""), reps: String(ex.reps), done: false,
    })),
  }));

  const [exercises, setExercises] = useState(initExercises);
  const [saved, setSaved] = useState(false);
  const [expandedEx, setExpandedEx] = useState(0);

  const totalDone = exercises.reduce((a, ex) => a + ex.sets.filter(s => s.done).length, 0);
  const totalSets = exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const allDone   = totalDone === totalSets && totalSets > 0;

  const toggleSet = (ei, si) => setExercises(prev => prev.map((ex, i) =>
    i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => j !== si ? s : { ...s, done: !s.done }) }
  ));
  const updateSet = (ei, si, field, val) => setExercises(prev => prev.map((ex, i) =>
    i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => j !== si ? s : { ...s, [field]: val }) }
  ));

  const handleFinish = async () => {
    const newWeights = { ...data.weights };
    const loggedExercises = exercises.map(ex => {
      const completedSets = ex.sets.filter(s => s.done && s.weight && s.reps)
        .map(s => ({ weight: parseFloat(s.weight), reps: parseInt(s.reps) }));
      if (completedSets.length > 0) newWeights[ex.name] = Math.max(...completedSets.map(s => s.weight));
      return { name: ex.name, scheme: ex.scheme, sets: completedSets };
    }).filter(ex => ex.sets.length > 0);
    if (!loggedExercises.length) return;

    const nextIdx = (data.program.workouts.findIndex(w => w.id === data.nextWorkout) + 1) % data.program.workouts.length;
    const updated = {
      ...data,
      workouts: [{ id: Date.now(), date: new Date().toISOString(), workout: wkDef.id, label: wkDef.label, exercises: loggedExercises }, ...data.workouts],
      weights: newWeights,
      nextWorkout: data.program.workouts[nextIdx].id,
    };
    await onSave(updated);
    setSaved(true);
  };

  if (saved) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      justifyContent:"center", minHeight:"65vh", gap:16, textAlign:"center" }} className="pop-in">
      <div style={{fontSize:64}}>💪</div>
      <div style={{fontFamily:"'Bebas Neue'",fontSize:38,color:"#fff",letterSpacing:3}}>SESSION DONE</div>
      <div style={{color:"#555",fontSize:14}}>Rest up. Come back stronger.</div>
    </div>
  );

  return (
    <div className="slide-up">
      <div style={{marginBottom:18}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
          <span style={{background:accent,borderRadius:5,padding:"2px 9px",fontFamily:"'Bebas Neue'",fontSize:12,letterSpacing:2,color:"#fff"}}>{data.program.name}</span>
          <span style={{color:"#383838",fontSize:12}}>{new Date().toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"short"})}</span>
        </div>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:36,letterSpacing:3,color:"#fff",lineHeight:1}}>{wkDef.label}</div>
        <div style={{marginTop:10,display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1,height:3,background:"#181818",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:99,background:accent,width:`${totalSets?(totalDone/totalSets)*100:0}%`,transition:"width 0.35s ease"}}/>
          </div>
          <span style={{color:"#383838",fontSize:12,flexShrink:0}}>{totalDone}/{totalSets} sets</span>
        </div>
      </div>

      {exercises.map((ex, ei) => {
        const exDone = ex.sets.every(s => s.done);
        const isOpen = expandedEx === ei;
        const lastW  = data.weights[ex.name];
        const nextSug = lastW != null ? roundKg(lastW + ex.increment) : null;
        return (
          <div key={ei} style={{background:"#0d0d0d",border:`1px solid ${exDone?accent+"55":"#1b1b1b"}`,borderRadius:12,marginBottom:9,overflow:"hidden",transition:"border-color 0.2s"}}>
            <button onClick={() => setExpandedEx(isOpen?null:ei)} style={{width:"100%",background:"none",border:"none",cursor:"pointer",padding:"13px 15px",display:"flex",alignItems:"center",gap:11,textAlign:"left"}}>
              <div style={{width:28,height:28,borderRadius:7,flexShrink:0,background:exDone?accent:"#181818",border:`1px solid ${exDone?accent:"#252525"}`,display:"flex",alignItems:"center",justifyContent:"center",color:exDone?"#fff":"#3a3a3a",transition:"all 0.2s"}}>
                {exDone?<Ic.check/>:<span style={{fontSize:11,fontWeight:700}}>{ei+1}</span>}
              </div>
              <div style={{flex:1}}>
                <div style={{color:exDone?"#666":"#e8e8e8",fontSize:15,fontWeight:700,transition:"color 0.2s"}}>{ex.name}</div>
                <div style={{color:"#3a3a3a",fontSize:12,marginTop:1}}>{ex.scheme} · {ex.note}</div>
              </div>
              <div style={{color:"#2a2a2a",fontSize:22}}>{isOpen?"−":"+"}</div>
            </button>
            {isOpen && (
              <div style={{padding:"0 15px 15px"}}>
                {nextSug!=null && (
                  <div style={{background:"#0f1a0f",border:"1px solid #1a2e1a",borderRadius:8,padding:"8px 12px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{color:"#4caf50",fontSize:12}}>↑</span>
                    <span style={{color:"#4a7a4a",fontSize:12}}>Last: <b style={{color:"#6aaa6a"}}>{lastW} kg</b>{"  ·  "}Try today: <b style={{color:"#4caf50"}}>{nextSug} kg</b></span>
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"24px 1fr 1fr 44px",gap:8,marginBottom:5}}>
                  <div/>{["WEIGHT (kg)","REPS"].map(h=><div key={h} style={{color:"#2d2d2d",fontSize:10,textTransform:"uppercase",letterSpacing:1,textAlign:"center"}}>{h}</div>)}<div/>
                </div>
                {ex.sets.map((s,si)=>(
                  <div key={si} style={{display:"grid",gridTemplateColumns:"24px 1fr 1fr 44px",gap:8,alignItems:"center",marginBottom:7,background:s.done?"#0d1a0d":"transparent",borderRadius:8,padding:"5px 3px",transition:"background 0.2s"}}>
                    <div style={{color:"#333",fontSize:12,textAlign:"center"}}>{si+1}</div>
                    <input type="number" value={s.weight} onChange={e=>updateSet(ei,si,"weight",e.target.value)} placeholder="0"
                      style={{background:"#141414",border:`1px solid ${s.done?"#1c361c":"#212121"}`,borderRadius:8,color:s.done?"#4caf50":"#fff",padding:"10px 6px",fontSize:16,textAlign:"center",width:"100%"}}/>
                    <input type="number" value={s.reps} onChange={e=>updateSet(ei,si,"reps",e.target.value)} placeholder="0"
                      style={{background:"#141414",border:`1px solid ${s.done?"#1c361c":"#212121"}`,borderRadius:8,color:s.done?"#4caf50":"#fff",padding:"10px 6px",fontSize:16,textAlign:"center",width:"100%"}}/>
                    <button onClick={()=>toggleSet(ei,si)} style={{width:44,height:44,borderRadius:8,border:"none",cursor:"pointer",background:s.done?"#153015":"#181818",color:s.done?"#4caf50":"#2d2d2d",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}><Ic.check/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button onClick={handleFinish} disabled={totalDone===0} style={{width:"100%",marginTop:6,background:allDone?`linear-gradient(135deg,${accent},${accent}bb)`:totalDone>0?"#161616":"#0d0d0d",border:`1px solid ${totalDone>0?accent+"55":"#181818"}`,borderRadius:12,color:totalDone>0?"#fff":"#2a2a2a",padding:16,cursor:totalDone>0?"pointer":"default",fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:3,boxShadow:allDone?`0 4px 24px ${accent}44`:"none",transition:"all 0.2s"}}>
        {allDone?"⚡ FINISH SESSION":totalDone>0?"FINISH SESSION":"COMPLETE SETS TO FINISH"}
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   TAB: PROGRESS
══════════════════════════════════════════════════════════════════════════════ */
function ProgressTab({ data }) {
  const allExercises = [...new Set(data.program.workouts.flatMap(w => w.exercises.map(e => e.name)))];
  const [selected, setSelected] = useState(allExercises[0] || "Squat");

  const chartData = [...data.workouts].reverse()
    .filter(w => w.exercises.some(e => e.name === selected))
    .map(w => {
      const ex = w.exercises.find(e => e.name === selected);
      const best = ex.sets.length ? Math.max(...ex.sets.map(s => e1rm(s.weight, s.reps))) : 0;
      const topWeight = ex.sets.length ? Math.max(...ex.sets.map(s => s.weight)) : 0;
      return { date: fmtDate(w.date), e1rm: best, weight: topWeight };
    });

  const hasData = chartData.length > 0;
  const best    = hasData ? Math.max(...chartData.map(d => d.e1rm)) : 0;
  const latest  = hasData ? chartData[chartData.length-1].weight : 0;
  const gain    = chartData.length > 1 ? chartData[chartData.length-1].e1rm - chartData[0].e1rm : 0;

  return (
    <div className="slide-up">
      <div style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,color:"#fff",marginBottom:4}}>PROGRESS</div>
      <div style={{color:"#444",fontSize:13,marginBottom:18}}>Estimated 1-rep max over time</div>
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:18}}>
        {allExercises.map(ex=>(
          <button key={ex} onClick={()=>setSelected(ex)} className="pressable"
            style={{flexShrink:0,border:"none",borderRadius:20,cursor:"pointer",padding:"7px 14px",fontSize:13,fontWeight:600,background:selected===ex?"#c0392b":"#111",color:selected===ex?"#fff":"#555",outline:selected===ex?"none":"1px solid #1e1e1e"}}>
            {ex}
          </button>
        ))}
      </div>
      {!hasData ? (
        <div style={{textAlign:"center",padding:"50px 20px",color:"#333"}}>
          <div style={{fontSize:36,marginBottom:12}}>📊</div>
          <div>No data for {selected} yet.</div>
        </div>
      ) : (
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:16}}>
            {[{label:"BEST E1RM",value:`${best} kg`,color:"#fff"},{label:"LAST WEIGHT",value:`${latest} kg`,color:"#fff"},{label:"TOTAL GAIN",value:gain>=0?`+${gain} kg`:`${gain} kg`,color:gain>=0?"#4caf50":"#e74c3c"}].map(s=>(
              <div key={s.label} style={{background:"#0f0f0f",border:"1px solid #1a1a1a",borderRadius:10,padding:"12px 10px",textAlign:"center"}}>
                <div style={{color:"#3a3a3a",fontSize:9,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>{s.label}</div>
                <div style={{color:s.color,fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:1}}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a",borderRadius:12,padding:"16px 4px 8px"}}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{top:4,right:12,left:-20,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#151515"/>
                <XAxis dataKey="date" tick={{fill:"#333",fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"#333",fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#fff",fontSize:12}} labelStyle={{color:"#888",marginBottom:4}} formatter={v=>[`${v} kg`]}/>
                <Line type="monotone" dataKey="e1rm" stroke="#c0392b" strokeWidth={2.5} dot={{fill:"#c0392b",r:4,strokeWidth:0}} activeDot={{r:6}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   TAB: LOG
══════════════════════════════════════════════════════════════════════════════ */
function LogTab({ data, onDelete }) {
  if (!data.workouts.length) return (
    <div style={{textAlign:"center",padding:"60px 20px",color:"#282828"}} className="slide-up">
      <div style={{fontSize:40,marginBottom:12}}>🏋️</div>
      <div style={{fontFamily:"'Bebas Neue'",fontSize:24,letterSpacing:2,color:"#383838"}}>NO SESSIONS YET</div>
    </div>
  );
  return (
    <div className="slide-up">
      <div style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,color:"#fff",marginBottom:4}}>SESSION LOG</div>
      <div style={{color:"#3a3a3a",fontSize:13,marginBottom:20}}>{data.workouts.length} session{data.workouts.length!==1?"s":""} recorded</div>
      {data.workouts.map(w => {
        const wkColor = data.program.workouts.find(x=>x.id===w.workout)?.color||"#c0392b";
        return (
          <div key={w.id} style={{background:"#0b0b0b",border:"1px solid #181818",borderLeft:`3px solid ${wkColor}`,borderRadius:12,marginBottom:10,padding:"13px 15px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                  <span style={{background:wkColor+"22",color:wkColor,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,letterSpacing:1}}>{w.label||`WORKOUT ${w.workout}`}</span>
                  <span style={{color:"#2d2d2d",fontSize:12}}>{fmtFull(w.date)}</span>
                </div>
              </div>
              <button onClick={()=>onDelete(w.id)} style={{background:"none",border:"none",color:"#252525",cursor:"pointer",padding:4}}><Ic.trash/></button>
            </div>
            {w.exercises.map((ex,i)=>(
              <div key={i} style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:5}}>
                <span style={{color:"#484848",fontSize:13,minWidth:110}}>{ex.name}</span>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  {ex.sets.map((s,j)=>(
                    <span key={j} style={{background:"#141414",borderRadius:5,padding:"2px 8px",fontSize:12,color:"#7a7a7a"}}>{s.weight}×{s.reps}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ROOT APP
══════════════════════════════════════════════════════════════════════════════ */
const TABS = [
  { id:"today",    label:"TODAY",   Icon:Ic.barbell  },
  { id:"chat",     label:"AI COACH",Icon:Ic.chat     },
  { id:"progress", label:"GAINS",   Icon:Ic.chart    },
  { id:"log",      label:"LOG",     Icon:Ic.history  },
];

export default function App() {
  const [tab, setTab]   = useState("today");
  const [data, setData] = useState(null);

  useEffect(() => { loadData().then(setData); }, []);

  const handleSave = useCallback(async (updated) => {
    setData(updated); await saveData(updated);
  }, []);
  const handleDelete = useCallback(async (id) => {
    const updated = { ...data, workouts: data.workouts.filter(w => w.id !== id) };
    setData(updated); await saveData(updated);
  }, [data]);

  if (!data) return (
    <>
      <GlobalStyles/>
      <div style={{minHeight:"100vh",background:"#070707",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:28,color:"#c0392b",letterSpacing:4,animation:"pulse 1s infinite"}}>LOADING…</div>
      </div>
    </>
  );

  const nextWk = data.program.workouts.find(w => w.id === data.nextWorkout) || data.program.workouts[0];
  const accent = nextWk?.color || "#c0392b";

  return (
    <>
      <GlobalStyles/>
      <div style={{minHeight:"100vh",background:"#070707",fontFamily:"'Barlow',sans-serif",color:"#fff",maxWidth:480,margin:"0 auto"}}>
        {/* Top bar */}
        <div style={{position:"sticky",top:0,zIndex:20,background:"linear-gradient(180deg,#070707 75%,transparent)",padding:"14px 20px 4px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:32,height:32,background:"#c0392b",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"}}><Ic.bolt/></div>
              <div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:19,letterSpacing:3,lineHeight:1}}>{data.program.name.toUpperCase()}</div>
                <div style={{fontSize:10,color:"#2d2d2d",letterSpacing:1}}>STRENGTH TRACKER · KG</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{background:accent+"22",border:`1px solid ${accent}44`,borderRadius:20,padding:"4px 12px",fontSize:11,fontWeight:700,color:accent,letterSpacing:1}}>
                NEXT: {nextWk?.id}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{padding:"6px 20px 100px"}}>
          {tab==="today"    && <TodayTab    key={data.nextWorkout} data={data} onSave={handleSave}/>}
          {tab==="chat"     && <AiChatTab   data={data} onDataChange={handleSave}/>}
          {tab==="progress" && <ProgressTab data={data}/>}
          {tab==="log"      && <LogTab      data={data} onDelete={handleDelete}/>}
        </div>

        {/* Bottom Nav */}
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,zIndex:20,background:"#090909",borderTop:"1px solid #141414",display:"flex",paddingBottom:"env(safe-area-inset-bottom,8px)"}}>
          {TABS.map(t => {
            const active = tab===t.id;
            const isAI   = t.id==="chat";
            return (
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"10px 4px 6px",color:active?(isAI?"#c0392b":"#c0392b"):"#2d2d2d",transition:"color 0.15s",position:"relative"}}>
                {isAI && (
                  <div style={{position:"absolute",top:8,right:"calc(50% - 14px)",width:7,height:7,borderRadius:"50%",background:"#4caf50",border:"1px solid #090909"}}/>
                )}
                <t.Icon/>
                <span style={{fontSize:9,fontFamily:"'Bebas Neue'",letterSpacing:1.5}}>{t.label}</span>
                {active&&<div style={{width:14,height:2,background:"#c0392b",borderRadius:99,marginTop:-2}}/>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
