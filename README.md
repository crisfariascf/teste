# PAC Pediátrica + RX com IA — GitHub + Vercel

Projeto simples para quem já trabalha com HTML e GitHub.

## Estrutura

```
index.html
api/analisar-rx.js
package.json
.gitignore
.env.example
```

## Publicar em 5 passos

1. Crie um repositório novo no GitHub (ou uma pasta nova dentro de um repositório dedicado) e envie **index.html**, a pasta **api**, **package.json** e **.gitignore**.
2. Acesse https://vercel.com, entre com o GitHub, clique em **Add New > Project** e importe esse repositório.
3. Clique em **Deploy**. O HTML já será publicado, mas a análise por IA ainda dará erro até a chave ser configurada.
4. Na Vercel: **Project > Settings > Environment Variables**. Crie `OPENAI_API_KEY` e cole sua chave da API. Opcional: crie `OPENAI_MODEL` com `gpt-5.6`.
5. Faça **Redeploy** do projeto. Depois abra a URL da Vercel, carregue uma radiografia e clique em **ANALISAR RX COM IA**.

## Importante

- **Nunca** coloque sua chave `sk-...` dentro do `index.html`, `api/analisar-rx.js` ou de qualquer arquivo enviado ao GitHub.
- O GitHub Pages sozinho não executa `/api/analisar-rx`; use a URL fornecida pela Vercel para a versão com IA.
- A imagem é reduzida no navegador antes do envio para diminuir tamanho e custo.
- Use radiografias sem nome, prontuário ou outros identificadores quando possível e siga as regras institucionais/LGPD.
- A saída foi desenhada como pré-leitura para revisão médica, não como laudo autônomo nem decisão automática de antibioticoterapia.
