export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb"
    }
  }
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido. Use POST." });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        erro: "OPENAI_API_KEY não está configurada neste deployment da Vercel."
      });
    }

    let body = req.body || {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ erro: "JSON inválido recebido pelo backend." });
      }
    }

    const imagem =
      body.imageDataUrl ||
      body.imagem ||
      body.image ||
      body.imageData ||
      body.dataUrl;

    if (!imagem) {
      return res.status(400).json({
        erro: "Nenhuma imagem foi recebida. Campo esperado: imageDataUrl."
      });
    }

    if (typeof imagem !== "string" || !imagem.startsWith("data:image/")) {
      return res.status(400).json({
        erro: "Formato de imagem inválido. Envie a radiografia como Data URL."
      });
    }

    if (imagem.length > 9_000_000) {
      return res.status(413).json({
        erro: "Imagem muito grande após processamento. Tente uma imagem menor."
      });
    }

    const prompt = `
Você está realizando uma PRÉ-LEITURA ASSISTIDA de uma radiografia de tórax, possivelmente pediátrica.

Analise somente o que é visualmente avaliável na imagem.

Regras:
- Não determine antibioticoterapia.
- Não conclua etiologia viral ou bacteriana apenas pela radiografia.
- Não invente achados.
- Se algo não puder ser avaliado, registre a limitação.
- Seja conservador em achados duvidosos.
- A interpretação será revisada por médico.

Avalie:
1. Qualidade técnica.
2. Incidência aparente.
3. Rotação.
4. Hipoinspiração.
5. Exposição/penetração inadequada.
6. Hiperinsuflação pulmonar.
7. Espessamento peribrônquico/perihilar.
8. Opacidades intersticiais/perihilares.
9. Consolidação focal/alveolar.
10. Localização da consolidação, se presente.
11. Acometimento multilobar/extenso.
12. Atelectasia.
13. Derrame pleural.
14. Pneumotórax.
15. Cavitação/pneumatoceles.
16. Aumento aparente da área cardíaca.
17. Outros achados relevantes.
18. Limitações.

Retorne SOMENTE JSON válido, sem markdown, neste formato:
{
  "qualidade": "adequada",
  "incidencia": "AP",
  "rotacao": false,
  "hipoinspiracao": false,
  "exposicao_inadequada": false,
  "hiperinsuflacao": false,
  "espessamento_peribronquico": false,
  "opacidades_intersticiais": false,
  "consolidacao": false,
  "local_consolidacao": null,
  "multilobar": false,
  "atelectasia": false,
  "derrame": false,
  "pneumotorax": false,
  "cavitacao": false,
  "cardiomegalia_aparente": false,
  "outros_achados": "",
  "descricao": "",
  "limitacoes": [],
  "confianca": "moderada"
}

Valores permitidos:
- qualidade: adequada, limitada ou inadequada
- incidencia: AP, PA, AP supino, lateral ou indeterminada
- confianca: baixa, moderada ou alta
- campos booleanos: true ou false
`;

    const model = process.env.OPENAI_MODEL || "gpt-5";

    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              { type: "input_image", image_url: imagem, detail: "high" }
            ]
          }
        ],
        max_output_tokens: 1800
      })
    });

    const raw = await openaiResponse.text();
    let dados;

    try {
      dados = raw ? JSON.parse(raw) : {};
    } catch {
      console.error("Resposta não JSON da OpenAI:", raw);
      return res.status(502).json({
        erro: "A OpenAI respondeu em formato inesperado.",
        detalhe: raw.slice(0, 500)
      });
    }

    if (!openaiResponse.ok) {
      console.error("Erro OpenAI:", dados);
      return res.status(openaiResponse.status).json({
        erro:
          dados?.error?.message ||
          dados?.error?.code ||
          `Erro da OpenAI (HTTP ${openaiResponse.status}).`
      });
    }

    let texto = "";

    if (typeof dados.output_text === "string") {
      texto = dados.output_text;
    }

    if (!texto && Array.isArray(dados.output)) {
      for (const item of dados.output) {
        if (!Array.isArray(item.content)) continue;
        for (const content of item.content) {
          if (content.type === "output_text" && typeof content.text === "string") {
            texto += content.text;
          }
        }
      }
    }

    if (!texto) {
      console.error("Resposta sem texto:", dados);
      return res.status(502).json({
        erro: "A OpenAI respondeu, mas não retornou texto interpretável."
      });
    }

    texto = texto
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const inicio = texto.indexOf("{");
    const fim = texto.lastIndexOf("}");
    if (inicio >= 0 && fim > inicio) {
      texto = texto.slice(inicio, fim + 1);
    }

    let resultado;
    try {
      resultado = JSON.parse(texto);
    } catch {
      console.error("JSON inválido retornado pela IA:", texto);
      return res.status(502).json({
        erro: "A IA respondeu, mas o JSON retornado não pôde ser interpretado.",
        resposta_bruta: texto.slice(0, 1500)
      });
    }

    const booleanFields = [
      "rotacao",
      "hipoinspiracao",
      "exposicao_inadequada",
      "hiperinsuflacao",
      "espessamento_peribronquico",
      "opacidades_intersticiais",
      "consolidacao",
      "multilobar",
      "atelectasia",
      "derrame",
      "pneumotorax",
      "cavitacao",
      "cardiomegalia_aparente"
    ];

    for (const campo of booleanFields) {
      if (typeof resultado[campo] !== "boolean") resultado[campo] = false;
    }

    if (!Array.isArray(resultado.limitacoes)) resultado.limitacoes = [];
    if (!resultado.descricao) resultado.descricao = "Descrição não fornecida pela IA.";

    return res.status(200).json({
      sucesso: true,
      modelo: model,
      resultado
    });
  } catch (error) {
    console.error("Erro interno:", error);
    return res.status(500).json({
      erro: error?.message || "Erro interno inesperado."
    });
  }
}
