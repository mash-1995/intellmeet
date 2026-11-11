const OpenAI = require('openai');

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_CHARS = 24000;

const SYSTEM_PROMPT = `You are an assistant that turns raw meeting transcripts into clear minutes.
Return ONLY valid JSON with this exact shape:
{
  "summary": "2-4 sentence overview",
  "keyPoints": ["short bullet", ...],
  "decisions": ["decision that was made", ...],
  "actionItems": [{ "task": "what must be done", "assignee": "person or empty string", "dueDate": "date text or empty string" }]
}
Only include action items and decisions that are actually in the transcript.`;

const formatTranscript = (entries) =>
  entries.map((t) => `${t.speakerName || 'Speaker'}: ${t.text}`).join('\n');

/** Small fallback so the product still works without an OpenAI key. */
const heuristicSummary = (entries) => {
  const sentences = entries
    .flatMap((t) => t.text.split(/(?<=[.!?])\s+/).map((s) => ({ s: s.trim(), who: t.speakerName })))
    .filter((x) => x.s.length > 12);

  const actionRx = /\b(will|need to|needs to|should|must|action item|todo|to-do|follow up|let's|i'll|we'll)\b/i;
  const decisionRx = /\b(decided|agreed|decision|we're going with|approved|let's go with)\b/i;

  const actionItems = sentences
    .filter((x) => actionRx.test(x.s))
    .slice(0, 8)
    .map((x) => ({ task: x.s, assignee: x.who || '', dueDate: '' }));
  const decisions = sentences.filter((x) => decisionRx.test(x.s)).slice(0, 6).map((x) => x.s);
  const keyPoints = [...sentences]
    .sort((a, b) => b.s.length - a.s.length)
    .slice(0, 5)
    .map((x) => x.s);

  const speakers = [...new Set(entries.map((t) => t.speakerName).filter(Boolean))];
  return {
    summary: `${speakers.length} participant${speakers.length === 1 ? '' : 's'} (${speakers.join(', ')}) spoke across ${
      entries.length
    } transcript segments. Add an OPENAI_API_KEY on the server for a full AI-written summary.`,
    keyPoints,
    decisions,
    actionItems,
  };
};

exports.summarizeMeeting = async (transcriptEntries) => {
  if (!transcriptEntries || transcriptEntries.length === 0) {
    return { summary: 'No transcript was captured for this meeting.', keyPoints: [], decisions: [], actionItems: [] };
  }
  if (!client) return heuristicSummary(transcriptEntries);

  try {
    let text = formatTranscript(transcriptEntries);
    if (text.length > MAX_CHARS) text = text.slice(-MAX_CHARS);

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Transcript:\n${text}` },
      ],
    });
    const parsed = JSON.parse(completion.choices[0].message.content);
    return {
      summary: parsed.summary || '',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems
            .filter((a) => a && a.task)
            .map((a) => ({
              task: String(a.task),
              assignee: a.assignee ? String(a.assignee) : '',
              dueDate: a.dueDate ? String(a.dueDate) : '',
            }))
        : [],
    };
  } catch (err) {
    console.error('OpenAI summarization failed, using fallback:', err.message);
    return heuristicSummary(transcriptEntries);
  }
};
