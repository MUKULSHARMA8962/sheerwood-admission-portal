import { useState } from "react";
import { Link } from "react-router-dom";
import campusFilm from "../assets/campus-film.mp4";
import campusAerial from "../assets/sheerwood-campus-aerial-web.jpg";
import academics from "../assets/gallery-academics.png";
import sports from "../assets/gallery-sports.png";
import hostel from "../assets/gallery-hostel.png";
import auditorium from "../assets/sheerwood-auditorium-web.jpg";
import SchoolCrest from "../components/SchoolCrest";
import "./VirtualTour.css";

const tourStops = [
  { number: "01", title: "Welcome to Sheerwood", subtitle: "The green campus", text: "Step into a calm, vibrant campus designed for meaningful learning and confident growth.", image: campusAerial, alt: "Aerial view of the Sheerwood campus" },
  { number: "02", title: "Learning spaces", subtitle: "Academics", text: "Explore classrooms and collaborative spaces where questions, experiments and ideas come alive.", image: academics, alt: "Students learning in a science classroom" },
  { number: "03", title: "Play & perform", subtitle: "Sports and activities", text: "From sports grounds to cultural stages, every learner has room to discover their strengths.", image: sports, alt: "Students participating in sports" },
  { number: "04", title: "A home away from home", subtitle: "Boarding life", text: "Our boarding environment balances care, comfort, friendships and independence.", image: hostel, alt: "Sheerwood hostel building" },
  { number: "05", title: "Gather & celebrate", subtitle: "Auditorium", text: "School assemblies, celebrations and performances bring the Sheerwood community together.", image: auditorium, alt: "Sheerwood school auditorium" },
];

export default function VirtualTour() {
  const [activeStop, setActiveStop] = useState(0);
  const active = tourStops[activeStop];

  return (
    <div className="virtual-tour-page">
      <header className="virtual-tour-nav">
        <Link className="virtual-tour-brand" to="/"><SchoolCrest /><div><strong>Sheerwood</strong><small>International School</small></div></Link>
        <div><Link to="/">Home</Link><Link to="/gallery">Gallery</Link><Link to="/calendar">Calendar</Link><Link className="tour-admission-link" to="/login?flow=admission">Start Admission</Link></div>
      </header>

      <main>
        <section className="virtual-tour-hero">
          <video autoPlay muted loop playsInline preload="metadata" aria-label="A video view of the Sheerwood campus"><source src={campusFilm} type="video/mp4" /></video>
          <div className="virtual-tour-hero-overlay" />
          <div className="virtual-tour-hero-copy"><span>◉ VIRTUAL SCHOOL TOUR</span><h1>Walk through <em>Sheerwood.</em></h1><p>Experience the places where students learn, explore, play and belong—wherever you are.</p><a href="#tour-stops">Start the tour <b>↓</b></a></div>
          <aside><span>01</span><div><b>Campus film</b><small>2 minute overview</small></div><a href="#tour-film" aria-label="Watch campus film">▶</a></aside>
        </section>

        <section id="tour-film" className="virtual-tour-film">
          <header><div><span>THE SHEERWOOD EXPERIENCE</span><h2>See our campus in <em>motion.</em></h2></div><p>Take a guided look at everyday life and the spaces that make Sheerwood feel like home.</p></header>
          <div className="virtual-tour-video"><video controls playsInline preload="metadata" poster={campusAerial}><source src={campusFilm} type="video/mp4" />Your browser does not support video.</video></div>
        </section>

        <section id="tour-stops" className="tour-stops-section">
          <header><span>EXPLORE BY STOP</span><h2>Your tour, <em>your pace.</em></h2><p>Select a stop to see a little more of the Sheerwood campus.</p></header>
          <div className="tour-stop-layout">
            <div className="tour-stop-list" role="tablist" aria-label="Virtual tour stops">
              {tourStops.map((stop, index) => <button key={stop.number} type="button" role="tab" aria-selected={activeStop === index} className={activeStop === index ? "active" : ""} onClick={() => setActiveStop(index)}><span>{stop.number}</span><div><b>{stop.title}</b><small>{stop.subtitle}</small></div><i>→</i></button>)}
            </div>
            <article className="tour-stop-feature" aria-live="polite"><img src={active.image} alt={active.alt} /><div><span>{active.number} · {active.subtitle}</span><h3>{active.title}</h3><p>{active.text}</p><Link to="/login?flow=admission">Book a campus visit <b>→</b></Link></div></article>
          </div>
        </section>

        <section className="virtual-tour-visit">
          <div><span>READY TO EXPERIENCE MORE?</span><h2>Come see it <em>in person.</em></h2><p>Book a guided campus visit with our admissions team and discover if Sheerwood is the right place for your child.</p></div><div><Link to="/login?flow=admission">Book a visit <span>→</span></Link><Link to="/calendar">View upcoming events</Link></div>
        </section>
      </main>
    </div>
  );
}
