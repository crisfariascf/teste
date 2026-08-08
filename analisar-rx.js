import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

const RxSchema = z.object({
  qualidade: z.enum(["adequada", "limitada", "inadequada"]),
  incidencia: z.enum(["PA", "AP", "AP_supino", "lateral", "nao_informada"]),
  rotacao: z.boolean(),
  hipoinspiracao: z.boolean(),
  hiperinsuflacao: z.boolean(),
  espessamento_peribronquico: z.boolean(),
  opacidades_intersticiais: z.boolean(),
  consolidacao: z.boolean(),
  multilobar: z.boolean(),
  atelectasia: z.boolean(),
  derrame: z.boolean(),
  pneumotorax: z.boolean(),
  cavitacao: z.boolean(),
  cardiomegalia_aparente: z.boolean(),
  descricao: z.string(),
  limitacoes: z.array(z.string()),
  confianca: z.enum(["baixa", "moderada", "alta"]),
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY não foi configurada na Vercel.",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const imageDataUrl = body?.imageDataUrl;

    if (!imageDataUrl || !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(imageDataUrl)) {
      return res.status(400).json({
        error: "Imagem inválida. Envie PNG, JPEG ou WEBP.",
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5.6",
      reasoning: { effort: "low" },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Você está realizando uma PRÉ-LEITURA assistida de uma radiografia de tórax pediátrica para revisão por médico.

Avalie SOMENTE o que estiver visualmente sustentado na imagem. Não invente achados. Não diagnostique etiologia viral ou bacteriana e não recomende antibiótico ou tratamento.

Avalie:
- qualidade técnica e incidência, quando inferível;
- rotação e hipoinspiração;
- hiperinsuflação;
- espessamento peribrônquico/perihilar;
- opacidades intersticiais;
- consolidação focal;
- acometimento multilobar/extenso;
- atelectasia;
- derrame pleural;
- pneumotórax;
- cavitação/pneumatoceles;
- silhueta cardíaca aparente.

Na descrição, use português médico curto e objetivo. Registre limitações técnicas. Se um achado não puder ser avaliado com segurança, seja conservador e registre a limitação. A saída é apoio à revisão médica e não um laudo radiológico autônomo.`,
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(RxSchema, "rx_torax_pediatrico"),
      },
    });

    if (!response.output_parsed) {
      return res.status(502).json({
        error: "A IA não retornou uma resposta estruturada utilizável.",
      });
    }

    return res.status(200).json({
      ...response.output_parsed,
      _modo: `API — ${process.env.OPENAI_MODEL || "gpt-5.6"}`,
    });
  } catch (error) {
    console.error("Erro em /api/analisar-rx:", error);
    return res.status(500).json({
      error: error?.message || "Erro interno ao analisar a radiografia.",
    });
  }
}
