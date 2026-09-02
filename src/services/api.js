import { getSchoolInformationAnswer, schoolInformationContext } from "./schoolInformation";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

export async function askSchoolAI(prompt, audience = "guest") {
  const schoolInformationAnswer = getSchoolInformationAnswer(prompt);
  if (schoolInformationAnswer) return schoolInformationAnswer;

  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `${schoolInformationContext}\n\nUse only this official school information when it answers the question. If the information is not available, say that the admissions team can confirm it.\n\nParent question: ${prompt}`,
      audience,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "AI service is temporarily unavailable. Please try again shortly.");
  return data.answer;
}
