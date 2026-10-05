# 006: Photo-first capture with honest, durable estimates

Date: 2026-10-05
Status: Implemented on feature branch/PR; production activation, physical-device and nutrition-quality gates pending

## Research and recommendation

MyFitnessPal's official Meal Scanner help documents camera/gallery input, suggested foods and explicit serving adjustment before logging. Its help/blog fetches were blocked (403); indexed official help excerpts establish the workflow, not hands-on testing or accuracy. Source: https://support.myfitnesspal.com/hc/en-us/articles/360045761612-How-to-use-the-Meal-Scanner .

Foodvisor's official site/store descriptions advertise photo recognition, quantity estimates and nutrition. This is evidence of the product flow, not independently verified precision. Source: https://www.foodvisor.io/en/ .

Cal AI's official site describes photo/text input and macro summaries, recommends lighting/focus, and acknowledges imperfect recognition in its FAQ. Depth-sensor/accuracy/user-count claims are vendor marketing; do not copy them as guarantees across ordinary Android/iPhone hardware. Source: https://www.calai.app/ . Search results for other similarly named apps were excluded rather than conflated with this product.

Peer-reviewed reviews identify food recognition, segmentation and portion/volume inference as distinct problems and emphasize representative datasets/evaluation. Indexed abstracts were accessible; full texts were blocked/unavailable, so no pooled precision claim is made. Sources: https://pubmed.ncbi.nlm.nih.gov/35803496/ and https://europepmc.org/article/pmc/pmc11607557 . Hidden oil/ghee, mixed gravies, scale and ingredient composition cannot be measured reliably from a single ordinary photo. OpenAI image/structured-output support is a capability, not proof of nutrition accuracy.

Recommendation: one still photo (or gallery), optional portion/context, save locally before network, then an in-place result showing image, calories/protein/carbs prominently, secondary fat/fibre, identified foods/portion guesses and assumptions. Corrections and explicit uncertainty are first-class. No depth/LiDAR requirement, video, social features, food database or app rewrite. The founder prioritizes camera as the flagship; typing remains a fallback and shares the same result screen.

## Capture and privacy

Use SDK-57-pinned Expo ImagePicker and ImageManipulator (both included in Expo Go). Request camera permission only when used; system image-only gallery picker does not need broad album access. Handle denial/cancellation without phantom meals. Disable microphone permission and avoid iOS crop UI known issues. Resize/re-encode locally to bounded JPEG; strip JPEG metadata explicitly, then place the sanitized asset in app documents before persisting its queued job. Original camera/gallery file is not moved or removed.

Ask explicit photo-processing consent before sending. Photos go only to the existing private owner-folder bucket, never public URLs or shared text cache. Backend derives the object path from authenticated owner/job ID, verifies size/JPEG/digest, then supplies one inline image to OpenAI. Cache namespaces for images are owner/job/digest/context scoped; a matching caption alone can never reuse a text estimate. Cleanup remote upload after processing attempt; interrupted/orphan uploads are pruned on the owner's next sync. This is not a guaranteed fixed-hour retention promise while every client is inactive or an anonymous session is lost. A scheduled service-side orphan sweeper/operator policy is a privacy hardening gate before a public pilot. Local photos remain until the user removes them. JSON export includes references/recognized data, not binary photo backup.

OpenAI API training is opt-in by default; store=false does not eliminate abuse-monitoring retention. State that distinction in consent. Reject non-food/refusal/incomplete output instead of inventing zero nutrition. Keep all five macros nullable while pending. Late results cannot overwrite corrected inputs; numeric overrides remain personal and never write shared cache.

## Reliability and review boundary

Results stay on screen during analysis, but navigation/log saving never waits for AI. Transient errors remain retrying until bounded retry exhaustion; offline jobs and photos survive reopen. Keep exact input/portion visible because changed phrasing can legitimately miss conservative cache keys. Founder observed 808/785 kcal under two distinct server keys; one key matches text with “and”. Exact original inputs remain needed to establish equivalence; do not pretend to have fixed an unreproduced same-key race.

Verification: 69 automated tests pass, including actual file/SQLite close/reopen, JPEG/path/digest/privacy checks, owner/job cache separation, non-food handling and bounded retry behavior. TypeScript, Deno entry check, SDK compatibility and both platform bundle exports pass. This is not physical camera/native storage or live image accuracy evidence.

Photo calls allow 4096 total output/reasoning tokens and reserve at least $0.02; text remains 2048 tokens with the configured $0.01 reservation. The existing total $1 cap is unchanged. Server PHOTO_API_ENABLED and client EXPO_PUBLIC_PHOTO_ESTIMATES_ENABLED default off; EXPO_PUBLIC_NUTRITION_FUNCTION permits an isolated same-project preview endpoint.

Existing foundation was explicitly approved for a normal push to main. This feature is a separate PR; no automatic main merge, production schema reset or deployment of unreviewed code. Preserve US$1 total test cap. Preview deployment and image tests must not increase that cap. Automated storage/transport/model tests are not camera permission, media persistence, accuracy, iOS/Android or standalone cold-start sign-off.
