import { useState, useEffect } from "react";

const EVENT_BUFFER = 2;

const DEFAULT_COMMUTE = {
  inStart:  "07:30",
  inEnd:    "09:00",
  outStart: "17:00",
  outEnd:   "18:30",
};

function timeToDecimal(t) {
  const [h, m] = t.split(":").map(Number);
  return h + m / 60;
}

// Major venues (always shown)
const MAJOR_VENUES = [
  { name: "AO Arena",       keywords: ["ao arena", "manchester arena"],          capacity: 21000 },
  { name: "Co-op Live",     keywords: ["co-op live", "coop live", "co op live"], capacity: 23500 },
  { name: "Etihad Stadium", keywords: ["etihad"],                                capacity: 53400 },
  { name: "Old Trafford",   keywords: ["old trafford"],                          capacity: 74000 },
];

// Medium venues (shown when medium events enabled)
const MEDIUM_VENUES = [
  { name: "Bridgewater Hall",          keywords: ["bridgewater hall"],           capacity: 2400  },
  { name: "Manchester Academy",        keywords: ["manchester academy"],          capacity: 2700  },
  { name: "O2 Ritz Manchester",        keywords: ["o2 ritz", "ritz manchester"], capacity: 1500  },
  { name: "Emirates Old Trafford",     keywords: ["emirates old trafford"],      capacity: 26000 },
  { name: "Manchester Apollo",         keywords: ["manchester apollo", "o2 apollo manchester"], capacity: 3500 },
  { name: "Aviva Studios",             keywords: ["aviva studios"],              capacity: 5000  },
];

const FOOTBALL_TEAMS = [
  { id: 65, name: "Manchester City",   venue: "Etihad Stadium", capacity: 53400 },
  { id: 66, name: "Manchester United", venue: "Old Trafford",   capacity: 74000 },
];

function matchVenue(event, includeMedium) {
  const venueName = event._embedded?.venues?.[0]?.name?.toLowerCase() || "";
  const allVenues = includeMedium ? [...MAJOR_VENUES, ...MEDIUM_VENUES] : MAJOR_VENUES;
  return allVenues.find(v => v.keywords.some(k => venueName.includes(k)));
}

function getSeverity(capacity) {
  if (capacity >= 50000) return "red";
  if (capacity >= 15000) return "amber";
  return "green";
}

function getEventHour(dateStr) {
  const d = new Date(dateStr);
  return d.getHours() + d.getMinutes() / 60;
}

