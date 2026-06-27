Document AI encrypted credential artifact
========================================

Do not commit raw Google service-account JSON into git.

Use either:

1) Encrypted file artifact (repo):
- Place encrypted bytes at `.deploy.secrets/document-ai.json.enc`
- Keep decrypt passphrase only in server shared secrets (`DOCUMENT_AI_DECRYPT_KEY`)

2) Shared secret payload (preferred for hostinger):
- Put base64 encrypted payload in `shared/.deploy.secrets` as `DOCUMENT_AI_JSON_ENC_B64`
- Put decrypt key in `shared/.deploy.secrets` as `DOCUMENT_AI_DECRYPT_KEY`

Encryption command (run locally; produces binary `.enc`):

```bash
openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt \
  -in document-ai.json \
  -out document-ai.json.enc \
  -pass pass:"YOUR_STRONG_PASSPHRASE"
```

Optional base64 for `DOCUMENT_AI_JSON_ENC_B64`:

```bash
base64 -w 0 document-ai.json.enc
```

