import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

/* ══════════════════════════════════════════════════════════════════════════════
   GLOBAL STYLES
══════════════════════════════════════════════════════════════════════════════ */
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
    html, body { background:#070707; overscroll-behavior:none; }
    input[type=number]::-webkit-inner-spin-button,
    input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; }
    ::-webkit-scrollbar { display:none; }
    input,select,textarea,button { font-family:inherit; }
    textarea { resize:none; }
    select option { background:#0f0f0f; color:#fff; }
    @keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes popIn   { from{opacity:0;transform:scale(0.93)}       to{opacity:1;transform:scale(1)}    }
    @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.25} }
    @keyframes glow    { 0%,100%{box-shadow:0 0 8px #e8b44355} 50%{box-shadow:0 0 20px #e8b44388} }
    .slide-up { animation:slideUp 0.28s cubic-bezier(.22,.68,0,1.2) both; }
    .pop-in   { animation:popIn  0.22s cubic-bezier(.22,.68,0,1.2) both; }
    .pressable { transition:opacity 0.12s,transform 0.12s; }
    .pressable:active { opacity:0.65; transform:scale(0.96); }
    .thinking-dot { width:6px; height:6px; border-radius:50%; animation:pulse 1s infinite; }
    .thinking-dot:nth-child(2) { animation-delay:0.2s; }
    .thinking-dot:nth-child(3) { animation-delay:0.4s; }
  `}</style>
);

/* ══════════════════════════════════════════════════════════════════════════════
   BRAND — GERRARD
   Primary gold: #e8b443  Gym red: #c0392b  Nutrition green: #22c55e
══════════════════════════════════════════════════════════════════════════════ */
const BRAND = "#e8b443";

/* ══════════════════════════════════════════════════════════════════════════════
   STORAGE KEYS & DEFAULT DATA
══════════════════════════════════════════════════════════════════════════════ */
const GYM_KEY  = "gerrard_gym_v1";
const NUTR_KEY = "gerrard_nutr_v1";
const PROF_KEY = "gerrard_prof_v1";
const CHAT_KEY = "gerrard_chat_v1";

const DEFAULT_PROGRAM = {
  name:"Fierce 5", frequency:3,
  workouts:[
    { id:"A", label:"WORKOUT A", color:"#c0392b", exercises:[
      { name:"Squat",          sets:3, reps:5,  increment:2.5,  note:"Linear progression" },
      { name:"Bench Press",    sets:3, reps:5,  increment:2.5,  note:"Linear progression" },
      { name:"Barbell Row",    sets:3, reps:5,  increment:2.5,  note:"Linear progression" },
      { name:"Romanian DL",    sets:3, reps:8,  increment:2.5,  note:"Accessory"          },
      { name:"Dumbbell Press", sets:3, reps:10, increment:1.25, note:"Accessory"          },
    ]},
    { id:"B", label:"WORKOUT B", color:"#1a6fb5", exercises:[
      { name:"Squat",          sets:3, reps:5,  increment:2.5, note:"Linear progression" },
      { name:"Overhead Press", sets:3, reps:5,  increment:2.5, note:"Linear progression" },
      { name:"Deadlift",       sets:1, reps:5,  increment:5,   note:"Linear progression" },
      { name:"Incline Bench",  sets:3, reps:8,  increment:2.5, note:"Accessory"          },
      { name:"Lat Pulldown",   sets:3, reps:10, increment:2.5, note:"Accessory"          },
    ]},
  ],
};

const GOAL_LABELS     = { fat_loss:"Fat Loss", muscle_gain:"Muscle Gain", recomp:"Recomposition", maintenance:"Maintenance" };
const ACTIVITY_LABELS = { sedentary:"Sedentary", light:"Lightly Active", moderate:"Moderately Active", very:"Very Active", athlete:"Athlete" };
const DIET_LABELS     = { halal:"Halal", vegetarian:"Vegetarian", vegan:"Vegan", keto:"Keto", paleo:"Paleo", standard:"Standard" };
const MEAL_COLORS     = { breakfast:"#f59e0b", lunch:"#22c55e", dinner:"#3b82f6", snack:"#a855f7" };

/* ══════════════════════════════════════════════════════════════════════════════
   STORAGE HELPERS
══════════════════════════════════════════════════════════════════════════════ */
const emptyGym  = () => ({ program:DEFAULT_PROGRAM, workouts:[], weights:{}, nextWorkout:"A", startDate:new Date().toISOString() });
const emptyNutr = () => ({ days:{} });
const emptyProf = () => ({ name:"", age:"", sex:"male", heightCm:"", weightKg:"", goal:"muscle_gain", activity:"moderate", diet:"halal", calorieTarget:2500, proteinTarget:180, carbTarget:280, fatTarget:80, setupDone:false });
const emptyChat = () => ([]);

const sGet = async (k, fb) => { try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : fb(); } catch { return fb(); } };
const sSet = async (k, v)  => { try { await window.storage.set(k, JSON.stringify(v)); } catch {} };

/* ══════════════════════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════════════════════ */
const e1rm    = (w,r) => r===1?w:+(w*(1+r/30)).toFixed(1);
const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-AU",{day:"numeric",month:"short"});
const fmtFull = (iso) => new Date(iso).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
const roundKg = (v)   => Math.round(v*4)/4;
const todayISO= ()    => new Date().toISOString().split("T")[0];

function calcTargets(p) {
  const w=parseFloat(p.weightKg),h=parseFloat(p.heightCm),a=parseInt(p.age);
  if(!w||!h||!a) return {calories:p.calorieTarget,protein:p.proteinTarget,carbs:p.carbTarget,fat:p.fatTarget};
  const bmr=p.sex==="male"?10*w+6.25*h-5*a+5:10*w+6.25*h-5*a-161;
  const mults={sedentary:1.2,light:1.375,moderate:1.55,very:1.725,athlete:1.9};
  const tdee=Math.round(bmr*(mults[p.activity]||1.55));
  let cal=tdee;
  if(p.goal==="fat_loss")    cal=Math.round(tdee*0.8);
  if(p.goal==="muscle_gain") cal=Math.round(tdee*1.1);
  const protein=Math.round(w*2.2), fat=Math.round(cal*0.25/9);
  const carbs=Math.round((cal-protein*4-fat*9)/4);
  return {calories:cal,protein,carbs,fat};
}

function predictWeight(name, targetIso, gym) {
  const hist = gym.workouts
    .filter(w=>w.exercises.some(e=>e.name===name))
    .map(w=>{const ex=w.exercises.find(e=>e.name===name);const best=ex.sets.length?Math.max(...ex.sets.map(s=>s.weight)):null;return best?{date:new Date(w.date),weight:best}:null;})
    .filter(Boolean).sort((a,b)=>a.date-b.date);
  const def=gym.program.workouts.flatMap(w=>w.exercises).find(e=>e.name===name);
  const inc=def?.increment??2.5, cur=gym.weights[name]??0;
  if(hist.length<2){if(!cur)return null;const d=Math.max(0,(new Date(targetIso)-new Date())/86400000);return roundKg(cur+Math.floor((d/7)*gym.program.frequency)*inc);}
  const t0=hist[0].date.getTime(),xs=hist.map(h=>(h.date.getTime()-t0)/86400000),ys=hist.map(h=>h.weight);
  const n=xs.length,mx=xs.reduce((a,x)=>a+x,0)/n,my=ys.reduce((a,y)=>a+y,0)/n;
  const slope=xs.reduce((a,x,i)=>a+(x-mx)*(ys[i]-my),0)/xs.reduce((a,x)=>a+(x-mx)**2,0);
  const p=(my-slope*mx)+slope*((new Date(targetIso).getTime()-t0)/86400000);
  return p>0?roundKg(p):null;
}

/* ══════════════════════════════════════════════════════════════════════════════
   ICONS
══════════════════════════════════════════════════════════════════════════════ */
const Ic = {
  bolt:    ()=><svg viewBox="0 0 24 24" fill="currentColor"               style={{width:16,height:16}}><path d="M13 2L4.09 12.26a1 1 0 00.82 1.6H11l-1 8.14 8.91-10.26a1 1 0 00-.82-1.6H13l1-8.14z"/></svg>,
  barbell: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><rect x="1" y="10" width="3" height="4" rx="1"/><rect x="20" y="10" width="3" height="4" rx="1"/><rect x="4" y="8" width="3" height="8" rx="1"/><rect x="17" y="8" width="3" height="8" rx="1"/><line x1="7" y1="12" x2="17" y2="12" strokeWidth="2.5"/></svg>,
  leaf:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M11 20A7 7 0 014 13c0-5 3-10 9-11 0 0 0 5-5 9 3 0 6-2 8-5 0 6-2 10-5 14z"/></svg>,
  chart:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  chat:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  history: ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 100.5-4M3 4v4h4"/></svg>,
  check:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"   style={{width:14,height:14}}><polyline points="20 6 9 17 4 12"/></svg>,
  trash:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   style={{width:14,height:14}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>,
  send:    ()=><svg viewBox="0 0 24 24" fill="currentColor"               style={{width:16,height:16}}><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>,
  pencil:  ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   style={{width:14,height:14}}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  close:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:16,height:16}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  plus:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{width:16,height:16}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  home:    ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   style={{width:18,height:18}}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  apple:   ()=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"   style={{width:18,height:18}}><path d="M12 2a3 3 0 013 3M9 6C5 6 3 9 3 12c0 5 3 9 5 9 1 0 2-1 4-1s3 1 4 1c2 0 5-4 5-9 0-3-2-6-6-6H9z"/></svg>,
  star:    ()=><svg viewBox="0 0 24 24" fill="currentColor"               style={{width:18,height:18}}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
};

/* ── Shared styles ─────────────────────────────────────────────────────────── */
const inp = { width:"100%", background:"#111", border:"1px solid #222", borderRadius:10, color:"#fff", padding:"12px 14px", fontSize:15, outline:"none" };
const lbl = { display:"block", color:"#444", fontSize:11, textTransform:"uppercase", letterSpacing:1.5, marginBottom:6 };

/* ── Markdown renderer ─────────────────────────────────────────────────────── */
function renderMd(text) {
  return text.split("\n").map((line,i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p,j) =>
      p.startsWith("**")&&p.endsWith("**") ? <strong key={j} style={{color:"#e8e8e8"}}>{p.slice(2,-2)}</strong> : p
    );
    const bullet = line.trim().startsWith("•")||line.trim().startsWith("-");
    return <div key={i} style={{marginBottom:line===""?6:2,paddingLeft:bullet?4:0,color:bullet?"#aaa":"#c8c8c8",fontSize:14,lineHeight:1.65}}>{parts}</div>;
  });
}

function ThinkingDots() {
  return (
    <div style={{display:"flex",gap:6,alignItems:"center",padding:"14px 16px",background:"#111",border:"1px solid #1e1e1e",borderRadius:"4px 16px 16px 16px"}}>
      {[0,1,2].map(i=><div key={i} className="thinking-dot" style={{background:BRAND,animationDelay:`${i*0.2}s`}}/>)}
    </div>
  );
}

/* ── Modal shell ───────────────────────────────────────────────────────────── */
function Modal({ title, onClose, children }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.9)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{width:"100%",maxWidth:480,background:"#0d0d0d",border:"1px solid #222",borderRadius:"20px 20px 0 0",maxHeight:"92vh",overflow:"auto",padding:"20px 20px 44px"}} onClick={e=>e.stopPropagation()} className="slide-up">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2,color:"#fff"}}>{title}</div>
          <button onClick={onClose} style={{background:"#1a1a1a",border:"none",borderRadius:8,color:"#666",padding:8,cursor:"pointer"}}><Ic.close/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   GERRARD AI COACH — single unified coach for gym + nutrition
   System prompt merges Apex Health Coach + Gym Coach
══════════════════════════════════════════════════════════════════════════════ */
const GERRARD_PERSONA = `You are Gerrard, a world-class AI personal coach combining elite strength coaching and expert nutritionist knowledge into one unified assistant. You are the user's complete health partner.

YOUR IDENTITY:
- Name: Gerrard
- Role: Combined Strength Coach + Nutritionist + Lifestyle Optimizer
- Personality: Encouraging, direct, knowledgeable, Australian-friendly. Never judgmental. Like a mate who happens to be an expert.

YOUR DUAL EXPERTISE:

🏋️ GYM & STRENGTH:
- Design, modify, and manage workout programs (Fierce 5, PPL, 5/3/1, Starting Strength, etc.)
- Track progressive overload and suggest weight increments (in KG - user is in Australia)
- Log and analyse workout sessions
- Provide exercise form cues, modifications, alternatives
- Manage deloads, plateaus, and injury-safe progressions
- All weights in KILOGRAMS

🥗 NUTRITION & DIET:
- Calculate TDEE, calorie targets, and macro splits
- Log and estimate meals using Australian portion references
- Suggest meals and recipes using ingredients available in Australia
- Portion guidance: Protein=palm size, Carbs=cupped hand, Fats=thumb, Veg=fist
- Always show calories, protein (g), and portion size
- Halal-friendly by default unless stated otherwise
- Budget-friendly, easy to prepare, repeatable meals

🔄 COMBINED COACHING:
- Analyse how nutrition supports training goals
- Adjust nutrition on gym days vs rest days
- Suggest pre/post workout meals based on what user has logged
- Connect dots between sleep, stress, training performance, and diet
- Give holistic daily check-ins covering both domains

CORE PRINCIPLES:
- Evidence-based and practical
- Long-term adherence over short-term extremes  
- Simple, clear, actionable advice
- Supportive — NEVER shame, guilt, or intimidate
- Adapt dynamically to user feedback

RESPONSE FORMAT:
- Use **bold** for key points
- Use • bullet points for lists
- Short paragraphs — no walls of text
- Always end with 1 actionable next step
- Friendly Australian tone

PROGRAM CHANGES (gym):
When user asks to modify their program, respond with JSON:
{"message":"your reply","action":{"type":"UPDATE_GYM","data":{complete updated gym data}}}

MEAL LOGGING:
When user describes food they ate and asks to log it, respond with JSON:
{"message":"your reply","action":{"type":"LOG_MEAL","meal":{"name":"...","calories":0,"protein":0,"carbs":0,"fat":0,"mealType":"lunch","portion":"..."}}}

For everything else (advice, questions, analysis), respond with plain text only — no JSON.

SAFETY: Never provide medical diagnosis or treatment. Recommend professional consultation for medical conditions.`;

function GerrardChat({ gymData, nutrData, profile, onGymChange, onNutrChange, chatHistory, onChatHistoryChange }) {
  const today    = todayISO();
  const dayMeals = nutrData.days[today]?.meals || [];
  const totals   = dayMeals.reduce((a,m)=>({cal:a.cal+(m.calories||0),prot:a.prot+(m.protein||0),carbs:a.carbs+(m.carbs||0),fat:a.fat+(m.fat||0)}),{cal:0,prot:0,carbs:0,fat:0});

  const buildContext = () => `
=== USER PROFILE ===
Name: ${profile.name||"User"} | Age: ${profile.age||"?"} | Sex: ${profile.sex}
Height: ${profile.heightCm}cm | Weight: ${profile.weightKg}kg
Goal: ${GOAL_LABELS[profile.goal]||profile.goal} | Activity: ${ACTIVITY_LABELS[profile.activity]||profile.activity}
Diet preference: ${DIET_LABELS[profile.diet]||profile.diet} | Location: Australia

=== NUTRITION TARGETS ===
Calories: ${profile.calorieTarget} kcal | Protein: ${profile.proteinTarget}g | Carbs: ${profile.carbTarget}g | Fat: ${profile.fatTarget}g

=== TODAY'S NUTRITION (${today}) ===
Eaten: ${totals.cal} / ${profile.calorieTarget} kcal (${profile.calorieTarget-totals.cal} remaining)
Protein: ${totals.prot}g / ${profile.proteinTarget}g | Carbs: ${totals.carbs}g | Fat: ${totals.fat}g
Meals logged: ${dayMeals.length===0?"None yet":dayMeals.map(m=>`${m.name} (${m.calories}kcal, ${m.protein}g protein, ${m.mealType})`).join(" | ")}

=== GYM PROGRAM ===
Program: ${gymData.program.name} | Frequency: ${gymData.program.frequency}x/week
Next session: ${gymData.nextWorkout}
${gymData.program.workouts.map(w=>`${w.label}: ${w.exercises.map(e=>`${e.name} ${e.sets}×${e.reps} (+${e.increment}kg)`).join(", ")}`).join("\n")}

=== CURRENT WORKING WEIGHTS ===
${Object.entries(gymData.weights).length===0?"No weights logged yet":Object.entries(gymData.weights).map(([n,w])=>`${n}: ${w}kg`).join(" | ")}

=== RECENT GYM SESSIONS ===
${gymData.workouts.slice(0,3).map(w=>`${fmtDate(w.date)} ${w.label}: ${w.exercises.map(e=>`${e.name}(${e.sets.map(s=>`${s.weight}×${s.reps}`).join(",")})`).join(", ")}`).join("\n")||"No sessions logged yet"}
`;

  const defaultGreeting = profile.name
    ? `G'day ${profile.name}! I'm **Gerrard**, your all-in-one coach 💪\n\nI handle both your **gym program** and **nutrition** in one place — no switching between coaches.\n\nHere's what I can do:\n• **"What should I eat after today's workout?"**\n• **"Change my squat to 4 sets of 3"**\n• **"Am I hitting my protein today?"**\n• **"Give me a high-protein dinner idea"**\n• **"Log my lunch — chicken salad and a protein shake"**\n• **"How's my progress going?"**\n\nWhat do you need today, mate?`
    : `G'day! I'm **Gerrard**, your all-in-one gym and nutrition coach 💪\n\nAsk me anything about your training or diet and I'll get you sorted.`;

  const initMessages = chatHistory.length > 0
    ? chatHistory
    : [{ role:"assistant", content: defaultGreeting }];

  const [msgs, setMsgs]       = useState(initMessages);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [msgs, loading]);

  // Persist chat to storage whenever messages change
  useEffect(() => {
    if (msgs.length > 1) onChatHistoryChange(msgs);
  }, [msgs]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg = { role:"user", content:text };
    const updated = [...msgs, userMsg];
    setMsgs(updated);
    setLoading(true);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1400,
          system: GERRARD_PERSONA + "\n\n" + buildContext(),
          messages: updated.map(m=>({role:m.role, content:m.content})),
        })
      });
      const data  = await res.json();
      const raw   = data.content?.[0]?.text || "{}";

      // Try to parse as JSON (for actions), fall back to plain text
      let parsed = null;
      try {
        const clean = raw.replace(/```json\n?|\n?```/g,"").trim();
        if (clean.startsWith("{")) parsed = JSON.parse(clean);
      } catch {}

      const asst = { role:"assistant", content: parsed?.message || raw, badges:[] };

      if (parsed?.action) {
        // GYM UPDATE
        if (parsed.action.type==="UPDATE_GYM" && parsed.action.data) {
          await onGymChange(parsed.action.data);
          asst.badges.push({ text:"✓ Program updated", color:"#c0392b" });
        }
        // MEAL LOG
        if (parsed.action.type==="LOG_MEAL" && parsed.action.meal) {
          const meal = { ...parsed.action.meal, id:Date.now(),
            time:new Date().toLocaleTimeString("en-AU",{hour:"2-digit",minute:"2-digit"}) };
          const dayData = nutrData.days[today]?.meals || [];
          const newNutr = { ...nutrData, days:{ ...nutrData.days, [today]:{ meals:[...dayData, meal] } } };
          await onNutrChange(newNutr);
          asst.badges.push({ text:`✓ Logged: ${meal.name} (${meal.calories} kcal)`, color:"#22c55e" });
        }
      }

      setMsgs(prev => [...prev, asst]);
    } catch {
      setMsgs(prev => [...prev, { role:"assistant", content:"Connection issue. Check your network and try again.", badges:[] }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => { if (e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} };

  const clearChat = async () => {
    const fresh = [{ role:"assistant", content: defaultGreeting }];
    setMsgs(fresh);
    await onChatHistoryChange(fresh);
  };

  const SUGG = [
    "Am I on track today?",
    "What should I eat for dinner?",
    "How's my training progress?",
    "Log my lunch — rice and chicken",
    "Change bench to 4 sets of 5",
    "Pre-workout meal idea",
    "Switch to PPL routine",
    "Hit my protein today?",
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 148px)"}}>
      {/* Coach header */}
      <div style={{flexShrink:0,marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          {/* Gerrard avatar */}
          <div style={{
            width:44,height:44,borderRadius:12,flexShrink:0,
            background:`linear-gradient(135deg,#1a1a1a,#2a2a2a)`,
            border:`2px solid ${BRAND}`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:20,
          }}>⚡</div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:3,color:BRAND,lineHeight:1}}>GERRARD</div>
              <div style={{background:"#0a1a0a",border:"1px solid #1a3a1a",borderRadius:20,padding:"2px 9px",fontSize:10,color:"#22c55e",display:"flex",alignItems:"center",gap:4}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#22c55e"}}/>ONLINE
              </div>
            </div>
            <div style={{color:"#444",fontSize:11,letterSpacing:1}}>GYM + NUTRITION COACH · AI POWERED</div>
          </div>
          <button onClick={clearChat} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,color:"#333",padding:"6px 10px",cursor:"pointer",fontSize:11}}>
            Clear
          </button>
        </div>

        {/* Live context strip */}
        <div style={{background:"#0d0d0d",border:`1px solid ${BRAND}22`,borderRadius:10,padding:"8px 12px",display:"flex",gap:0,overflow:"hidden"}}>
          <div style={{flex:1,textAlign:"center",borderRight:"1px solid #1a1a1a",paddingRight:8}}>
            <div style={{color:"#3a3a3a",fontSize:9,letterSpacing:1,textTransform:"uppercase"}}>Calories</div>
            <div style={{color:totals.cal>profile.calorieTarget?"#ef4444":"#22c55e",fontFamily:"'Bebas Neue'",fontSize:16}}>{totals.cal}<span style={{color:"#333",fontSize:11}}>/{profile.calorieTarget}</span></div>
          </div>
          <div style={{flex:1,textAlign:"center",borderRight:"1px solid #1a1a1a",padding:"0 8px"}}>
            <div style={{color:"#3a3a3a",fontSize:9,letterSpacing:1,textTransform:"uppercase"}}>Protein</div>
            <div style={{color:"#3b82f6",fontFamily:"'Bebas Neue'",fontSize:16}}>{totals.prot}<span style={{color:"#333",fontSize:11}}>g</span></div>
          </div>
          <div style={{flex:1,textAlign:"center",borderRight:"1px solid #1a1a1a",padding:"0 8px"}}>
            <div style={{color:"#3a3a3a",fontSize:9,letterSpacing:1,textTransform:"uppercase"}}>Next</div>
            <div style={{color:"#c0392b",fontFamily:"'Bebas Neue'",fontSize:16}}>{gymData.nextWorkout}</div>
          </div>
          <div style={{flex:1,textAlign:"center",paddingLeft:8}}>
            <div style={{color:"#3a3a3a",fontSize:9,letterSpacing:1,textTransform:"uppercase"}}>Sessions</div>
            <div style={{color:BRAND,fontFamily:"'Bebas Neue'",fontSize:16}}>{gymData.workouts.length}</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:10,paddingBottom:8}}>
        {msgs.map((m,i) => (
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start",animation:"slideUp 0.2s ease both"}}>
            {m.role==="assistant" && (
              <div style={{
                width:30,height:30,borderRadius:9,flexShrink:0,
                background:`linear-gradient(135deg,#1a1a1a,#252525)`,
                border:`1.5px solid ${BRAND}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:14,marginRight:8,marginTop:2,
              }}>⚡</div>
            )}
            <div style={{maxWidth:"84%"}}>
              {/* Action badges */}
              {m.badges?.length>0 && m.badges.map((b,bi)=>(
                <div key={bi} style={{display:"flex",alignItems:"center",gap:5,marginBottom:6,padding:"4px 10px",background:b.color+"18",border:`1px solid ${b.color}44`,borderRadius:7}}>
                  <span style={{color:b.color,fontSize:12,fontWeight:700}}>{b.text}</span>
                </div>
              ))}
              <div style={{
                background: m.role==="user" ? `linear-gradient(135deg,${BRAND},#c8962a)` : "#111",
                border: m.role==="user" ? "none" : "1px solid #1e1e1e",
                borderRadius: m.role==="user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
                padding:"11px 14px",
              }}>
                {m.role==="user"
                  ? <div style={{color:"#000",fontSize:14,lineHeight:1.6,fontWeight:600}}>{m.content}</div>
                  : renderMd(m.content)
                }
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
            <div style={{width:30,height:30,borderRadius:9,flexShrink:0,background:"linear-gradient(135deg,#1a1a1a,#252525)",border:`1.5px solid ${BRAND}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⚡</div>
            <ThinkingDots/>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Quick suggestion chips */}
      {msgs.length <= 2 && (
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,flexShrink:0}}>
          {SUGG.map((s,i) => (
            <button key={i} onClick={()=>setInput(s)} className="pressable"
              style={{flexShrink:0,background:"#0f0f0f",border:`1px solid ${BRAND}33`,borderRadius:20,color:"#888",padding:"6px 12px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{display:"flex",gap:8,alignItems:"flex-end",flexShrink:0,paddingTop:8,borderTop:`1px solid ${BRAND}22`}}>
        <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask Gerrard anything — gym or nutrition..."
          rows={1}
          style={{flex:1,background:"#0d0d0d",border:`1px solid ${BRAND}33`,borderRadius:12,color:"#fff",padding:"12px 14px",fontSize:14,lineHeight:1.5,outline:"none",maxHeight:100,overflowY:"auto"}}
          onInput={e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,100)+"px";}}
        />
        <button onClick={send} disabled={!input.trim()||loading}
          style={{width:44,height:44,borderRadius:12,border:"none",cursor:"pointer",
            background:input.trim()&&!loading?`linear-gradient(135deg,${BRAND},#c8962a)`:"#111",
            color:input.trim()&&!loading?"#000":"#333",
            display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s",flexShrink:0}}>
          <Ic.send/>
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   HOME DASHBOARD
══════════════════════════════════════════════════════════════════════════════ */
function HomeTab({ gymData, nutrData, profile, onSection, onGymTab, onNutrTab }) {
  const today    = todayISO();
  const dayMeals = nutrData.days[today]?.meals||[];
  const tot = dayMeals.reduce((a,m)=>({cal:a.cal+(m.calories||0),prot:a.prot+(m.protein||0)}),{cal:0,prot:0});
  const nextWk = gymData.program.workouts.find(w=>w.id===gymData.nextWorkout)||gymData.program.workouts[0];
  const calPct = Math.min(tot.cal/profile.calorieTarget*100,100);
  const protPct= Math.min(tot.prot/profile.proteinTarget*100,100);

  return (
    <div className="slide-up">
      <div style={{marginBottom:20}}>
        <div style={{color:"#333",fontSize:12,marginBottom:3}}>{new Date().toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"})}</div>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,letterSpacing:3,color:"#fff",lineHeight:1}}>
          {profile.name?`G'DAY, ${profile.name.toUpperCase()}`:"DASHBOARD"}
        </div>
        <div style={{color:"#333",fontSize:13,marginTop:3}}>{GOAL_LABELS[profile.goal]||"Your daily overview"}</div>
      </div>

      {/* Stats grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <button onClick={()=>{onSection("nutr");onNutrTab("nutrDash");}} className="pressable"
          style={{background:"#0c0c0c",border:"1px solid #1a1a1a",borderRadius:14,padding:14,textAlign:"left",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
            <div style={{width:22,height:22,background:"#22c55e22",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:"#22c55e"}}><Ic.leaf/></div>
            <span style={{color:"#444",fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Calories</span>
          </div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:26,color:tot.cal>profile.calorieTarget?"#ef4444":"#fff",letterSpacing:1,lineHeight:1}}>{tot.cal}</div>
          <div style={{color:"#333",fontSize:11,marginBottom:7}}>/ {profile.calorieTarget} kcal</div>
          <div style={{height:3,background:"#1a1a1a",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:99,background:tot.cal>profile.calorieTarget?"#ef4444":"#22c55e",width:`${calPct}%`,transition:"width 0.4s"}}/>
          </div>
        </button>

        <button onClick={()=>{onSection("nutr");onNutrTab("nutrDash");}} className="pressable"
          style={{background:"#0c0c0c",border:"1px solid #1a1a1a",borderRadius:14,padding:14,textAlign:"left",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
            <div style={{width:22,height:22,background:"#3b82f622",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",color:"#3b82f6"}}><Ic.bolt/></div>
            <span style={{color:"#444",fontSize:11,textTransform:"uppercase",letterSpacing:1}}>Protein</span>
          </div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:26,color:"#fff",letterSpacing:1,lineHeight:1}}>{tot.prot}g</div>
          <div style={{color:"#333",fontSize:11,marginBottom:7}}>/ {profile.proteinTarget}g target</div>
          <div style={{height:3,background:"#1a1a1a",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:99,background:"#3b82f6",width:`${protPct}%`,transition:"width 0.4s"}}/>
          </div>
        </button>
      </div>

      {/* Next workout */}
      <button onClick={()=>{onSection("gym");onGymTab("workout");}} className="pressable"
        style={{width:"100%",background:`linear-gradient(135deg,${nextWk.color}18,#0c0c0c)`,border:`1px solid ${nextWk.color}33`,borderRadius:14,padding:16,marginBottom:10,textAlign:"left",cursor:"pointer"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{color:nextWk.color,fontSize:11,fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>{gymData.program.name} · Up Next</div>
            <div style={{fontFamily:"'Bebas Neue'",fontSize:22,color:"#fff",letterSpacing:2}}>{nextWk.label}</div>
            <div style={{color:"#444",fontSize:12,marginTop:2}}>{nextWk.exercises.map(e=>e.name).join(" · ")}</div>
          </div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:44,color:nextWk.color,opacity:0.2}}>{nextWk.id}</div>
        </div>
      </button>

      {/* Ask Gerrard banner */}
      <button onClick={()=>onSection("coach")} className="pressable"
        style={{width:"100%",background:`linear-gradient(135deg,${BRAND}18,#1a1500)`,border:`1px solid ${BRAND}44`,borderRadius:14,padding:16,marginBottom:12,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:40,height:40,borderRadius:10,background:`linear-gradient(135deg,#1a1a1a,#252525)`,border:`2px solid ${BRAND}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>⚡</div>
        <div>
          <div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2,color:BRAND}}>ASK GERRARD</div>
          <div style={{color:"#555",fontSize:12,marginTop:1}}>Your AI coach for gym + nutrition — one conversation</div>
        </div>
      </button>

      {/* Quick actions */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <button onClick={()=>{onSection("gym");onGymTab("workout");}} className="pressable"
          style={{background:"linear-gradient(135deg,#c0392b,#9a2a1e)",border:"none",borderRadius:12,color:"#fff",padding:"13px 10px",cursor:"pointer",fontFamily:"'Bebas Neue'",fontSize:15,letterSpacing:2,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
          <Ic.barbell/> START SESSION
        </button>
        <button onClick={()=>{onSection("nutr");onNutrTab("nutrDash");}} className="pressable"
          style={{background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:12,color:"#fff",padding:"13px 10px",cursor:"pointer",fontFamily:"'Bebas Neue'",fontSize:15,letterSpacing:2,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
          <Ic.apple/> LOG MEAL
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   GYM TABS
══════════════════════════════════════════════════════════════════════════════ */
function GymTodayTab({ gymData, onSave }) {
  const wk=gymData.program.workouts.find(w=>w.id===gymData.nextWorkout)||gymData.program.workouts[0];
  const accent=wk.color;
  const init=()=>wk.exercises.map(ex=>({name:ex.name,scheme:`${ex.sets}×${ex.reps}`,increment:ex.increment,note:ex.note,sets:Array.from({length:ex.sets},()=>({weight:String(gymData.weights[ex.name]??""),reps:String(ex.reps),done:false}))}));
  const [exercises,setEx]=useState(init);
  const [saved,setSaved]=useState(false);
  const [open,setOpen]=useState(0);
  const done=exercises.reduce((a,ex)=>a+ex.sets.filter(s=>s.done).length,0);
  const total=exercises.reduce((a,ex)=>a+ex.sets.length,0);
  const allDone=done===total&&total>0;
  const tog=(ei,si)=>setEx(p=>p.map((ex,i)=>i!==ei?ex:{...ex,sets:ex.sets.map((s,j)=>j!==si?s:{...s,done:!s.done})}));
  const upd=(ei,si,f,v)=>setEx(p=>p.map((ex,i)=>i!==ei?ex:{...ex,sets:ex.sets.map((s,j)=>j!==si?s:{...s,[f]:v})}));
  const finish=async()=>{
    const nw={...gymData.weights};
    const logged=exercises.map(ex=>{const ds=ex.sets.filter(s=>s.done&&s.weight&&s.reps).map(s=>({weight:parseFloat(s.weight),reps:parseInt(s.reps)}));if(ds.length)nw[ex.name]=Math.max(...ds.map(s=>s.weight));return{name:ex.name,scheme:ex.scheme,sets:ds};}).filter(ex=>ex.sets.length);
    if(!logged.length)return;
    const ni=(gymData.program.workouts.findIndex(w=>w.id===gymData.nextWorkout)+1)%gymData.program.workouts.length;
    await onSave({...gymData,workouts:[{id:Date.now(),date:new Date().toISOString(),workout:wk.id,label:wk.label,exercises:logged},...gymData.workouts],weights:nw,nextWorkout:gymData.program.workouts[ni].id});
    setSaved(true);
  };
  if(saved)return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",gap:16,textAlign:"center"}} className="pop-in"><div style={{fontSize:64}}>💪</div><div style={{fontFamily:"'Bebas Neue'",fontSize:38,color:"#fff",letterSpacing:3}}>SESSION DONE</div><div style={{color:"#555",fontSize:14}}>Rest up. Come back stronger.</div></div>);
  return(
    <div className="slide-up">
      <div style={{marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
          <span style={{background:accent,borderRadius:5,padding:"2px 9px",fontFamily:"'Bebas Neue'",fontSize:12,letterSpacing:2,color:"#fff"}}>{gymData.program.name}</span>
          <span style={{color:"#383838",fontSize:12}}>{new Date().toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"short"})}</span>
        </div>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:34,letterSpacing:3,color:"#fff",lineHeight:1}}>{wk.label}</div>
        <div style={{marginTop:10,display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1,height:3,background:"#181818",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",borderRadius:99,background:accent,width:`${total?(done/total)*100:0}%`,transition:"width 0.35s ease"}}/></div>
          <span style={{color:"#383838",fontSize:12,flexShrink:0}}>{done}/{total} sets</span>
        </div>
      </div>
      {exercises.map((ex,ei)=>{
        const exDone=ex.sets.every(s=>s.done),isOpen=open===ei,lastW=gymData.weights[ex.name],sug=lastW!=null?roundKg(lastW+ex.increment):null;
        return(
          <div key={ei} style={{background:"#0d0d0d",border:`1px solid ${exDone?accent+"55":"#1b1b1b"}`,borderRadius:12,marginBottom:9,overflow:"hidden",transition:"border-color 0.2s"}}>
            <button onClick={()=>setOpen(isOpen?null:ei)} style={{width:"100%",background:"none",border:"none",cursor:"pointer",padding:"13px 15px",display:"flex",alignItems:"center",gap:11,textAlign:"left"}}>
              <div style={{width:28,height:28,borderRadius:7,flexShrink:0,background:exDone?accent:"#181818",border:`1px solid ${exDone?accent:"#252525"}`,display:"flex",alignItems:"center",justifyContent:"center",color:exDone?"#fff":"#3a3a3a",transition:"all 0.2s"}}>{exDone?<Ic.check/>:<span style={{fontSize:11,fontWeight:700}}>{ei+1}</span>}</div>
              <div style={{flex:1}}>
                <div style={{color:exDone?"#666":"#e8e8e8",fontSize:15,fontWeight:700}}>{ex.name}</div>
                <div style={{color:"#3a3a3a",fontSize:12,marginTop:1}}>{ex.scheme} · {ex.note}</div>
              </div>
              <div style={{color:"#2a2a2a",fontSize:22}}>{isOpen?"−":"+"}</div>
            </button>
            {isOpen&&(
              <div style={{padding:"0 15px 15px"}}>
                {sug!=null&&<div style={{background:"#0f1a0f",border:"1px solid #1a2e1a",borderRadius:8,padding:"8px 12px",marginBottom:10,display:"flex",alignItems:"center",gap:8}}><span style={{color:"#4caf50",fontSize:12}}>↑</span><span style={{color:"#4a7a4a",fontSize:12}}>Last: <b style={{color:"#6aaa6a"}}>{lastW}kg</b> · Try: <b style={{color:"#4caf50"}}>{sug}kg</b></span></div>}
                <div style={{display:"grid",gridTemplateColumns:"24px 1fr 1fr 44px",gap:8,marginBottom:5}}><div/>{["WEIGHT (kg)","REPS"].map(h=><div key={h} style={{color:"#2d2d2d",fontSize:10,textTransform:"uppercase",letterSpacing:1,textAlign:"center"}}>{h}</div>)}<div/></div>
                {ex.sets.map((s,si)=>(
                  <div key={si} style={{display:"grid",gridTemplateColumns:"24px 1fr 1fr 44px",gap:8,alignItems:"center",marginBottom:7,background:s.done?"#0d1a0d":"transparent",borderRadius:8,padding:"5px 3px",transition:"background 0.2s"}}>
                    <div style={{color:"#333",fontSize:12,textAlign:"center"}}>{si+1}</div>
                    <input type="number" value={s.weight} onChange={e=>upd(ei,si,"weight",e.target.value)} placeholder="0" style={{background:"#141414",border:`1px solid ${s.done?"#1c361c":"#212121"}`,borderRadius:8,color:s.done?"#4caf50":"#fff",padding:"10px 6px",fontSize:16,textAlign:"center",width:"100%"}}/>
                    <input type="number" value={s.reps} onChange={e=>upd(ei,si,"reps",e.target.value)} placeholder="0" style={{background:"#141414",border:`1px solid ${s.done?"#1c361c":"#212121"}`,borderRadius:8,color:s.done?"#4caf50":"#fff",padding:"10px 6px",fontSize:16,textAlign:"center",width:"100%"}}/>
                    <button onClick={()=>tog(ei,si)} style={{width:44,height:44,borderRadius:8,border:"none",cursor:"pointer",background:s.done?"#153015":"#181818",color:s.done?"#4caf50":"#2d2d2d",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s"}}><Ic.check/></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <button onClick={finish} disabled={done===0} style={{width:"100%",marginTop:6,background:allDone?`linear-gradient(135deg,${accent},${accent}bb)`:done>0?"#161616":"#0d0d0d",border:`1px solid ${done>0?accent+"55":"#181818"}`,borderRadius:12,color:done>0?"#fff":"#2a2a2a",padding:16,cursor:done>0?"pointer":"default",fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:3,boxShadow:allDone?`0 4px 24px ${accent}44`:"none",transition:"all 0.2s"}}>
        {allDone?"⚡ FINISH SESSION":done>0?"FINISH SESSION":"COMPLETE SETS TO FINISH"}
      </button>
    </div>
  );
}

function GymProgressTab({ gymData }) {
  const allEx=[...new Set(gymData.program.workouts.flatMap(w=>w.exercises.map(e=>e.name)))];
  const [sel,setSel]=useState(allEx[0]||"Squat");
  const cd=[...gymData.workouts].reverse().filter(w=>w.exercises.some(e=>e.name===sel)).map(w=>{const ex=w.exercises.find(e=>e.name===sel);const best=ex.sets.length?Math.max(...ex.sets.map(s=>e1rm(s.weight,s.reps))):0;return{date:fmtDate(w.date),e1rm:best,weight:ex.sets.length?Math.max(...ex.sets.map(s=>s.weight)):0};});
  const best=cd.length?Math.max(...cd.map(d=>d.e1rm)):0;
  const gain=cd.length>1?cd[cd.length-1].e1rm-cd[0].e1rm:0;
  return(
    <div className="slide-up">
      <div style={{fontFamily:"'Bebas Neue'",fontSize:30,letterSpacing:3,color:"#fff",marginBottom:4}}>STRENGTH GAINS</div>
      <div style={{color:"#444",fontSize:13,marginBottom:14}}>Estimated 1-rep max over time</div>
      <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:8,marginBottom:14}}>
        {allEx.map(ex=><button key={ex} onClick={()=>setSel(ex)} className="pressable" style={{flexShrink:0,border:"none",borderRadius:20,cursor:"pointer",padding:"7px 14px",fontSize:13,fontWeight:600,background:sel===ex?"#c0392b":"#111",color:sel===ex?"#fff":"#555",outline:sel===ex?"none":"1px solid #1e1e1e"}}>{ex}</button>)}
      </div>
      {!cd.length?<div style={{textAlign:"center",padding:"40px 20px",color:"#333"}}><div style={{fontSize:36,marginBottom:10}}>📊</div><div>No data yet for {sel}</div></div>:(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
            {[{l:"BEST E1RM",v:`${best}kg`,c:"#fff"},{l:"LAST WEIGHT",v:`${cd[cd.length-1].weight}kg`,c:"#fff"},{l:"GAIN",v:gain>=0?`+${gain}kg`:`${gain}kg`,c:gain>=0?"#4caf50":"#ef4444"}].map(s=>(
              <div key={s.l} style={{background:"#0f0f0f",border:"1px solid #1a1a1a",borderRadius:10,padding:"12px 8px",textAlign:"center"}}>
                <div style={{color:"#3a3a3a",fontSize:9,letterSpacing:1.5,textTransform:"uppercase",marginBottom:4}}>{s.l}</div>
                <div style={{color:s.c,fontFamily:"'Bebas Neue'",fontSize:20}}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{background:"#0a0a0a",border:"1px solid #1a1a1a",borderRadius:12,padding:"14px 4px 8px"}}>
            <ResponsiveContainer width="100%" height={165}>
              <LineChart data={cd} margin={{top:4,right:10,left:-22,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#151515"/>
                <XAxis dataKey="date" tick={{fill:"#333",fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:"#333",fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{background:"#111",border:"1px solid #2a2a2a",borderRadius:8,color:"#fff",fontSize:12}} labelStyle={{color:"#888",marginBottom:4}} formatter={v=>[`${v}kg`]}/>
                <Line type="monotone" dataKey="e1rm" stroke="#c0392b" strokeWidth={2.5} dot={{fill:"#c0392b",r:4,strokeWidth:0}} activeDot={{r:6}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

function GymLogTab({ gymData, onDelete }) {
  if(!gymData.workouts.length)return(<div style={{textAlign:"center",padding:"60px 20px",color:"#282828"}} className="slide-up"><div style={{fontSize:40,marginBottom:10}}>🏋️</div><div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:2,color:"#333"}}>NO SESSIONS YET</div></div>);
  return(
    <div className="slide-up">
      <div style={{fontFamily:"'Bebas Neue'",fontSize:30,letterSpacing:3,color:"#fff",marginBottom:4}}>GYM LOG</div>
      <div style={{color:"#3a3a3a",fontSize:13,marginBottom:16}}>{gymData.workouts.length} sessions recorded</div>
      {gymData.workouts.map(w=>{
        const c=gymData.program.workouts.find(x=>x.id===w.workout)?.color||"#c0392b";
        return(
          <div key={w.id} style={{background:"#0b0b0b",border:"1px solid #181818",borderLeft:`3px solid ${c}`,borderRadius:12,marginBottom:10,padding:"13px 15px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                  <span style={{background:c+"22",color:c,fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20,letterSpacing:1}}>{w.label}</span>
                  <span style={{color:"#2d2d2d",fontSize:12}}>{fmtFull(w.date)}</span>
                </div>
              </div>
              <button onClick={()=>onDelete(w.id)} style={{background:"none",border:"none",color:"#252525",cursor:"pointer",padding:4}}><Ic.trash/></button>
            </div>
            {w.exercises.map((ex,i)=>(
              <div key={i} style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:5}}>
                <span style={{color:"#484848",fontSize:13,minWidth:100}}>{ex.name}</span>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  {ex.sets.map((s,j)=><span key={j} style={{background:"#141414",borderRadius:5,padding:"2px 7px",fontSize:12,color:"#7a7a7a"}}>{s.weight}×{s.reps}</span>)}
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
   NUTRITION TABS
══════════════════════════════════════════════════════════════════════════════ */
function CalRing({ calories, target }) {
  const circ=2*Math.PI*68,pct=Math.min(calories/target,1),over=calories>target;
  return(
    <div style={{position:"relative",width:168,height:168,margin:"0 auto"}}>
      <svg width={168} height={168} style={{transform:"rotate(-90deg)"}}>
        <circle cx={84} cy={84} r={68} fill="none" stroke="#1a1a1a" strokeWidth={13}/>
        <circle cx={84} cy={84} r={68} fill="none" stroke={over?"#ef4444":"#22c55e"} strokeWidth={13} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-pct)} style={{transition:"stroke-dashoffset 0.6s ease,stroke 0.3s"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:over?"#ef4444":"#fff",letterSpacing:1,lineHeight:1}}>{calories}</div>
        <div style={{color:"#3a3a3a",fontSize:11}}>/ {target} kcal</div>
        <div style={{color:over?"#ef4444":"#22c55e",fontSize:11,fontWeight:700,marginTop:2}}>{over?`+${calories-target} over`:`${target-calories} left`}</div>
      </div>
    </div>
  );
}

function MacroBar({label,value,target,color}){
  const pct=Math.min((value/target)*100,100),over=value>target;
  return(<div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{color:"#555",fontSize:11,textTransform:"uppercase",letterSpacing:1}}>{label}</span><span style={{color:over?"#ef4444":color,fontSize:11,fontWeight:700}}>{value}<span style={{color:"#333"}}>/{target}g</span></span></div><div style={{height:4,background:"#1a1a1a",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",borderRadius:99,background:over?"#ef4444":color,width:`${pct}%`,transition:"width 0.4s ease"}}/></div></div>);
}

function AddMealModal({ onAdd, onClose }) {
  const [mode,setMode]=useState("ai");
  const [mt,setMt]=useState("lunch");
  const [name,setName]=useState("");
  const [cal,setCal]=useState("");
  const [prot,setProt]=useState("");
  const [carb,setCarb]=useState("");
  const [fat,setFat]=useState("");
  const [aiIn,setAiIn]=useState("");
  const [aiLoad,setAiLoad]=useState(false);
  const [aiRes,setAiRes]=useState(null);
  const est=async()=>{
    if(!aiIn.trim())return; setAiLoad(true);
    try{const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:400,system:"You are a nutrition expert. Return ONLY a JSON object (no markdown) with: name(string),calories(number),protein(number g),carbs(number g),fat(number g),portion(string - visual hand/cup description). Australian portions. Combine multiple foods into one entry.",messages:[{role:"user",content:aiIn}]})});
    const d=await r.json();const t=d.content?.[0]?.text||"{}";const p=JSON.parse(t.replace(/```json\n?|\n?```/g,"").trim());
    setAiRes(p);setName(p.name||aiIn);setCal(String(p.calories||""));setProt(String(p.protein||""));setCarb(String(p.carbs||""));setFat(String(p.fat||""));}catch{setAiRes({error:true});}
    setAiLoad(false);
  };
  const add=()=>{if(!name||!cal)return;onAdd({name,calories:+cal,protein:+prot||0,carbs:+carb||0,fat:+fat||0,mealType:mt,time:new Date().toLocaleTimeString("en-AU",{hour:"2-digit",minute:"2-digit"}),id:Date.now()});onClose();};
  return(
    <Modal title="LOG MEAL" onClose={onClose}>
      <div style={{display:"flex",background:"#111",borderRadius:10,padding:3,marginBottom:14}}>
        {[["ai","🤖 AI Estimate"],["quick","✏️ Manual"]].map(([k,v])=><button key={k} onClick={()=>setMode(k)} style={{flex:1,background:mode===k?"#1a1a1a":"none",border:mode===k?"1px solid #2a2a2a":"none",borderRadius:8,color:mode===k?"#fff":"#444",padding:"9px",fontSize:13,fontWeight:600,cursor:"pointer"}}>{v}</button>)}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {["breakfast","lunch","dinner","snack"].map(t=><button key={t} onClick={()=>setMt(t)} className="pressable" style={{flex:1,background:mt===t?MEAL_COLORS[t]+"22":"#111",border:`1px solid ${mt===t?MEAL_COLORS[t]:"#1e1e1e"}`,borderRadius:8,color:mt===t?MEAL_COLORS[t]:"#555",padding:"8px 4px",fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"capitalize"}}>{t}</button>)}
      </div>
      {mode==="ai"&&(
        <div>
          <label style={lbl}>Describe what you ate</label>
          <textarea value={aiIn} onChange={e=>setAiIn(e.target.value)} rows={3} placeholder={"e.g. 2 scrambled eggs on toast with a flat white\nor: chicken rice bowl, fist of rice, palm of chicken"} style={{...inp,lineHeight:1.6,marginBottom:10}}/>
          <button onClick={est} disabled={aiLoad||!aiIn.trim()} style={{width:"100%",background:aiLoad||!aiIn.trim()?"#111":"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:10,color:aiLoad||!aiIn.trim()?"#333":"#fff",padding:13,fontFamily:"'Bebas Neue'",fontSize:17,letterSpacing:2,cursor:aiLoad||!aiIn.trim()?"default":"pointer",marginBottom:10}}>
            {aiLoad?"ESTIMATING…":"ESTIMATE CALORIES"}
          </button>
          {aiRes&&!aiRes.error&&(
            <div style={{background:"#0a1a0a",border:"1px solid #1e3a1e",borderRadius:12,padding:14,marginBottom:12}}>
              <div style={{color:"#22c55e",fontSize:12,fontWeight:700,marginBottom:6}}>✅ AI Estimate — {aiRes.name}</div>
              {aiRes.portion&&<div style={{color:"#555",fontSize:12,marginBottom:8}}>Portion: {aiRes.portion}</div>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                {[{l:"Cal",v:aiRes.calories,c:"#fff"},{l:"Protein",v:`${aiRes.protein}g`,c:"#3b82f6"},{l:"Carbs",v:`${aiRes.carbs}g`,c:"#f59e0b"},{l:"Fat",v:`${aiRes.fat}g`,c:"#ef4444"}].map(x=><div key={x.l} style={{background:"#111",borderRadius:8,padding:"8px 6px",textAlign:"center"}}><div style={{color:"#444",fontSize:9,letterSpacing:1,textTransform:"uppercase"}}>{x.l}</div><div style={{color:x.c,fontSize:15,fontWeight:700}}>{x.v}</div></div>)}
              </div>
            </div>
          )}
          {aiRes?.error&&<div style={{color:"#ef4444",fontSize:13,marginBottom:10}}>Couldn't estimate — try being more specific.</div>}
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div><label style={lbl}>Food Name</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Chicken rice bowl" style={inp}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
          {[{l:"Cal",v:cal,s:setCal,c:"#fff"},{l:"Prot g",v:prot,s:setProt,c:"#3b82f6"},{l:"Carb g",v:carb,s:setCarb,c:"#f59e0b"},{l:"Fat g",v:fat,s:setFat,c:"#ef4444"}].map(x=><div key={x.l}><label style={{...lbl,color:x.c=="#fff"?"#444":x.c}}>{x.l}</label><input type="number" value={x.v} onChange={e=>x.s(e.target.value)} placeholder="0" style={{...inp,padding:"10px 6px",textAlign:"center",fontSize:16}}/></div>)}
        </div>
        <button onClick={add} disabled={!name||!cal} style={{width:"100%",background:name&&cal?"linear-gradient(135deg,#22c55e,#16a34a)":"#111",border:"none",borderRadius:12,color:name&&cal?"#fff":"#333",padding:15,fontFamily:"'Bebas Neue'",fontSize:19,letterSpacing:2,cursor:name&&cal?"pointer":"default",boxShadow:name&&cal?"0 4px 20px #22c55e33":"none"}}>ADD TO LOG</button>
      </div>
    </Modal>
  );
}

function NutrDashTab({ nutrData, profile, onNutrChange }) {
  const [showAdd,setShowAdd]=useState(false);
  const today=todayISO(),meals=nutrData.days[today]?.meals||[];
  const tot=meals.reduce((a,m)=>({cal:a.cal+(m.calories||0),prot:a.prot+(m.protein||0),carbs:a.carbs+(m.carbs||0),fat:a.fat+(m.fat||0)}),{cal:0,prot:0,carbs:0,fat:0});
  const add=(m)=>onNutrChange({...nutrData,days:{...nutrData.days,[today]:{meals:[...meals,m]}}});
  const del=(id)=>onNutrChange({...nutrData,days:{...nutrData.days,[today]:{meals:meals.filter(m=>m.id!==id)}}});
  return(
    <div className="slide-up">
      <div style={{fontFamily:"'Bebas Neue'",fontSize:28,letterSpacing:3,color:"#fff",marginBottom:14}}>TODAY'S NUTRITION</div>
      <CalRing calories={tot.cal} target={profile.calorieTarget}/>
      <div style={{display:"flex",flexDirection:"column",gap:11,margin:"16px 0"}}>
        <MacroBar label="Protein" value={tot.prot}  target={profile.proteinTarget} color="#3b82f6"/>
        <MacroBar label="Carbs"   value={tot.carbs} target={profile.carbTarget}    color="#f59e0b"/>
        <MacroBar label="Fat"     value={tot.fat}   target={profile.fatTarget}     color="#ef4444"/>
      </div>
      <button onClick={()=>setShowAdd(true)} className="pressable" style={{width:"100%",background:"linear-gradient(135deg,#22c55e,#16a34a)",border:"none",borderRadius:12,color:"#fff",padding:"13px",fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:"0 4px 20px #22c55e33",marginBottom:16}}>
        <Ic.plus/> LOG A MEAL
      </button>
      {["breakfast","lunch","dinner","snack"].map(type=>{
        const ms=meals.filter(m=>m.mealType===type);if(!ms.length)return null;
        const tc=ms.reduce((a,m)=>a+(m.calories||0),0);
        return(<div key={type} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}><div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:8,height:8,borderRadius:"50%",background:MEAL_COLORS[type]}}/><span style={{color:"#888",fontSize:12,textTransform:"capitalize",fontWeight:700,letterSpacing:1}}>{type}</span></div><span style={{color:"#3a3a3a",fontSize:12}}>{tc} kcal</span></div>
          {ms.map(m=>(
            <div key={m.id} style={{background:"#0c0c0c",border:"1px solid #181818",borderLeft:`3px solid ${MEAL_COLORS[type]}`,borderRadius:10,padding:"11px 13px",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}><div style={{color:"#e0e0e0",fontSize:14,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.name}</div><div style={{display:"flex",gap:10,marginTop:3}}><span style={{color:"#3b82f6",fontSize:11}}>P:{m.protein}g</span><span style={{color:"#f59e0b",fontSize:11}}>C:{m.carbs}g</span><span style={{color:"#ef4444",fontSize:11}}>F:{m.fat}g</span>{m.time&&<span style={{color:"#2d2d2d",fontSize:11}}>{m.time}</span>}</div></div>
              <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0,marginLeft:10}}><div style={{color:"#fff",fontFamily:"'Bebas Neue'",fontSize:18}}>{m.calories}</div><button onClick={()=>del(m.id)} style={{background:"none",border:"none",color:"#2a2a2a",cursor:"pointer",padding:4}}><Ic.trash/></button></div>
            </div>
          ))}
        </div>);
      })}
      {!meals.length&&<div style={{textAlign:"center",padding:"30px 20px",color:"#2a2a2a"}}><div style={{fontSize:36,marginBottom:8}}>🍽️</div><div style={{fontFamily:"'Bebas Neue'",fontSize:18,letterSpacing:2,color:"#2d2d2d"}}>NO MEALS LOGGED</div></div>}
      {showAdd&&<AddMealModal onAdd={add} onClose={()=>setShowAdd(false)}/>}
    </div>
  );
}

function NutrHistoryTab({ nutrData, profile }) {
  const days=Object.entries(nutrData.days).filter(([,d])=>d.meals.length>0).sort(([a],[b])=>b.localeCompare(a)).slice(0,14);
  if(!days.length)return(<div style={{textAlign:"center",padding:"60px 20px",color:"#2a2a2a"}} className="slide-up"><div style={{fontSize:36,marginBottom:10}}>📅</div><div style={{fontFamily:"'Bebas Neue'",fontSize:20,color:"#333"}}>NO HISTORY YET</div></div>);
  return(
    <div className="slide-up">
      <div style={{fontFamily:"'Bebas Neue'",fontSize:30,letterSpacing:3,color:"#fff",marginBottom:4}}>NUTRITION LOG</div>
      <div style={{color:"#3a3a3a",fontSize:13,marginBottom:16}}>Last 14 days</div>
      {days.map(([date,day])=>{
        const tot=day.meals.reduce((a,m)=>({cal:a.cal+(m.calories||0),prot:a.prot+(m.protein||0)}),{cal:0,prot:0});
        const pct=Math.min((tot.cal/profile.calorieTarget)*100,100),over=tot.cal>profile.calorieTarget,isToday=date===todayISO();
        return(<div key={date} style={{background:"#0c0c0c",border:`1px solid ${isToday?"#22c55e33":"#181818"}`,borderRadius:12,padding:"13px 15px",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {isToday&&<span style={{background:"#22c55e22",color:"#22c55e",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20}}>TODAY</span>}
              <span style={{color:isToday?"#ccc":"#555",fontSize:13}}>{fmtDate(date)}</span>
            </div>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <span style={{color:"#3b82f6",fontSize:12}}>{tot.prot}g P</span>
              <span style={{color:over?"#ef4444":"#fff",fontFamily:"'Bebas Neue'",fontSize:20}}>{tot.cal}</span>
              <span style={{color:"#333",fontSize:11}}>kcal</span>
            </div>
          </div>
          <div style={{height:4,background:"#141414",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",borderRadius:99,background:over?"#ef4444":"#22c55e",width:`${pct}%`,transition:"width 0.4s"}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            <span style={{color:"#2d2d2d",fontSize:11}}>{day.meals.length} meals</span>
            <span style={{color:over?"#ef4444":"#3a3a3a",fontSize:11}}>{over?`+${tot.cal-profile.calorieTarget} over`:`${profile.calorieTarget-tot.cal} under`} target</span>
          </div>
        </div>);
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   PROFILE SETUP
══════════════════════════════════════════════════════════════════════════════ */
function SetupScreen({ profile, onSave }) {
  const [p,setP]=useState({...profile});
  const [step,setStep]=useState(0);
  const s=(k,v)=>setP(prev=>({...prev,[k]:v}));
  const steps=[
    {title:"ABOUT YOU",fields:(
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div><label style={lbl}>Your Name</label><input value={p.name} onChange={e=>s("name",e.target.value)} placeholder="e.g. Alex" style={inp}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={lbl}>Age</label><input type="number" value={p.age} onChange={e=>s("age",e.target.value)} placeholder="25" style={inp}/></div>
          <div><label style={lbl}>Sex</label><select value={p.sex} onChange={e=>s("sex",e.target.value)} style={inp}><option value="male">Male</option><option value="female">Female</option></select></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><label style={lbl}>Height (cm)</label><input type="number" value={p.heightCm} onChange={e=>s("heightCm",e.target.value)} placeholder="175" style={inp}/></div>
          <div><label style={lbl}>Weight (kg)</label><input type="number" value={p.weightKg} onChange={e=>s("weightKg",e.target.value)} placeholder="80" style={inp}/></div>
        </div>
      </div>
    )},
    {title:"YOUR GOAL",fields:(
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {Object.entries(GOAL_LABELS).map(([k,v])=>(
          <button key={k} onClick={()=>s("goal",k)} style={{background:p.goal===k?`${BRAND}18`:"#0f0f0f",border:`1px solid ${p.goal===k?BRAND:"#1e1e1e"}`,borderRadius:12,padding:"14px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
            <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${p.goal===k?BRAND:"#333"}`,background:p.goal===k?BRAND:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {p.goal===k&&<div style={{width:8,height:8,borderRadius:"50%",background:"#000"}}/>}
            </div>
            <div><div style={{color:"#e8e8e8",fontSize:15,fontWeight:600}}>{v}</div><div style={{color:"#444",fontSize:12,marginTop:2}}>{{fat_loss:"Calorie deficit · burn fat",muscle_gain:"Calorie surplus · build mass",recomp:"Maintain weight · change composition",maintenance:"Sustain current physique"}[k]}</div></div>
          </button>
        ))}
      </div>
    )},
    {title:"ACTIVITY & DIET",fields:(
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div><label style={lbl}>Activity Level</label><select value={p.activity} onChange={e=>s("activity",e.target.value)} style={inp}>{Object.entries(ACTIVITY_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
        <div><label style={lbl}>Dietary Preference</label><div style={{display:"flex",flexWrap:"wrap",gap:8}}>{Object.entries(DIET_LABELS).map(([k,v])=><button key={k} onClick={()=>s("diet",k)} className="pressable" style={{background:p.diet===k?BRAND:"#111",border:`1px solid ${p.diet===k?BRAND:"#222"}`,borderRadius:20,color:p.diet===k?"#000":"#666",padding:"7px 14px",fontSize:13,fontWeight:600,cursor:"pointer"}}>{v}</button>)}</div></div>
        {p.heightCm&&p.weightKg&&p.age&&(()=>{const t=calcTargets(p);return(<div style={{background:`${BRAND}0d`,border:`1px solid ${BRAND}33`,borderRadius:12,padding:14}}><div style={{color:BRAND,fontSize:12,fontWeight:700,marginBottom:8}}>📊 Your Calculated Targets</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{[{l:"Calories",v:`${t.calories} kcal`},{l:"Protein",v:`${t.protein}g`},{l:"Carbs",v:`${t.carbs}g`},{l:"Fat",v:`${t.fat}g`}].map(x=><div key={x.l} style={{background:"#111",borderRadius:8,padding:"8px 12px"}}><div style={{color:"#444",fontSize:10,textTransform:"uppercase",letterSpacing:1}}>{x.l}</div><div style={{color:"#fff",fontSize:16,fontWeight:700}}>{x.v}</div></div>)}</div></div>);})()}
      </div>
    )},
  ];
  const next=()=>{
    if(step<steps.length-1){setStep(step+1);return;}
    const t=calcTargets(p);
    onSave({...p,...t,calorieTarget:t.calories,proteinTarget:t.protein,carbTarget:t.carbs,fatTarget:t.fat,setupDone:true});
  };
  return(
    <div style={{minHeight:"100vh",background:"#070707",maxWidth:480,margin:"0 auto",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"28px 24px 16px",flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
          <div style={{width:40,height:40,background:`linear-gradient(135deg,#1a1a1a,#252525)`,border:`2px solid ${BRAND}`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>⚡</div>
          <div><div style={{fontFamily:"'Bebas Neue'",fontSize:26,letterSpacing:4,color:BRAND}}>GERRARD</div><div style={{color:"#2d2d2d",fontSize:10,letterSpacing:1}}>YOUR PERSONAL HEALTH COACH</div></div>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:26}}>{steps.map((_,i)=><div key={i} style={{flex:1,height:3,borderRadius:99,background:i<=step?BRAND:"#1a1a1a",transition:"background 0.3s"}}/>)}</div>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:30,letterSpacing:3,color:"#fff",marginBottom:4}}>{steps[step].title}</div>
        <div style={{color:"#3a3a3a",fontSize:13,marginBottom:20}}>Step {step+1} of {steps.length}</div>
        {steps[step].fields}
      </div>
      <div style={{padding:"16px 24px 44px"}}>
        <button onClick={next} className="pressable" style={{width:"100%",background:`linear-gradient(135deg,${BRAND},#c8962a)`,border:"none",borderRadius:12,color:"#000",padding:16,fontFamily:"'Bebas Neue'",fontSize:20,letterSpacing:3,cursor:"pointer",fontWeight:700,boxShadow:`0 4px 20px ${BRAND}44`}}>
          {step<steps.length-1?"NEXT →":"LET'S GO ⚡"}
        </button>
        {step>0&&<button onClick={()=>setStep(step-1)} style={{width:"100%",background:"none",border:"none",color:"#333",padding:"12px",cursor:"pointer",fontSize:14,marginTop:8}}>← Back</button>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ROOT APP
══════════════════════════════════════════════════════════════════════════════ */
const SECTIONS  = [
  {id:"home",  label:"HOME",      Icon:Ic.home   },
  {id:"gym",   label:"GYM",       Icon:Ic.barbell},
  {id:"nutr",  label:"NUTRITION", Icon:Ic.leaf   },
  {id:"coach", label:"GERRARD",   Icon:Ic.star   },
];
const GYM_TABS  = [{id:"workout",label:"TODAY",Icon:Ic.barbell},{id:"progress",label:"GAINS",Icon:Ic.chart},{id:"log",label:"LOG",Icon:Ic.history}];
const NUTR_TABS = [{id:"nutrDash",label:"TODAY",Icon:Ic.apple},{id:"nutrLog",label:"HISTORY",Icon:Ic.history}];

export default function Gerrard() {
  const [section, setSection] = useState("home");
  const [gymTab,  setGymTab]  = useState("workout");
  const [nutrTab, setNutrTab] = useState("nutrDash");

  const [gymData,  setGymData]  = useState(null);
  const [nutrData, setNutrData] = useState(null);
  const [profile,  setProfile]  = useState(null);
  const [chatHist, setChatHist] = useState(null);
  const [editProf, setEditProf] = useState(false);

  useEffect(() => {
    Promise.all([sGet(GYM_KEY,emptyGym), sGet(NUTR_KEY,emptyNutr), sGet(PROF_KEY,emptyProf), sGet(CHAT_KEY,emptyChat)])
      .then(([g,n,p,c]) => { setGymData(g); setNutrData(n); setProfile(p); setChatHist(c); });
  }, []);

  const saveGym  = useCallback(async d => { setGymData(d);  await sSet(GYM_KEY,d);  }, []);
  const saveNutr = useCallback(async d => { setNutrData(d); await sSet(NUTR_KEY,d); }, []);
  const saveProf = useCallback(async p => { setProfile(p);  await sSet(PROF_KEY,p); setEditProf(false); }, []);
  const saveChat = useCallback(async c => { setChatHist(c); await sSet(CHAT_KEY,c); }, []);
  const delGym   = useCallback(async id => { const u={...gymData,workouts:gymData.workouts.filter(w=>w.id!==id)}; setGymData(u); await sSet(GYM_KEY,u); }, [gymData]);

  if (!gymData||!nutrData||!profile||!chatHist) return (
    <>
      <GlobalStyles/>
      <div style={{minHeight:"100vh",background:"#070707",display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{fontFamily:"'Bebas Neue'",fontSize:32,color:BRAND,letterSpacing:6,animation:"pulse 1s infinite"}}>GERRARD</div>
      </div>
    </>
  );

  if (!profile.setupDone||editProf) return (
    <><GlobalStyles/><SetupScreen profile={profile} onSave={saveProf}/></>
  );

  const nextWk = gymData.program.workouts.find(w=>w.id===gymData.nextWorkout)||gymData.program.workouts[0];
  const subTabs = section==="gym" ? GYM_TABS : section==="nutr" ? NUTR_TABS : null;
  const activeSubTab = section==="gym" ? gymTab : nutrTab;
  const setSubTab    = section==="gym" ? setGymTab : setNutrTab;

  return (
    <>
      <GlobalStyles/>
      <div style={{minHeight:"100vh",background:"#070707",fontFamily:"'Barlow',sans-serif",color:"#fff",maxWidth:480,margin:"0 auto"}}>

        {/* ── Top Bar ── */}
        <div style={{position:"sticky",top:0,zIndex:30,background:"linear-gradient(180deg,#070707 80%,transparent)",padding:"12px 20px 0"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:34,height:34,background:"linear-gradient(135deg,#1a1a1a,#252525)",border:`2px solid ${BRAND}`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⚡</div>
              <div>
                <div style={{fontFamily:"'Bebas Neue'",fontSize:22,letterSpacing:4,color:BRAND,lineHeight:1}}>GERRARD</div>
                <div style={{fontSize:9,color:"#2a2a2a",letterSpacing:2}}>GYM + NUTRITION · KG · AU</div>
              </div>
            </div>
            <div style={{display:"flex",gap:7,alignItems:"center"}}>
              {section==="gym"&&<div style={{background:nextWk.color+"22",border:`1px solid ${nextWk.color}44`,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,color:nextWk.color}}>NEXT: {nextWk.id}</div>}
              {section==="nutr"&&<div style={{background:"#22c55e22",border:"1px solid #22c55e44",borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,color:"#22c55e"}}>{profile.calorieTarget} KCAL</div>}
              {section==="coach"&&<div style={{background:`${BRAND}22`,border:`1px solid ${BRAND}44`,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:700,color:BRAND}}>AI COACH</div>}
              <button onClick={()=>setEditProf(true)} style={{background:"#111",border:"1px solid #1e1e1e",borderRadius:8,color:"#444",padding:"6px 8px",cursor:"pointer",display:"flex",alignItems:"center"}}><Ic.pencil/></button>
            </div>
          </div>

          {/* Sub-tab strip */}
          {subTabs&&(
            <div style={{display:"flex",gap:4,paddingBottom:6,overflowX:"auto"}}>
              {subTabs.map(t=>{
                const act=activeSubTab===t.id;
                const ac=section==="nutr"?"#22c55e":"#c0392b";
                return(
                  <button key={t.id} onClick={()=>setSubTab(t.id)} className="pressable"
                    style={{flexShrink:0,background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:20,color:act?ac:"#333",borderBottom:act?`2px solid ${ac}`:"2px solid transparent",transition:"color 0.15s"}}>
                    <t.Icon/>
                    <span style={{fontFamily:"'Bebas Neue'",fontSize:12,letterSpacing:1.5}}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div style={{padding:"4px 20px 110px"}}>
          {section==="home"  && <HomeTab gymData={gymData} nutrData={nutrData} profile={profile} onSection={setSection} onGymTab={setGymTab} onNutrTab={setNutrTab}/>}
          {section==="gym"   && gymTab==="workout"   && <GymTodayTab    key={gymData.nextWorkout} gymData={gymData} onSave={saveGym}/>}
          {section==="gym"   && gymTab==="progress"  && <GymProgressTab gymData={gymData}/>}
          {section==="gym"   && gymTab==="log"       && <GymLogTab      gymData={gymData} onDelete={delGym}/>}
          {section==="nutr"  && nutrTab==="nutrDash" && <NutrDashTab    nutrData={nutrData} profile={profile} onNutrChange={saveNutr}/>}
          {section==="nutr"  && nutrTab==="nutrLog"  && <NutrHistoryTab nutrData={nutrData} profile={profile}/>}
          {section==="coach" && <GerrardChat gymData={gymData} nutrData={nutrData} profile={profile} onGymChange={saveGym} onNutrChange={saveNutr} chatHistory={chatHist} onChatHistoryChange={saveChat}/>}
        </div>

        {/* ── Bottom Nav ── */}
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,zIndex:30,background:"#090909",borderTop:`1px solid ${BRAND}22`,display:"flex",paddingBottom:"env(safe-area-inset-bottom,8px)"}}>
          {SECTIONS.map(sec=>{
            const act=section===sec.id;
            const ac=sec.id==="coach"?BRAND:sec.id==="nutr"?"#22c55e":"#c0392b";
            return(
              <button key={sec.id} onClick={()=>setSection(sec.id)}
                style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"9px 4px 6px",color:act?ac:"#2d2d2d",transition:"color 0.15s",position:"relative"}}>
                {sec.id==="coach"&&<div style={{position:"absolute",top:7,right:"calc(50% - 16px)",width:7,height:7,borderRadius:"50%",background:"#22c55e",border:"1px solid #090909"}}/>}
                <sec.Icon/>
                <span style={{fontSize:9,fontFamily:"'Bebas Neue'",letterSpacing:1.5}}>{sec.label}</span>
                {act&&<div style={{width:16,height:2,background:ac,borderRadius:99,marginTop:-1}}/>}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
