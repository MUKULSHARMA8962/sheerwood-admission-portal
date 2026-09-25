import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SchoolCrest from "../components/SchoolCrest";
import "./SchoolCalendar.css";

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export default function SchoolCalendar() {
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);

  const events = useMemo(() => [
    { date: toDateKey(today), time: "11:00 AM", title: "Campus Tour & Admissions Counselling", place: "Admissions Office", type: "Admissions" },
    { date: toDateKey(today), time: "03:30 PM", title: "Senior School Debate Practice", place: "Auditorium", type: "Student Life" },
    { date: toDateKey(addDays(today, 1)), time: "10:00 AM", title: "Parent Orientation Session", place: "Main Auditorium", type: "Parents" },
    { date: toDateKey(addDays(today, 1)), time: "02:00 PM", title: "Inter-house Science Showcase", place: "Science Block", type: "Academics" },
    { date: toDateKey(addDays(today, 3)), time: "09:30 AM", title: "Under-14 Football Trials", place: "Sports Ground", type: "Sports" },
    { date: toDateKey(addDays(today, 5)), time: "12:30 PM", title: "Art Club Open Studio", place: "Visual Arts Room", type: "Activities" },
  ], [today]);

  const days = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const lastDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0);
    const items = [];
    for (let index = 0; index < firstDay.getDay(); index += 1) items.push(null);
    for (let day = 1; day <= lastDay.getDate(); day += 1) items.push(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
    while (items.length % 7 !== 0) items.push(null);
    return items;
  }, [visibleMonth]);

  const selectedKey = toDateKey(selectedDate);
  const selectedEvents = events.filter((event) => event.date === selectedKey);
  const monthName = visibleMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const selectedLabel = selectedDate.toDateString() === today.toDateString() ? "Today" : selectedDate.toDateString() === addDays(today, 1).toDateString() ? "Tomorrow" : selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const changeMonth = (offset) => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const chooseToday = () => { setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(today); };

  return (
    <div className="school-calendar-page">
      <header className="calendar-navbar">
        <Link className="calendar-brand" to="/"><SchoolCrest /><div><strong>Sheerwood</strong><small>International School</small></div></Link>
        <nav><Link to="/">Home</Link><Link to="/gallery">Gallery</Link><Link to="/login?flow=admission">Admissions</Link></nav>
        <Link className="calendar-login" to="/login">Parent Login</Link>
      </header>

      <main>
        <section className="calendar-hero">
          <div><span className="calendar-eyebrow">SHEERWOOD INTERNATIONAL SCHOOL</span><h1>School <em>Calendar</em></h1><p>Keep up with campus events, parent sessions, activities and important admissions dates.</p></div>
          <button type="button" onClick={chooseToday}>◉ Jump to today</button>
        </section>

        <section className="calendar-layout" aria-label="School events calendar">
          <div className="month-calendar-card">
            <header className="month-calendar-header"><button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</button><h2>{monthName}</h2><button type="button" onClick={() => changeMonth(1)} aria-label="Next month">›</button></header>
            <div className="calendar-weekdays">{weekdayNames.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="calendar-days">
              {days.map((date, index) => {
                if (!date) return <span className="calendar-empty" key={`empty-${index}`} />;
                const dateKey = toDateKey(date);
                const isToday = dateKey === toDateKey(today);
                const isSelected = dateKey === selectedKey;
                const eventCount = events.filter((event) => event.date === dateKey).length;
                return <button key={dateKey} type="button" onClick={() => setSelectedDate(date)} className={`${isToday ? "today" : ""} ${isSelected ? "selected" : ""}`} aria-label={`${date.toDateString()}${eventCount ? `, ${eventCount} events` : ""}`}><span>{date.getDate()}</span>{eventCount > 0 && <i>{eventCount}</i>}</button>;
              })}
            </div>
            <footer><span><i className="calendar-dot today-dot" />Today</span><span><i className="calendar-dot event-dot" />School event</span></footer>
          </div>

          <aside className="selected-events-card">
            <header><div><span className="calendar-eyebrow">EVENT SCHEDULE</span><h2>{selectedLabel}</h2></div><span className="calendar-date-number">{selectedDate.getDate()}</span></header>
            {selectedEvents.length > 0 ? <div className="calendar-event-list">{selectedEvents.map((event) => <article key={`${event.time}-${event.title}`}><time>{event.time}</time><div><span>{event.type}</span><h3>{event.title}</h3><p>⌖ {event.place}</p></div></article>)}</div> : <div className="calendar-no-events"><span>◌</span><h3>No events scheduled</h3><p>Select another date to see upcoming school activities.</p></div>}
          </aside>
        </section>

        <section className="calendar-upcoming" aria-labelledby="coming-up-title">
          <header><div><span className="calendar-eyebrow">NEXT AT SHEERWOOD</span><h2 id="coming-up-title">Coming <em>up.</em></h2></div><Link to="/login?flow=admission">Plan a campus visit <span>→</span></Link></header>
          <div>{events.map((event) => <article key={`upcoming-${event.time}-${event.title}`}><time><b>{new Date(`${event.date}T12:00:00`).toLocaleDateString("en-IN", { day: "2-digit" })}</b><small>{new Date(`${event.date}T12:00:00`).toLocaleDateString("en-IN", { month: "short" })}</small></time><div><span>{event.type}</span><h3>{event.title}</h3><p>{event.time} · {event.place}</p></div></article>)}</div>
        </section>
      </main>
    </div>
  );
}
