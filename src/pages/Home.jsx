import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { askSchoolAI } from "../services/api";
import amitabhTestimonial from "../assets/amitabh-testimonial.png";
import aboutCampus from "../assets/about-campus.png";
import galleryAcademics from "../assets/gallery-academics.png";
import galleryCampus from "../assets/gallery-campus-library.png";
import galleryCulture from "../assets/gallery-culture.png";
import schoolCampusAerial from "../assets/sheerwood-campus-aerial-web.jpg";
import principalDeskPortrait from "../assets/principal-desk-portrait.png";
import homeHeroVideo from "../assets/home-hero-background.mp4";
import campusFilm from "../assets/campus-film.mp4";
import ThemeToggle from "../components/ThemeToggle";
import SchoolCrest from "../components/SchoolCrest";
import { useCognitoAuth } from "../auth/useCognitoAuth";
import "./Home.css";
import "./HomeFooter.css";
import "./HomeAbout.css";
import "./HomeTestimonial.css";
import "./HomeGallery.css";
import "./HomeHero.css";
import "./HomeAi.css";
import "./HomePrincipalUpdates.css";
import "./HomeAuth.css";

const features = [
  { number: "01", icon: "✦", title: "Smart Classrooms", text: "Interactive learning spaces created for curiosity and collaboration." },
  { number: "02", icon: "◆", title: "Sports & Activities", text: "Athletics, arts, clubs and leadership for balanced development." },
  { number: "03", icon: "✓", title: "Safe Campus", text: "A caring, secure environment supported by trained school staff." },
];

const aiQuickQuestions = ["What documents are required?", "How do I apply?", "What is the age criteria?"];

const homePosts = {
  today: [
    { category: "Admissions", title: "Admissions counselling desk is open today.", text: "Meet our team for application guidance and campus visit bookings.", time: "2h", replies: "12", reposts: "26", likes: "148" },
    { category: "Campus Life", title: "Students prepare for the Science Showcase.", text: "A preview of the creative projects arriving in the Science Block.", time: "5h", replies: "8", reposts: "19", likes: "97" },
  ],
  tomorrow: [
    { category: "Parents", title: "Parent orientation information is ready.", text: "Everything families need before the welcome session tomorrow.", time: "Tomorrow · 9:00 AM", replies: "4", reposts: "14", likes: "63" },
    { category: "Sports", title: "Sports trials registration reminder.", text: "Registration opens for football, basketball and athletics trials.", time: "Tomorrow · 11:30 AM", replies: "6", reposts: "21", likes: "88" },
  ],
};

const homeEvents = {
  today: [
    { time: "11:00 AM", title: "Campus Tour & Admissions Counselling", location: "Admissions Office" },
    { time: "03:30 PM", title: "Senior School Debate Practice", location: "Auditorium" },
  ],
  tomorrow: [
    { time: "10:00 AM", title: "Parent Orientation Session", location: "Main Auditorium" },
    { time: "02:00 PM", title: "Inter-house Science Showcase", location: "Science Block" },
  ],
};

