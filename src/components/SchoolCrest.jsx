import crest from "../assets/sheerwood-crest.png";
import "./SchoolCrest.css";

export default function SchoolCrest({ className = "" }) {
  return <span className={`school-crest ${className}`.trim()} aria-hidden="true"><img src={crest} alt="" /></span>;
}
