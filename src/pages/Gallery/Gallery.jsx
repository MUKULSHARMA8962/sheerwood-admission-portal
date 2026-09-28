import { useState } from "react";
import { Link } from "react-router-dom";
import academics from "../../assets/gallery-academics.png";
import campusLibrary from "../../assets/gallery-campus-library.png";
import campus from "../../assets/about-campus.png";
import culture from "../../assets/gallery-culture.png";
import hostel from "../../assets/gallery-hostel.png";
import hostelBuilding from "../../assets/gallery-hostel-building.png";
import sports from "../../assets/gallery-sports.png";
import campusAerial from "../../assets/sheerwood-campus-aerial-web.jpg";
import campusEvent from "../../assets/sheerwood-campus-event-web.jpg";
import studentAuditorium from "../../assets/sheerwood-auditorium-web.jpg";
import studentFormation from "../../assets/sheerwood-student-formation-web.jpg";
import studentGroup from "../../assets/sheerwood-student-group-web.jpg";
import SchoolCrest from "../../components/SchoolCrest";
import "./Gallery.css";

const filters = ["All", "Student", "Campus", "Hostel"];
const photos = [
  { image: campusAerial, title: "Sherwood College Campus", category: "Campus", size: "wide aerial-view" },
  { image: studentFormation, title: "School performance", category: "Student", size: "tall" },
  { image: studentGroup, title: "Sherwood College student leaders", category: "Student", size: "wide" },
  { image: campusEvent, title: "A special campus occasion", category: "Student", size: "square" },
  { image: studentAuditorium, title: "Learning together", category: "Student", size: "wide auditorium-view" },
  { image: campus, title: "A welcoming campus", category: "Campus", size: "tall campus-view" },
  { image: campusLibrary, title: "Library courtyard", category: "Campus", size: "wide" },
  { image: hostel, title: "Life at the hostel", category: "Hostel", size: "wide hostel-view" },
  { image: hostelBuilding, title: "A home away from home", category: "Hostel", size: "square" },
  { image: sports, title: "Sports champions", category: "Student", size: "square sports-close" },
  { image: academics, title: "Learning through discovery", category: "Student", size: "square lab-view" },
  { image: culture, title: "Celebrating culture", category: "Student", size: "square" },
];

export default function Gallery() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const visiblePhotos = activeFilter === "All" ? photos : photos.filter((photo) => photo.category === activeFilter);

  return (
    <main className="gallery-page">
      <header className="gallery-header">
        <Link className="gallery-brand" to="/"><SchoolCrest /><div><strong>Sherwood</strong><small>College</small></div></Link>
        <nav><Link to="/">Home</Link><Link to="/#about">About</Link><Link to="/#campus">Campus Life</Link><Link className="current" to="/gallery">Gallery</Link><Link to="/admission-details">Admission</Link><Link to="/login">Parent Login</Link></nav>
      </header>

      <section className="gallery-content">
        <p className="gallery-kicker">SHERWOOD COLLEGE MOMENTS</p><h1>Our <em>Gallery</em></h1><p className="gallery-intro">A glimpse into the everyday moments that make life at Sherwood College vibrant, meaningful and memorable.</p>
        <div className="gallery-filters" role="tablist" aria-label="Gallery categories">{filters.map((filter) => <button className={activeFilter === filter ? "active" : ""} key={filter} role="tab" aria-selected={activeFilter === filter} onClick={() => setActiveFilter(filter)}>{filter}</button>)}</div>
        <div className="gallery-grid">{visiblePhotos.map((photo, index) => <button className={`gallery-photo ${photo.size}`} key={`${photo.title}-${index}`} onClick={() => setSelectedPhoto(photo)}><img src={photo.image} alt={photo.title} loading="lazy" /><span><b>{photo.title}</b><small>{photo.category}</small></span></button>)}</div>
      </section>

      {selectedPhoto && <div className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={selectedPhoto.title} onClick={() => setSelectedPhoto(null)}><figure onClick={(event) => event.stopPropagation()}><button aria-label="Close image" onClick={() => setSelectedPhoto(null)}>×</button><img src={selectedPhoto.image} alt={selectedPhoto.title} /><figcaption>{selectedPhoto.title}<small>{selectedPhoto.category}</small></figcaption></figure></div>}
    </main>
  );
}