export default function Home() {
  const navigate = useNavigate();
  const { user, signOut } = useCognitoAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [campusFilmOpen, setCampusFilmOpen] = useState(true);
  const [admissionCodeOpen, setAdmissionCodeOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiMessages, setAiMessages] = useState([{ role: "assistant", text: "Hello! I’m Sheerwood AI. How can I help with admissions today?" }]);
  const [aiLoading, setAiLoading] = useState(false);
  const [postsDay, setPostsDay] = useState("today");
  const [eventsDay, setEventsDay] = useState("today");
  const [principalExpanded, setPrincipalExpanded] = useState(false);

  useEffect(() => {
    if (window.location.hash === "#start-admission") {
      navigate("/new-user-dashboard", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (!campusFilmOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setCampusFilmOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [campusFilmOpen]);

  const askAiQuestion = async (question) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || aiLoading) return;

    setAiMessages((currentMessages) => [
      ...currentMessages,
      { role: "parent", text: trimmedQuestion },
    ]);
    setAiQuestion("");
    setAiLoading(true);
    try {
      const answer = await askSchoolAI(trimmedQuestion, "parent");
      setAiMessages((currentMessages) => [...currentMessages, { role: "assistant", text: answer }]);
    } catch (error) {
      setAiMessages((currentMessages) => [...currentMessages, { role: "assistant", text: error.message }]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div>
      <header className="navbar">
        <a className="brand" href="#home">
          <SchoolCrest className="logo" />
          <span><strong>Sheerwood</strong><small>International School</small></span>
        </a>

        <div className="header-controls">
          <nav className={menuOpen ? "navlinks open" : "navlinks"}>
            <a href="#home">Home</a>
            <a href="#about">About</a>
            <a href="#campus">Campus Life</a>
            <a href="#gallery">Gallery</a>
            <a href="#admission">Admissions</a>
            <a href="#contact">Contact</a>
            {user ? <button className="login-link logout-link" type="button" onClick={signOut}>Logout ({user.role})</button> : <Link className="login-link" to="/login">Login with Cognito</Link>}
          </nav>
          <ThemeToggle />
          <button className="menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">☰</button>
        </div>
      </header>

      <main>
        <section id="home" className="hero">
          <div className="hero-backgrounds" aria-hidden="true">
            <video className="hero-background-video" autoPlay muted loop playsInline preload="metadata">
              <source src={homeHeroVideo} type="video/mp4" />
            </video>
          </div>
          <div className="hero-copy">
            <span className="badge">Admissions open for 2027–28</span>
            <h1>Where young minds<br /><em>grow with purpose.</em></h1>
            <p>Academic excellence, strong values and future-ready learning—together in one inspiring campus.</p>
            <div className="hero-actions">
              <Link className="primary" to="/login?flow=admission">Start Admission <span>→</span></Link>
              <button className="admission-code-trigger" type="button" onClick={() => setAdmissionCodeOpen(true)}><span aria-hidden="true">▦</span> Scan to apply</button>
              <Link className="text-link" to="/login">Already applied? Login</Link>
            </div>
            <div className="stats">
              <span><b>40+</b><small>Years of excellence</small></span>
              <span><b>98%</b><small>Academic success</small></span>
              <span><b>25+</b><small>Student activities</small></span>
            </div>
          </div>

          <aside className="hero-art home-hero-card" aria-label="Sheerwood campus highlights">
            <span className="hero-card-eyebrow">SHEERWOOD CAMPUS</span>
            <SchoolCrest className="hero-card-mark" />
            <h2>Inspired by<br />the hills.</h2>
            <p>A vibrant campus where academic ambition meets open skies and possibility.</p>
            <div className="hero-card-details"><span><b>45 acres</b><small>Green campus</small></span><span><b>40+</b><small>Years of learning</small></span></div>
            <button className="campus-film-trigger" type="button" onClick={() => setCampusFilmOpen(true)}>
              <span aria-hidden="true">▶</span> Watch campus film
            </button>
          </aside>
        </section>

        <section id="about" className="section welcome">
          <div><span className="label">WELCOME TO SHEERWOOD</span><h2>Learning beyond<br />the classroom.</h2></div>
          <div className="welcome-copy"><p>We nurture confident, compassionate and capable learners through a thoughtful blend of tradition, technology and personal attention.</p><a href="#campus">Discover our school ↗</a></div>
        </section>

        <section className="section about-sheerwood">
          <div className="about-image-wrap"><img src={aboutCampus} alt="A tree-lined entrance to the Sheerwood campus" /></div>
          <div className="about-story"><span className="label">OUR HERITAGE</span><h2>About Sheerwood</h2><p>Spread across a green campus surrounded by nature, Sheerwood International School is a place where curiosity, character and learning come together.</p><p>Our school community creates meaningful opportunities in academics, arts, sports and service—helping every child become a confident, compassionate and capable citizen of the world.</p><p>With caring teachers and future-ready learning spaces, we support students through every stage of their educational journey.</p><Link to="/admission-details">Discover Sheerwood <span>→</span></Link></div>
        </section>

        <section className="alumni-testimonial" aria-labelledby="alumni-testimonial-title">
          <div className="testimonial-person"><img src={amitabhTestimonial} alt="Amitabh Bachchan" /><div><h2 id="alumni-testimonial-title">Amitabh Bachchan</h2><p>Film Actor</p></div></div>
          <blockquote>“The school that influenced me most was Sheerwood College in Nainital. It taught me to be independent, fearless, loyal and truthful—values that, I think, have stayed with me through life.”</blockquote>
        </section>

        <section id="campus" className="section feature-grid">
          {features.map((item) => (
            <article className="feature" key={item.number}>
              <span className="feature-number">{item.number}</span><div className="feature-icon">{item.icon}</div>
              <h3>{item.title}</h3><p>{item.text}</p><a href="#contact">Explore →</a>
            </article>
          ))}
        </section>

        <section id="gallery" className="section home-gallery">
          <header><div><span className="label">SHEERWOOD MOMENTS</span><h2>Life in <em>focus.</em></h2></div><Link to="/gallery">View Full Gallery <span>→</span></Link></header>
          <div className="home-gallery-grid"><Link to="/gallery" className="gallery-preview tall"><img src={schoolCampusAerial} alt="Aerial view of the Sheerwood campus" loading="lazy" /><span>Our Campus</span></Link><Link to="/gallery" className="gallery-preview wide"><img src={galleryCulture} alt="Students performing at a school cultural event" loading="lazy" /><span>Student Life</span></Link><Link to="/gallery" className="gallery-preview"><img src={galleryCampus} alt="The Sheerwood campus library courtyard" loading="lazy" /><span>Campus Life</span></Link><Link to="/gallery" className="gallery-preview"><img src={galleryAcademics} alt="Students learning together in a science lab" loading="lazy" /><span>Learning Together</span></Link></div>
        </section>

        <section className="section home-principal-events">
          <article className="principal-desk-card">
            <div className="principal-portrait" aria-label="Principal's desk">
              <img src={principalDeskPortrait} alt="Mr. Amandeep Sandhu, Principal of Sheerwood International School" />
            </div>
            <div className="principal-desk-copy">
              <span className="label">FROM THE PRINCIPAL'S DESK</span>
              <h2>From The <em>Principal&apos;s Desk</em></h2>
              <p>At Sheerwood, every child is encouraged to grow into a confident, compassionate and responsible citizen—ready to contribute with purpose.</p>
              {principalExpanded && <p className="principal-more">Our educators create a caring environment where curiosity, character and academic ambition can flourish together.</p>}
              <b>Mr. Amandeep Sandhu</b>
              <small>Principal, Sheerwood International School</small>
              <button className="principal-read-more" type="button" onClick={() => setPrincipalExpanded((current) => !current)}>{principalExpanded ? "Show Less" : "Read More"} <span>→</span></button>
            </div>
          </article>

          <aside className="home-events-card" aria-labelledby="upcoming-events-title">
            <div className="home-updates-heading"><div><span className="label">SCHOOL CALENDAR</span><h2 id="upcoming-events-title">Upcoming <em>Events</em></h2></div><span className="calendar-icon" aria-hidden="true">▣</span></div>
            <div className="home-update-tabs" role="tablist" aria-label="Choose events day">
              {[["today", "Today"], ["tomorrow", "Tomorrow"]].map(([day, label]) => <button key={day} type="button" role="tab" aria-selected={eventsDay === day} className={eventsDay === day ? "active" : ""} onClick={() => setEventsDay(day)}>{label}</button>)}
            </div>
            <div className="event-list">
              {homeEvents[eventsDay].map((event) => <article className="event-item" key={event.title}><time>{event.time}</time><div><h3>{event.title}</h3><p>⌖ {event.location}</p></div></article>)}
            </div>
            <Link className="view-calendar" to="/calendar">View full calendar <span>→</span></Link>
          </aside>
        </section>

        <section className="section home-posts" aria-labelledby="school-posts-title">
          <header className="home-posts-header"><div><span className="label">SCHOOL UPDATES</span><h2 id="school-posts-title">What&apos;s happening at <em>Sheerwood.</em></h2></div><div className="home-update-tabs" role="tablist" aria-label="Choose posts day">{[["today", "Today"], ["tomorrow", "Tomorrow"]].map(([day, label]) => <button key={day} type="button" role="tab" aria-selected={postsDay === day} className={postsDay === day ? "active" : ""} onClick={() => setPostsDay(day)}>{label}</button>)}</div></header>
          <div className="home-social-feed">
            {homePosts[postsDay].map((post) => <article className="home-post-card" key={post.title}>
              <SchoolCrest className="home-post-avatar" />
              <div className="home-post-body">
                <header><strong>Sheerwood International School</strong><span className="post-verified" title="Verified school account">✓</span><span>@SheerwoodSchool · {post.time}</span><button type="button" aria-label="More post options">•••</button></header>
                <p><span className="home-post-category">{post.category}</span>{post.title} {post.text}</p>
                <a href="#contact">View update <span>→</span></a>
                <footer className="home-post-actions" aria-label="Post engagement"><span>◯ {post.replies}</span><span>⇄ {post.reposts}</span><span>♡ {post.likes}</span><span>⌁</span></footer>
              </div>
            </article>)}
          </div>
        </section>

        <section id="admission" className="section cta">
          <span>2027–28 ADMISSIONS</span><h2>Your child’s next great<br />chapter starts here.</h2>
          <div><Link to="/admission-details">Apply for Admission →</Link><Link to="/track-application">Track Application</Link></div>
        </section>
      </main>

      <section className="follow-us" aria-labelledby="follow-us-title">
        <h2 id="follow-us-title">Follow Us</h2>
        <div><button aria-label="Follow Sheerwood on Twitter">𝕏</button><button aria-label="Follow Sheerwood on Facebook">f</button><button aria-label="Follow Sheerwood on Google">G</button><button aria-label="Follow Sheerwood on LinkedIn">in</button><button aria-label="Follow Sheerwood on YouTube">▶</button></div>
      </section>

      <footer id="contact" className="school-footer">
        <section className="footer-overview"><div className="footer-brand"><SchoolCrest className="footer-crest" /><span><strong>Sheerwood</strong><small>International School</small></span></div><p>Nurturing knowledge, character and possibility for every learner.</p><address>◎ Sherwood College, Nainital<br /><br />▯ +91 98765 43210<br />✉ admissions@sherwood.edu.in</address></section>
        <section><h3>Admissions</h3><a href="#admission">Admission Process</a><Link to="/admission-details">Online Application</Link><a href="#admission">Important Dates</a><Link to="/track-application">Track Application</Link></section>
        <section><h3>Academics</h3><a href="#about">Our Learning Approach</a><a href="#campus">Campus Life</a><a href="#campus">Clubs &amp; Societies</a><a href="#campus">Events &amp; Activities</a></section>
        <section><h3>Facilities</h3><a href="#campus">Infrastructure</a><a href="#campus">Sports &amp; Activities</a><a href="#contact">Contact Us</a><Link to="/ai-assistant">Ask Sheerwood AI</Link></section>
        <div className="footer-bottom"><span>© 2026 Sheerwood International School. All rights reserved.</span><span>Privacy Policy　|　Terms &amp; Conditions</span></div>
      </footer>

      {campusFilmOpen && (
        <div className="campus-film-popup-wrap">
          <button className="campus-film-backdrop" type="button" onClick={() => setCampusFilmOpen(false)} aria-label="Close campus film" />
          <section className="campus-film-popup" role="dialog" aria-modal="true" aria-labelledby="campus-film-title">
            <header>
              <div><span>▶</span><p><b id="campus-film-title">Sheerwood campus film</b><small>A glimpse of life at Sheerwood</small></p></div>
              <button type="button" onClick={() => setCampusFilmOpen(false)} aria-label="Close campus film">×</button>
            </header>
            <video controls autoPlay playsInline preload="metadata">
              <source src={campusFilm} type="video/mp4" />
              Your browser does not support embedded video.
            </video>
            <Link className="campus-film-full-tour" to="/virtual-tour">Explore the virtual school tour <span>→</span></Link>
          </section>
        </div>
      )}

      {admissionCodeOpen && (
        <div className="admission-code-popup-wrap">
          <button className="admission-code-backdrop" type="button" onClick={() => setAdmissionCodeOpen(false)} aria-label="Close admission barcode" />
          <section className="admission-code-popup" role="dialog" aria-modal="true" aria-labelledby="admission-code-title">
            <button className="admission-code-close" type="button" onClick={() => setAdmissionCodeOpen(false)} aria-label="Close admission barcode">×</button>
            <span className="admission-code-icon" aria-hidden="true">▦</span>
            <p>ADMISSION ACCESS</p>
            <h2 id="admission-code-title">Scan to start an admission</h2>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(`${window.location.origin}/#start-admission`)}`} alt="QR code to open the Sheerwood admission welcome page" />
            <small>Scan this code with a phone camera to open your admission welcome page.</small>
            <Link to="/new-user-dashboard" className="admission-code-open">Open on this device →</Link>
          </section>
        </div>
      )}

      {aiOpen && (
        <section id="home-ai-popup" className="home-ai-popup" role="dialog" aria-modal="false" aria-labelledby="home-ai-title">
          <header className="home-ai-header">
            <div><span>✦</span><p><b id="home-ai-title">Sheerwood AI</b><small><i /> Online</small></p></div>
            <button onClick={() => setAiOpen(false)} aria-label="Close AI chat">×</button>
          </header>
          <div className="home-ai-messages" aria-live="polite">
            {aiMessages.map((message, index) => <p className={message.role === "parent" ? "parent-message" : "assistant-message"} key={`${message.role}-${index}`}>{message.text}</p>)}
            {aiLoading && <p className="assistant-message ai-loading">Thinking…</p>}
          </div>
          <div className="home-ai-quick-actions">
            {aiQuickQuestions.map((question) => <button key={question} onClick={() => askAiQuestion(question)} disabled={aiLoading}>{question}</button>)}
          </div>
          <form className="home-ai-form" onSubmit={(event) => { event.preventDefault(); askAiQuestion(aiQuestion); }}>
            <input value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} placeholder="Type your question..." aria-label="Ask Sheerwood AI a question" disabled={aiLoading} />
            <button type="submit" aria-label="Send question" disabled={aiLoading}>{aiLoading ? "…" : "→"}</button>
          </form>
          <Link className="home-ai-full-link" to="/ai-assistant">Open full AI Assistant ↗</Link>
        </section>
      )}
      <button className="ai" onClick={() => setAiOpen((isOpen) => !isOpen)} aria-expanded={aiOpen} aria-controls="home-ai-popup"><span>✦</span> Ask Sheerwood AI</button>
    </div>
  );
}
