# CAIRA contract captures

Live JSON captured from UAT (`https://uat-api.milescaira.com`), used to check the API reference
against reality before binding each phase. The reference is precise, but several shapes in it are
documented from source code rather than from a response, and three are explicitly out of its scope.

| Host | Origin                           |
| ---- | -------------------------------- |
| Prod | `https://api.milescaira.com`     |
| UAT  | `https://uat-api.milescaira.com` |

There is **no `/api/` prefix** — routes are registered at the Django URLconf root.

## Captured

| File                     | Endpoint                         | Auth       | Verdict                                  |
| ------------------------ | -------------------------------- | ---------- | ---------------------------------------- |
| `00-auth-failures.json`  | `caira/levels_progress/`         | none / bad | matches reference §0.1                   |
| `01-top-section.json`    | #1 `Top_Section/`                | optional   | matches — 3 top-level keys, 8 item keys  |
| `02-course-section.json` | #2 `Masterclass_Course_Section/` | optional   | matches — 5 top-level keys, 11 item keys |

### What the captures confirmed

- **Auth failures return 403, not 401**, for all three modes — no credentials, undecodable token,
  malformed header — each with a DRF `{"detail": …}` body. This is reference §0.1's
  `authenticate_header()` caveat, and it is the single assumption `authInterceptor` rests on.
- **CORS**: `access-control-allow-headers` lists `content-type` and `authorization` but **not**
  `x-app-type`, `x-platform` or `x-country-code`. The deleted `appInterceptor` sent all three on
  every request, so the browser would have rejected every call. `access-control-allow-origin` echoes
  the requesting origin and `allow-credentials` is `true`.
- **A non-canonical UUID in a path param returns a 404 with `text/html`**, not the JSON envelope —
  Django's URL converter rejects it before the view runs. `cairaError` handles a string body.
- The hardcoded copy is verbatim, including the space in `"Expert- led CAIRA Level 1 …"`.

## Still to capture — needs a real UAT token

Everything from #3 onward requires a JWT. The three that **block implementation** rather than merely
confirming it, because the reference explicitly places them outside its scope:

| Shape                                        | Blocks                 | Lives in                     |
| -------------------------------------------- | ---------------------- | ---------------------------- |
| `CAIRAMasterclassQuizQuestionSerializer`     | P5 quiz (#7, #9)       | `Masterclass/serializers.py` |
| `CAIRAMasterclassFeedbackQuestionSerializer` | P5 feedback (#12)      | `Masterclass/serializers.py` |
| `_build_full_course_progress` key set        | P4 progress (#17, #18) | `Masterclass/views.py`       |

Also unresolved and blocking P8: the QR crypto contract (curve, KDF, AES mode, `public_key`
encoding) in `account/qr_login/crypto.py`, plus `store.SESSION_TTL` and the `make_pin()` format.

## Re-capturing

```bash
API=https://uat-api.milescaira.com
curl -s "$API/CAIRA_LMS_Masterclass_MilesOne_Web/Top_Section/?limit=2" | python3 -m json.tool
curl -s -H "Authorization: Bearer $TOKEN" "$API/CAIRA_LMS_Masterclass_MilesOne_Web/caira/levels_progress/" | python3 -m json.tool
```

Never commit a real token, and never capture a response containing another user's PII.
