export const schoolInformationContext = `
Official information for Sherwood College:

Admissions and eligibility
- For the 2027–28 academic session, birth-year eligibility is: Class 3 — 2018 or 2019; Class 4 — 2017 or 2018; Class 5 — 2016 or 2017; Class 6 — 2015 or 2016; Class 7 — 2014 or 2015; Class 8 — 2013 or 2014; Class 9 — 2012 or 2013; Class 11 — 2010 or 2011. The application form calculates the matching range for each academic session.
- Admissions are not offered for Classes 10 and 12. For Grades 9 and 11, eligibility is based on entrance-test and interview performance; the Class 11 stream is also considered.
- The entrance test is online, with English and Mathematics papers. Each paper is one hour.
- The interaction panel decides the student and parent interaction outcome.
- Families first register on the school website. The school emails the entrance-test syllabus, date and time. Children who qualify proceed to the Principal's Interaction. Qualified applicants receive an offer letter by email.
- Required documents are the student's Aadhaar Card, a Birth Certificate issued by Nagar Nigam/Municipal Department, and the most recent mark sheet. After admission, the original Transfer Certificate must be submitted to the school office.
- Admissions close when seats are filled. Current availability should be confirmed with the admissions team.

Fees and financial policy
- Total annual charges, including all components, are approximately Rs. 7.5 lakh to Rs. 8 lakh.
- Payment is in two terms: Rs. 5 lakh at admission and an approximately Rs. 2.5 lakh to Rs. 3 lakh bill in June.
- There is no refund for a mid-term withdrawal and no scholarship programme.

Boarding and campus life
- Accommodation is dormitory-style. Each house has a Matron and Warden, along with House Masters and House Tutors.
- After admission, the school provides medical forms and a clothing checklist. Each house has its own laundry staff.
- Bullying or ragging can lead to suspension or expulsion.
- The school does not provide on-campus competitive coaching for SAT, JEE, NEET, CUET, CLAT or similar examinations.
- Students are encouraged to participate in all games. Inter-house matches and co-curricular activities are conducted.
- Foreign languages are not offered.

Gadgets, calling and leave
- Smartphones, basic phones, laptops and smartwatches are not allowed.
- Parent calling is limited to 15 minutes per week.
- One overnight leave is allowed in a term, subject to change.
- A Local Guardian must be within Nainital district.
- Before admission, parents should contact the admissions counsellor to book a visit; after admission, they should contact the House Master.

Dining and healthcare
- Vegetarian and non-vegetarian meals are available. Outside food is not allowed on campus.
- A resident doctor is available 24/7, supported by two staff nurses and a fully equipped ambulance. Visiting doctors attend on alternate days.
- Emergency support is available through B. D. Pandey Hospital and hospitals in Haldwani.
- On-campus child psychologist and mental-wellness support are available.
`.trim();