function affectsCommute(eventHour, commute) {
  const inStart  = timeToDecimal(commute.inStart);
  const inEnd    = timeToDecimal(commute.inEnd);
  const outStart = timeToDecimal(commute.outStart);
  const outEnd   = timeToDecimal(commute.outEnd);
  const start = eventHour - EVENT_BUFFER;
  const end   = eventHour + EVENT_BUFFER;
  return {
    am: start <= inEnd  && end >= inStart,
    pm: start <= outEnd && end >= outStart,
  };
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function normaliseFixture(match, team) {
  if (match.homeTeam?.id !== team.id) return null;
  const dateTime  = match.utcDate;
  const localDate = dateTime.split("T")[0];
  return {
    name: `${team.name} vs ${match.awayTeam?.name || "Unknown"}`,
    _type: "fixture", _capacity: team.capacity, _venueName: team.venue,
    dates: { start: { dateTime, localDate } },
    _embedded: { venues: [{ name: team.venue }] },
  };
}

const SEV = {
  red:   { label: "HIGH IMPACT", bg: "bg-red-950",     border: "border-red-500",     dot: "bg-red-400",     dotSm: "bg-red-400",   badge: "bg-red-500/20 text-red-300 border border-red-500/40",     cell: "bg-red-900/40 border-red-700"   },
  amber: { label: "MODERATE",    bg: "bg-amber-950",   border: "border-amber-500",   dot: "bg-amber-400",   dotSm: "bg-amber-400", badge: "bg-amber-500/20 text-amber-300 border border-amber-500/40", cell: "bg-amber-900/40 border-amber-700" },
  green: { label: "CLEAR",       bg: "bg-emerald-950", border: "border-emerald-700", dot: "bg-emerald-400", dotSm: "bg-zinc-700",  badge: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40", cell: "" },
};

function TimeInput({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500 uppercase tracking-wider">{label}</label>
      <input type="time" value={value} onChange={e => onChange(e.target.value)}
        className="bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono" />
    </div>
  );
}

function SettingsPanel({ commute, onChange, onClose }) {
  const [draft, setDraft] = useState({ ...commute });
  function update(key, val) { setDraft(d => ({ ...d, [key]: val })); }
  function save() { onChange(draft); onClose(); }
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Commute Times</h2>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xs">✕ Cancel</button>
      </div>
      <div>
        <p className="text-xs text-zinc-500 mb-3">🌅 Morning inbound</p>
        <div className="grid grid-cols-2 gap-3">
          <TimeInput label="Leave by"  value={draft.inStart} onChange={v => update("inStart", v)} />
          <TimeInput label="Arrive by" value={draft.inEnd}   onChange={v => update("inEnd",   v)} />
        </div>
      </div>
      <div>
        <p className="text-xs text-zinc-500 mb-3">🌆 Evening outbound</p>
        <div className="grid grid-cols-2 gap-3">
          <TimeInput label="Leave by"  value={draft.outStart} onChange={v => update("outStart", v)} />
          <TimeInput label="Arrive by" value={draft.outEnd}   onChange={v => update("outEnd",   v)} />
        </div>
      </div>
      <button onClick={save} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2.5 rounded-lg transition-colors tracking-wide uppercase">
        Save Times
      </button>
    </div>
  );
}

function LeaveAdvice({ severity, affects }) {
  if (severity === "green") return null;
  const mins     = severity === "red" ? 60 : 30;
  const sessions = [affects.am && "morning", affects.pm && "evening"].filter(Boolean).join(" & ");
  if (!sessions) return null;
  return (
    <p className="text-xs text-zinc-400 mt-2">
      ⏱ Consider leaving <span className="text-white font-semibold">{mins} mins earlier</span> for your {sessions} commute
    </p>
  );
}

function EventCard({ event, commute, includeMedium }) {
  const dateTime  = event.dates.start.dateTime || event.dates.start.localDate + "T19:00:00";
  const hour      = getEventHour(dateTime);
  const capacity  = event._capacity || matchVenue(event, includeMedium)?.capacity || 10000;
  const severity  = getSeverity(capacity);
  const affects   = affectsCommute(hour, commute);
  const cfg       = SEV[severity];
  const venueName = event._venueName || event._embedded?.venues?.[0]?.name || "Manchester Venue";
  const ticketUrl = event.url || null;

  return (
    <div className={`rounded-lg border ${cfg.border} ${cfg.bg} p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {event._type === "fixture" && <span className="text-xs">⚽</span>}
            <p className="text-white font-medium text-sm truncate">{event.name}</p>
          </div>
          <p className="text-zinc-400 text-xs mt-0.5">{venueName} · {formatTime(dateTime)}</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold shrink-0 ${cfg.badge}`}>{cfg.label}</span>
      </div>
      <div className="flex gap-2 mt-2 flex-wrap">
        {affects.am  && <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700">🌅 AM hit</span>}
        {affects.pm  && <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded border border-zinc-700">🌆 PM hit</span>}
        {!affects.am && !affects.pm && <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700">Outside commute window</span>}
        {ticketUrl && (
          <a href={ticketUrl} target="_blank" rel="noreferrer"
            className="text-xs bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded border border-blue-700 hover:bg-blue-800/60 transition-colors">
            🎟 Buy tickets →
          </a>
        )}
      </div>
      <LeaveAdvice severity={severity} affects={affects} />
    </div>
  );
}

function DaySummary({ events, includeMedium }) {
  const worst = events.reduce((acc, e) => {
    const sev = getSeverity(e._capacity || matchVenue(e, includeMedium)?.capacity || 10000);
    if (sev === "red") return "red";
    if (sev === "amber" && acc !== "red") return "amber";
    return acc;
  }, "green");
  return <div className={`w-3 h-3 rounded-full ${SEV[worst].dot}`} />;
}

function NextEventBanner({ events, includeMedium }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const next  = events.find(e => { const d = new Date(e.dates.start.localDate); d.setHours(0,0,0,0); return d >= today; });
  if (!next) return null;
  const nextDate  = new Date(next.dates.start.localDate); nextDate.setHours(0,0,0,0);
  const daysAway  = Math.round((nextDate - today) / 86400000);
  const capacity  = next._capacity || matchVenue(next, includeMedium)?.capacity || 10000;
  const cfg       = SEV[getSeverity(capacity)];
  const venueName = next._venueName || next._embedded?.venues?.[0]?.name || "Manchester Venue";
  const daysLabel = daysAway === 0 ? "Today" : daysAway === 1 ? "Tomorrow" : `${daysAway} days away`;
  const dateLabel = new Date(next.dates.start.localDate).toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" });
  return (
    <div className={`rounded-xl border ${cfg.border} bg-zinc-900 p-4`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-widest text-zinc-500">Next Major Event</p>
        <span className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold ${cfg.badge}`}>{daysLabel}</span>
      </div>
      <div className="flex items-start gap-3">
        <div className={`w-1 self-stretch rounded-full ${cfg.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {next._type === "fixture" && <span>⚽</span>}
            <p className="text-white font-semibold text-sm truncate">{next.name}</p>
          </div>
          <p className="text-zinc-400 text-xs mt-0.5">{venueName}</p>
          <p className="text-zinc-500 text-xs mt-1">{dateLabel}</p>
        </div>
      </div>
    </div>
  );
}

// ── Monthly Calendar ──────────────────────────────────────────────
function MonthCalendar({ events, commute, includeMedium }) {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(null);

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Adjust so week starts Monday
  const startOffset = (firstDay + 6) % 7;

  function getEventsForDate(day) {
    const dateStr = new Date(year, month, day).toDateString();
    return events.filter(e => new Date(e.dates.start.localDate).toDateString() === dateStr);
  }

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)); setSelectedDate(null); }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)); setSelectedDate(null); }

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-800 transition-colors">←</button>
        <p className="text-sm font-bold text-zinc-200 uppercase tracking-widest">
          {viewDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </p>
        <button onClick={nextMonth} className="text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-800 transition-colors">→</button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1">
        {["Mo","Tu","We","Th","Fr","Sa","Su"].map(d => (
          <div key={d} className="text-center text-xs text-zinc-600 py-1">{d}</div>
        ))}

        {/* Empty cells before first day */}
        {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const dayEvents = getEventsForDate(day);
          const isToday   = new Date(year, month, day).toDateString() === today.toDateString();
          const isPast    = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
          const isSelected = selectedDate === day;
          const worst = dayEvents.reduce((acc, e) => {
            const sev = getSeverity(e._capacity || matchVenue(e, includeMedium)?.capacity || 10000);
            if (sev === "red") return "red";
            if (sev === "amber" && acc !== "red") return "amber";
            return acc;
          }, null);

          return (
            <button key={day} onClick={() => setSelectedDate(isSelected ? null : day)}
              className={`relative flex flex-col items-center justify-start pt-1 pb-1 rounded-lg text-xs font-mono transition-all min-h-[2.5rem]
                ${isSelected ? "ring-1 ring-blue-400 bg-zinc-700" : "hover:bg-zinc-800"}
                ${isToday ? "ring-1 ring-blue-500/70" : ""}
                ${isPast ? "opacity-40" : ""}
                ${worst ? `border ${SEV[worst].cell}` : ""}
              `}>
              <span className={`font-bold ${isToday ? "text-blue-300" : "text-zinc-300"}`}>{day}</span>
              {worst && <div className={`w-1.5 h-1.5 rounded-full mt-0.5 ${SEV[worst].dot}`} />}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 pt-2 border-t border-zinc-800">
        {["red","amber"].map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${SEV[s].dot}`} />
            <span className="text-xs text-zinc-500">{SEV[s].label}</span>
          </div>
        ))}
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="space-y-2 pt-2 border-t border-zinc-800">
          <p className="text-xs text-zinc-400 uppercase tracking-widest">
            {new Date(year, month, selectedDate).toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long" })}
          </p>
          {selectedEvents.length === 0
            ? <p className="text-emerald-400 text-xs">✓ No major events</p>
            : selectedEvents.map((e, i) => <EventCard key={i} event={e} commute={commute} includeMedium={includeMedium} />)
          }
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tmKey,        setTmKey]        = useState("tjIDz3OGsQYR287THUAbkMrGw8U6HYXq");
  const [fdKey,        setFdKey]        = useState("1768ce62949f452c823b4ca4def961d3");
  const [commute,      setCommute]      = useState(() => {
    try { return JSON.parse(localStorage.getItem("ci_commute")) || DEFAULT_COMMUTE; }
    catch { return DEFAULT_COMMUTE; }
  });
  const [includeMedium, setIncludeMedium] = useState(false);
  const [view,          setView]          = useState("week"); // "week" | "month"

  const [events,       setEvents]       = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [tmError,      setTmError]      = useState(null);
  const [submitted,    setSubmitted]    = useState(false);
  const [expandedDay,  setExpandedDay]  = useState(null);
  const [sources,      setSources]      = useState({ tm: false, fd: false });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (tmKey || fdKey) { setSubmitted(true); fetchAll(tmKey, fdKey); }
  }, []);

  useEffect(() => {
    localStorage.setItem("ci_commute", JSON.stringify(commute));
  }, [commute]);

  const today    = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() + i); return d; });

  async function fetchAll(tmApiKey, fdApiKey) {
    setLoading(true); setTmError(null);
    const allEvents = []; const loadedSources = { tm: false, fd: false };

    if (tmApiKey) {
      try {
        const startDate = today.toISOString().split("T")[0] + "T00:00:00Z";
        const endDate   = new Date(today.getTime() + 90*24*60*60*1000).toISOString().split("T")[0] + "T23:59:59Z";
        const res  = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?apikey=${tmApiKey}&city=Manchester&countryCode=GB&startDateTime=${startDate}&endDateTime=${endDate}&size=50&sort=date,asc`);
        const data = await res.json();
        if (data.fault) { setTmError(`Key rejected: ${data.fault.faultstring}`); }
        else {
          // Include all venues when medium is on, otherwise just major
          const filtered = (data._embedded?.events || []).filter(e => matchVenue(e, true));
          allEvents.push(...filtered);
          loadedSources.tm = true;
        }
      } catch (e) { setTmError(`Connection failed: ${e.message}`); }
    }

    if (fdApiKey) {
      try {
        const dateFrom = today.toISOString().split("T")[0];
        const dateTo   = new Date(today.getTime() + 90*24*60*60*1000).toISOString().split("T")[0];
        const results  = await Promise.allSettled(
          FOOTBALL_TEAMS.map(team =>
            fetch(`https://api.football-data.org/v4/teams/${team.id}/matches?status=SCHEDULED&dateFrom=${dateFrom}&dateTo=${dateTo}`, { headers: { "X-Auth-Token": fdApiKey } })
              .then(r => r.json()).then(data => ({ data, team }))
          )
        );
        for (const r of results) {
          if (r.status === "fulfilled") {
            (r.value.data.matches || []).forEach(m => { const n = normaliseFixture(m, r.value.team); if (n) allEvents.push(n); });
            if (r.value.data.matches !== undefined) loadedSources.fd = true;
          }
        }
      } catch (_) {}
    }

    allEvents.sort((a,b) => new Date(a.dates.start.dateTime||a.dates.start.localDate) - new Date(b.dates.start.dateTime||b.dates.start.localDate));
    setSources(loadedSources); setEvents(allEvents); setLoading(false);
  }

  function handleSubmit() {
    if (!tmKey.trim() && !fdKey.trim()) return;
    localStorage.setItem("ci_tmKey", tmKey.trim());
    localStorage.setItem("ci_fdKey", fdKey.trim());
    setSubmitted(true); fetchAll(tmKey.trim(), fdKey.trim());
  }

  // Filter displayed events based on medium toggle
  const visibleEvents = events.filter(e => matchVenue(e, includeMedium) || e._type === "fixture");

  function getEventsForDay(date) {
    return visibleEvents.filter(e => new Date(e.dates.start.localDate).toDateString() === date.toDateString());
  }

  const totalImpacted = weekDays.filter(d => getEventsForDay(d).length > 0).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white" style={{ fontFamily: "'DM Mono', monospace" }}>
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold tracking-widest text-zinc-100 uppercase">Commute Impact</h1>
            <p className="text-xs text-zinc-500">Manchester → Warrington</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {submitted && <>
              <span className={`text-xs px-1.5 py-0.5 rounded ${sources.tm ? "bg-blue-900 text-blue-300" : "bg-zinc-800 text-zinc-500"}`}>TM</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${sources.fd ? "bg-green-900 text-green-300" : "bg-zinc-800 text-zinc-500"}`}>FD</span>
            </>}
            {submitted && (
              <button onClick={() => setShowSettings(s => !s)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${showSettings ? "border-blue-500 text-blue-300 bg-blue-900/30" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}>
                ⏱ Times
              </button>
            )}
            <p className="text-xs font-mono text-zinc-300">{today.toLocaleDateString("en-GB", { day:"numeric", month:"short" })}</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">

        {!submitted && (
          <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-4">
            <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-widest">Connect Data Sources</h2>
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Ticketmaster API Key</label>
              <input type="text" value={tmKey} onChange={e => setTmKey(e.target.value)} placeholder="Ticketmaster key..."
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono" />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 uppercase tracking-wider">Football-Data.org API Key</label>
              <input type="text" value={fdKey} onChange={e => setFdKey(e.target.value)} onKeyDown={e => e.key==="Enter"&&handleSubmit()} placeholder="Football-Data key..."
                className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-green-500 font-mono" />
            </div>
            <button onClick={handleSubmit} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2.5 rounded-lg transition-colors tracking-wide uppercase">
              Load Events
            </button>
          </div>
        )}

        {showSettings && submitted && (
          <SettingsPanel commute={commute} onChange={setCommute} onClose={() => setShowSettings(false)} />
        )}

        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-zinc-400 text-sm">Fetching events & fixtures...</p>
          </div>
        )}

        {tmError && (
          <div className="rounded-lg border border-red-800 bg-red-950 p-4 text-sm text-red-300">
            ⚠️ {tmError} — <button onClick={() => { setSubmitted(false); setTmError(null); }} className="underline text-red-200">try again</button>
          </div>
        )}

        {submitted && !loading && (
          <>
            <NextEventBanner events={visibleEvents} includeMedium={includeMedium} />

            {/* Controls bar */}
            <div className="flex items-center justify-between gap-3">
              {/* View toggle */}
              <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
                <button onClick={() => setView("week")}
                  className={`text-xs px-3 py-1.5 transition-colors ${view==="week" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
                  Week
                </button>
                <button onClick={() => setView("month")}
                  className={`text-xs px-3 py-1.5 transition-colors ${view==="month" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"}`}>
                  Month
                </button>
              </div>

              {/* Medium events toggle */}
              <button onClick={() => setIncludeMedium(m => !m)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${includeMedium ? "border-amber-500 text-amber-300 bg-amber-900/20" : "border-zinc-700 text-zinc-400 hover:text-zinc-200"}`}>
                {includeMedium ? "● Medium events on" : "○ Medium events off"}
              </button>
            </div>

            {/* Week view */}
            {view === "week" && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-widest text-zinc-500">This Week</p>
                  <p className="text-xs text-zinc-400"><span className="text-white font-bold">{totalImpacted}</span> days affected</p>
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {weekDays.map((d, i) => {
                    const dayEvents  = getEventsForDay(d);
                    const isToday    = d.toDateString() === today.toDateString();
                    const isExpanded = expandedDay === d.toDateString();
                    return (
                      <button key={i} onClick={() => setExpandedDay(isExpanded ? null : d.toDateString())}
                        className={`flex flex-col items-center gap-1.5 py-2 px-1 rounded-lg transition-all ${isExpanded?"bg-zinc-700":"hover:bg-zinc-800"} ${isToday?"ring-1 ring-blue-500/50":""}`}>
                        <span className={`text-xs uppercase ${isToday?"text-blue-400":"text-zinc-500"}`}>{d.toLocaleDateString("en-GB",{weekday:"short"}).slice(0,2)}</span>
                        <span className={`text-sm font-bold ${isToday?"text-blue-300":"text-zinc-300"}`}>{d.getDate()}</span>
                        {dayEvents.length > 0 ? <DaySummary events={dayEvents} includeMedium={includeMedium} /> : <div className="w-3 h-3 rounded-full bg-zinc-700" />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3 mt-3 pt-3 border-t border-zinc-800">
                  {["red","amber","green"].map(s => (
                    <div key={s} className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${SEV[s].dot}`} />
                      <span className="text-xs text-zinc-500">{SEV[s].label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Week day detail */}
            {view === "week" && weekDays.map((d, i) => {
              if (expandedDay !== d.toDateString()) return null;
              const dayEvents = getEventsForDay(d);
              return (
                <div key={i} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-zinc-800" />
                    <p className="text-xs text-zinc-400 uppercase tracking-widest">{d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</p>
                    <div className="h-px flex-1 bg-zinc-800" />
                  </div>
                  {dayEvents.length === 0
                    ? <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-center"><p className="text-emerald-400 text-sm font-bold">✓ Clear</p><p className="text-zinc-500 text-xs mt-1">No major events near your route today</p></div>
                    : dayEvents.map((e, j) => <EventCard key={j} event={e} commute={commute} includeMedium={includeMedium} />)
                  }
                </div>
              );
            })}

            {/* Month view */}
            {view === "month" && (
              <MonthCalendar events={visibleEvents} commute={commute} includeMedium={includeMedium} />
            )}

            {/* Footer */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-500 space-y-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-zinc-400 font-semibold uppercase tracking-widest text-xs">Your Commute Windows</p>
                <button onClick={() => setShowSettings(s => !s)} className="text-blue-400 underline text-xs">Edit</button>
              </div>
              <p>🌅 Inbound: <span className="text-zinc-300">{commute.inStart} – {commute.inEnd}</span></p>
              <p>🌆 Outbound: <span className="text-zinc-300">{commute.outStart} – {commute.outEnd}</span></p>
              <p>📍 Route: <span className="text-zinc-300">Warrington ↔ Manchester</span></p>
              <div className="pt-2 mt-2 border-t border-zinc-800 flex gap-3 flex-wrap">
                <span className={sources.tm?"text-blue-400":"text-zinc-600"}>● Ticketmaster {sources.tm?"connected":"not used"}</span>
                <span className={sources.fd?"text-green-400":"text-zinc-600"}>● Football-Data {sources.fd?"connected":"not used"}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
