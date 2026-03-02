import OpenAI from "openai";
import type { Signal } from "./types";

export async function generatePost(signals: Signal[], styleSample: string): Promise<string> {
  if (signals.length === 0) {
    return "오늘은 공식 채용 업데이트가 확인되지 않았어요. 원문 공고를 수시로 확인하고 새로운 공지가 뜨면 바로 정리해드릴게요.";
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const facts = signals
    .slice(0, 8)
    .map(
      (s, i) =>
        `${i + 1}) 제목: ${s.title}\n   항공사: ${s.airline ?? "-"}\n   날짜: ${s.published_at ?? "-"}\n   링크: ${s.link}\n   요약: ${s.summary}`,
    )
    .join("\n");

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.5,
    messages: [
      {
        role: "system",
        content:
          "당신은 전직 대한항공 승무원 출신 취업 코치 계정 라이터다. 사실 기반만 사용. 형식은 훅 문장 뒤에 첫 번째/두 번째/세 번째 포인트와 마무리 체크 문장. 350~650자, 과장 금지, 링크 1~2개 포함.",
      },
      {
        role: "user",
        content: `[스타일 샘플]\n${styleSample}\n\n[팩트]\n${facts}\n\n오늘 아침 게시 초안 1개 작성`,
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || "";
}
