export default async function handler(req, res) {
  // Permitir somente POST
  if (req.method !== "POST") {
    return res.status(405).json({
      erro: "Método não permitido. Use POST."
    });
  }

  try {
    // Verifica chave
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        erro: "OPENAI_API_KEY não configurada na Vercel."
      });
    }

    // A Vercel já interpreta application/json
    const body = req.body || {};

    // Aceita alguns nomes para facilitar compatibilidade com o HTML
    const imagem =
      body.imagem ||
      body.image ||
      body.imageData ||
      body.dataUrl;

    if (!imagem) {
      return res.status(400).json({
        erro: "Nenhuma imagem foi recebida."
      });
    }

    if (
      typeof imagem !== "string" ||
      !imagem.startsWith("data:image/")
    ) {
      return res.status(400).json({
        erro: "Formato da imagem inválido. Envie uma imagem em Data URL/Base64."
      });
    }

    const prompt = `
Você está realizando uma PRÉ-LEITURA ASSISTIDA de uma radiografia de tórax.

Analise apenas aquilo que é visualmente avaliável na imagem.

IMPORTANTE:
- Não determine antibioticoterapia.
- Não conclua etiologia bacteriana ou viral apenas pela radiografia.
- Não invente achados.
- Se a qualidade da imagem impedir avaliação de algum item, informe isso.
- Diferencie "não identificado" de "não avaliável".
- A interpretação será obrigatoriamente revisada por um médico.

Avalie:

1. Qualidade técnica
2. Incidência aparente
3. Rotação
4. Grau de inspiração
5. Exposição/penetração
6. Hiperinsuflação pulmonar
7. Espessamento peribrônquico/perihilar
8. Opacidades intersticiais
9. Consolidação pulmonar focal
10. Localização da consolidação, se presente
11. Acometimento multilobar
12. Atelectasia
13. Derrame pleural
14. Pneumotórax
15. Cavitação, pneumatoceles ou sinais sugestivos de necrose
16. Silhueta cardíaca
17. Alterações ósseas grosseiras visíveis
18. Outros achados relevantes

Produza também uma descrição radiográfica curta, objetiva e apropriada para revisão médica.

Retorne SOMENTE JSON válido no seguinte formato:

{
  "qualidade": "adequada | limitada | inadequada",
  "incidencia": "AP | PA | AP supino | lateral | indeterminada",
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
  "confianca": "baixa | moderada | alta"
}
`;

    // Chamada à OpenAI
    const resposta = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },

        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5",

          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: prompt
                },
                {
                  type: "input_image",
                  image_url: imagem,
                  detail: "high"
                }
              ]
            }
          ],

          max_output_tokens: 1500
        })
      }
    );

    const dados = await resposta.json();

    // Erro retornado pela OpenAI
    if (!resposta.ok) {
      console.error("Erro OpenAI:", dados);

      return res.status(resposta.status).json({
        erro:
          dados?.error?.message ||
          "Erro ao solicitar análise à OpenAI."
      });
    }

    // Extrai texto retornado
    let texto = "";

    if (dados.output_text) {
      texto = dados.output_text;
    }

    // Fallback caso output_text não esteja presente
    if (!texto && Array.isArray(dados.output)) {
      for (const item of dados.output) {
        if (!Array.isArray(item.content)) continue;

        for (const content of item.content) {
          if (
            content.type === "output_text" &&
            typeof content.text === "string"
          ) {
            texto += content.text;
          }
        }
      }
    }

    if (!texto) {
      console.error("Resposta completa:", dados);

      return res.status(500).json({
        erro: "A IA respondeu, mas não retornou texto interpretável."
      });
    }

    // Remove eventual ```json
    texto = texto
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let resultado;

    try {
      resultado = JSON.parse(texto);
    } catch (erroJSON) {
      console.error("JSON inválido:", texto);

      return res.status(500).json({
        erro: "A IA respondeu, mas o JSON retornado não pôde ser interpretado.",
        resposta_bruta: texto
      });
    }

    // Retorna para o HTML
    return res.status(200).json({
      sucesso: true,
      resultado: resultado
    });

  } catch (erro) {
    console.error("Erro interno:", erro);

    return res.status(500).json({
      erro: erro?.message || "Erro interno ao analisar a radiografia."
    });
  }
}
