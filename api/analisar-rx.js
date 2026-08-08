export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb"
    }
  }
};


export default async function handler(req, res) {

  /*
   * Evita cache da resposta.
   */

  res.setHeader(
    "Cache-Control",
    "no-store"
  );


  /*
   * Apenas POST.
   */

  if (
    req.method !==
    "POST"
  ) {

    return res
      .status(405)
      .json({
        erro:
          "Método não permitido. Use POST."
      });

  }


  try {

    /*
     * Chave armazenada somente
     * nas Environment Variables
     * da Vercel.
     */

    const apiKey =
      process.env.OPENAI_API_KEY;


    if (
      !apiKey
    ) {

      return res
        .status(500)
        .json({
          erro:
            "OPENAI_API_KEY não está configurada neste deployment da Vercel."
        });

    }


    /*
     * A Vercel normalmente
     * já entrega req.body como
     * objeto quando Content-Type
     * é application/json.
     */

    let body =
      req.body ||
      {};


    /*
     * Fallback caso venha como string.
     */

    if (
      typeof body ===
      "string"
    ) {

      try {

        body =
          JSON.parse(
            body
          );

      }
      catch {

        return res
          .status(400)
          .json({
            erro:
              "O corpo JSON da requisição é inválido."
          });

      }

    }


    /*
     * IMPORTANTE:
     *
     * O index.html envia:
     *
     * {
     *   imageDataUrl: "data:image/jpeg;base64,..."
     * }
     *
     * Por isso imageDataUrl vem primeiro.
     */

    const imagem =

      body.imageDataUrl ||

      body.imagem ||

      body.image ||

      body.imageData ||

      body.dataUrl;


    if (
      !imagem
    ) {

      return res
        .status(400)
        .json({
          erro:
            "Nenhuma imagem foi recebida. Era esperado o campo imageDataUrl."
        });

    }


    if (
      typeof imagem !==
      "string"
    ) {

      return res
        .status(400)
        .json({
          erro:
            "O campo imageDataUrl precisa ser uma string."
        });

    }


    if (
      !imagem.startsWith(
        "data:image/"
      )
    ) {

      return res
        .status(400)
        .json({
          erro:
            "Formato de imagem inválido. Era esperada uma Data URL de imagem."
        });

    }


    /*
     * Limite adicional simples.
     *
     * Isso evita enviar arquivos
     * enormes sem necessidade.
     */

    if (
      imagem.length >
      9_000_000
    ) {

      return res
        .status(413)
        .json({
          erro:
            "A imagem ficou grande demais. Tente uma imagem menor."
        });

    }


    const prompt = `
Você está auxiliando um médico na PRÉ-LEITURA de uma radiografia de tórax.

A imagem pode ser pediátrica.

Analise SOMENTE o que é visualmente avaliável na radiografia.

REGRAS IMPORTANTES:

- Não determine antibioticoterapia.
- Não diga que a imagem confirma etiologia viral ou bacteriana.
- Não invente achados.
- Não trate ausência de visualização adequada como ausência de doença.
- Se houver limitação técnica importante, descreva-a.
- Diferencie um achado identificado de um achado não identificado.
- Seja conservador em achados duvidosos.
- A interpretação será revisada por médico.
- Não inclua nome de paciente ou outros identificadores.
- Não escreva explicações fora do JSON.

Avalie:

1. qualidade técnica;
2. incidência aparente;
3. rotação;
4. hipoinspiração;
5. exposição/penetração inadequada;
6. hiperinsuflação pulmonar;
7. espessamento peribrônquico/perihilar;
8. opacidades intersticiais/perihilares;
9. consolidação focal/alveolar;
10. localização da consolidação, se identificada;
11. acometimento multilobar/extenso;
12. atelectasia;
13. derrame pleural;
14. pneumotórax;
15. cavitação/pneumatoceles;
16. aumento aparente da silhueta cardíaca;
17. outros achados relevantes;
18. limitações da interpretação.

Na descrição final:
- use linguagem radiológica objetiva;
- não declare etiologia viral/bacteriana;
- se não houver consolidação, diga apenas que não foi identificada consolidação focal evidente;
- se houver limitações, deixe isso explícito.

Retorne SOMENTE JSON válido no seguinte formato:

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

Os campos booleanos devem ser true ou false.

"qualidade" deve ser:
- adequada
- limitada
- inadequada

"incidencia" deve ser:
- AP
- PA
- AP supino
- lateral
- indeterminada

"confianca" deve ser:
- baixa
- moderada
- alta
`;


    /*
     * Modelo.
     *
     * Se você criar na Vercel:
     *
     * OPENAI_MODEL
     *
     * ele usa esse valor.
     *
     * Caso contrário:
     *
     * gpt-5.6
     */

    const model =
      process.env.OPENAI_MODEL ||
      "gpt-5.6";


    /*
     * Chamada oficial à
     * Responses API.
     */

    const response =
      await fetch(
        "https://api.openai.com/v1/responses",
        {

          method:
            "POST",

          headers: {

            "Authorization":
              `Bearer ${apiKey}`,

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify({

              model:
                model,

              /*
               * Para esta tarefa,
               * não precisamos de
               * reasoning alto.
               */

              reasoning: {
                effort:
                  "low"
              },

              input: [

                {

                  role:
                    "user",

                  content: [

                    {

                      type:
                        "input_text",

                      text:
                        prompt

                    },

                    {

                      type:
                        "input_image",

                      image_url:
                        imagem,

                      detail:
                        "high"

                    }

                  ]

                }

              ],

              max_output_tokens:
                2000

            })

        }
      );


    /*
     * Pega texto bruto primeiro,
     * para conseguirmos mostrar
     * erros reais da OpenAI.
     */

    const raw =
      await response.text();


    let dados;


    try {

      dados =
        raw
        ?
        JSON.parse(
          raw
        )
        :
        {};

    }
    catch {

      console.error(
        "Resposta não JSON da OpenAI:",
        raw
      );


      return res
        .status(502)
        .json({
          erro:
            "A OpenAI respondeu em formato inesperado.",
          detalhe:
            raw.slice(
              0,
              500
            )
        });

    }


    /*
     * Se a OpenAI retornou erro,
     * devolvemos a mensagem real.
     */

    if (
      !response.ok
    ) {

      console.error(
        "Erro da OpenAI:",
        dados
      );


      const mensagem =

        dados?.error?.message ||

        dados?.error?.code ||

        (
          "Erro da OpenAI. HTTP " +
          response.status
        );


      return res
        .status(
          response.status
        )
        .json({
          erro:
            mensagem
        });

    }


    /*
     * Extrair output_text.
     */

    let texto =
      "";


    if (
      typeof dados.output_text ===
      "string"
    ) {

      texto =
        dados.output_text;

    }


    /*
     * Fallback:
     *
     * percorre output[]
     */

    if (
      !texto &&
      Array.isArray(
        dados.output
      )
    ) {

      for (
        const item
        of dados.output
      ) {

        if (
          !Array.isArray(
            item.content
          )
        ) {

          continue;

        }


        for (
          const content
          of item.content
        ) {

          if (
            content.type ===
            "output_text" &&
            typeof content.text ===
            "string"
          ) {

            texto +=
              content.text;

          }

        }

      }

    }


    if (
      !texto
    ) {

      console.error(
        "Resposta sem output_text:",
        JSON.stringify(
          dados
        )
      );


      return res
        .status(502)
        .json({
          erro:
            "A OpenAI respondeu, mas não retornou texto interpretável."
        });

    }


    /*
     * Limpeza caso o modelo
     * tenha colocado ```json.
     */

    texto =
      texto
        .trim()
        .replace(
          /^```json\s*/i,
          ""
        )
        .replace(
          /^```\s*/i,
          ""
        )
        .replace(
          /\s*```$/i,
          ""
        )
        .trim();


    /*
     * Extrair somente o objeto
     * caso algum texto escape.
     */

    const inicio =
      texto.indexOf(
        "{"
      );


    const fim =
      texto.lastIndexOf(
        "}"
      );


    if (
      inicio >= 0 &&
      fim >
      inicio
    ) {

      texto =
        texto.slice(
          inicio,
          fim + 1
        );

    }


    let resultado;


    try {

      resultado =
        JSON.parse(
          texto
        );

    }
    catch (
      jsonError
    ) {

      console.error(
        "JSON inválido retornado:",
        texto
      );


      return res
        .status(502)
        .json({

          erro:
            "A IA respondeu, mas o JSON não pôde ser interpretado.",

          resposta_bruta:
            texto.slice(
              0,
              1500
            )

        });

    }


    /*
     * Normalizações mínimas.
     */

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


    for (
      const campo
      of booleanFields
    ) {

      if (
        typeof resultado[campo] !==
        "boolean"
      ) {

        resultado[campo] =
          false;

      }

    }


    if (
      !Array.isArray(
        resultado.limitacoes
      )
    ) {

      resultado.limitacoes =
        [];

    }


    /*
     * Sucesso.
     */

    return res
      .status(200)
      .json({

        sucesso:
          true,

        modelo:
          model,

        resultado:
          resultado

      });

  }
  catch (
    error
  ) {

    console.error(
      "Erro interno:",
      error
    );


    return res
      .status(500)
      .json({

        erro:
          error?.message ||
          "Erro interno inesperado."

      });

  }

}