const frequentlyAskedQuestions = [
  {
    terms: ["class 10", "class 12", "grade 10", "grade 12"],
    answer: "Admissions are not offered for Classes 10 and 12. For Grades 9 and 11, admission eligibility is based on entrance-test and interview performance. For Class 11, the selected stream is also considered.",
  },
  {
    terms: ["class 3", "class 4", "class 5", "class 6", "class 7", "class 8", "class 9", "class 11", "grade 3", "grade 4", "grade 5", "grade 6", "grade 7", "grade 8", "grade 9", "grade 11", "birth year", "age cutoff", "age criteria", "age limit"],
    answer: "For 2027–28, the permitted birth years are: Class 3 — 2018 or 2019; Class 4 — 2017 or 2018; Class 5 — 2016 or 2017; Class 6 — 2015 or 2016; Class 7 — 2014 or 2015; Class 8 — 2013 or 2014; Class 9 — 2012 or 2013; and Class 11 — 2010 or 2011.",
  },
  {
    terms: ["entrance test", "entrance exam", "test pattern", "sample paper", "online test", "mathematics paper"],
    answer: "The entrance test is conducted online. It includes English and Mathematics, with one hour allowed for each paper. The test syllabus, date and time are emailed after website registration.",
  },
  {
    terms: ["principal", "interaction", "interview", "panel"],
    answer: "After qualifying the entrance test, the child moves to the Principal's Interaction. The interaction panel decides the outcome based on its assessment.",
  },
  {
    terms: ["document", "aadhaar", "aadhar", "birth certificate", "mark sheet", "marksheet", "transfer certificate", "tc"],
    answer: "Please keep the student's Aadhaar Card, a Birth Certificate issued by the Nagar Nigam/Municipal Department, and the most recent mark sheet ready. Once admission is confirmed, the original Transfer Certificate must be submitted to the school office.",
  },
  {
    terms: ["apply", "application process", "application workflow", "how to register", "how do i register", "offer letter"],
    answer: "First register on the school website. The entrance-test syllabus, date and time will be emailed. Children who qualify the entrance test proceed to the Principal's Interaction, and successful applicants receive an offer letter by email.",
  },
  {
    terms: ["seat", "availability", "deadline", "last date", "admission close"],
    answer: "Admissions close as and when seats are filled. Please contact the admissions team to confirm current seat availability.",
  },
  {
    terms: ["pocket money", "imprest", "7.5", "8 lakh", "8 lacks", "fee structure", "fee", "payment", "installment", "instalment"],
    answer: "The total annual charges, including all components, are approximately Rs. 7.5 lakh to Rs. 8 lakh. This is paid in two terms: Rs. 5 lakh at admission and an approximately Rs. 2.5 lakh to Rs. 3 lakh bill in June.",
  },
  {
    terms: ["refund", "withdraw", "withdrawal", "scholarship", "sibling discount", "alumni concession", "defence concession"],
    answer: "There is no refund for a mid-term withdrawal, and the school does not offer scholarships.",
  },
  {
    terms: ["dorm", "hostel", "boarding", "room", "accommodation"],
    answer: "Accommodation is dormitory-style. Boarding is organised house-wise, with a Matron and Warden in every house, supported by House Masters and House Tutors.",
  },
  {
    terms: ["matron", "warden", "house master", "house tutor", "pastoral"],
    answer: "Boarding is managed house-wise. Every house has one Matron and one Warden, with House Masters and House Tutors providing additional supervision.",
  },
  {
    terms: ["clothing", "checklist", "move in", "move-in", "medical form", "laundry", "linen"],
    answer: "After admission, the school provides the medical forms and clothing checklist. Each house has its own laundry staff.",
  },
  {
    terms: ["bully", "bullying", "ragging", "cctv"],
    answer: "Bullying and ragging are taken seriously and can lead to suspension or expulsion.",
  },
  {
    terms: ["coaching", "sat", "jee", "neet", "cuet", "clat"],
    answer: "The school does not provide on-campus competitive coaching for SAT, JEE, NEET, CUET, CLAT or similar examinations.",
  },
  {
    terms: ["sport", "game", "co-curricular", "activity", "inter house", "inter-house"],
    answer: "The school encourages students to play all games. Inter-house matches are conducted for games and co-curricular activities.",
  },
  {
    terms: ["foreign language", "second language", "language option"],
    answer: "Foreign languages are not offered.",
  },
  {
    terms: ["phone", "mobile", "smartphone", "laptop", "smartwatch", "gadget", "device"],
    answer: "Smartphones, basic phones, laptops and smartwatches are not allowed on campus.",
  },
  {
    terms: ["call", "calling", "video call", "video calling", "15 minute"],
    answer: "Parent calling is limited to 15 minutes per week.",
  },
  {
    terms: ["exeat", "overnight", "night leave", "outing", "leave"],
    answer: "One overnight leave is allowed in a term, subject to change.",
  },
  {
    terms: ["local guardian", "guardian", "nainital district"],
    answer: "A Local Guardian must be within Nainital district.",
  },
  {
    terms: ["campus visit", "visit campus", "visit booking", "admission counsellor"],
    answer: "Before admission, please contact the admissions counsellor to arrange a campus visit. After admission, please contact the House Master.",
  },
  {
    terms: ["meal", "mess", "vegetarian", "non veg", "non-veg", "jain", "food"],
    answer: "Vegetarian and non-vegetarian meals are available. Outside food is not allowed on campus.",
  },
  {
    terms: ["tuck", "parcel", "outside food"],
    answer: "Outside food is not allowed on campus.",
  },
  {
    terms: ["doctor", "infirmary", "ambulance", "hospital", "healthcare", "health care", "medical emergency"],
    answer: "A resident doctor is available 24/7, supported by two staff nurses and a fully equipped ambulance. Visiting doctors attend on alternate days. Emergency support is available through B. D. Pandey Hospital and hospitals in Haldwani.",
  },
  {
    terms: ["psychologist", "mental health", "mental wellness", "counselling support"],
    answer: "On-campus child psychologist and mental-wellness support are available.",
  },
  {
    terms: ["routine", "timetable", "wake up", "lights out", "study hour", "evening prep", "remedial"],
    answer: "Please contact the admissions team for the current daily timetable, evening prep supervision and remedial-support schedule.",
  },
];

export function getSchoolInformationAnswer(question) {
  const normalizedQuestion = question.toLowerCase();
  const matchedQuestion = frequentlyAskedQuestions.find(({ terms }) => terms.some((term) => normalizedQuestion.includes(term)));
  return matchedQuestion?.answer || null;
}
