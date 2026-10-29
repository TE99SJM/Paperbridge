import { PROVIDERS, safeBaseUrl } from "./core.js";

export function providerRequest(settings, prompt) {
  const provider = PROVIDERS[settings.provider];
  if (!provider) throw new Error("Choose a supported provider.");
  const base = safeBaseUrl(settings.apiBase);
  if (settings.provider !== "custom" && settings.provider !== "ollama" && base !== provider.base) {
    throw new Error("The preset API host has changed. Choose Custom only if you trust that service, then enter its own key.");
  }
  const model = settings.model?.trim();
  if (!model || model.length > 200) throw new Error("Choose or enter a model ID in AI connection.");
  if (!settings.apiKey?.trim() && settings.provider !== "ollama" && settings.provider !== "custom") throw new Error("Add an API key in AI connection. Chat website passwords are not API keys.");
  const headers = { "Content-Type": "application/json" };
  if (provider.protocol === "anthropic") {
    headers["x-api-key"] = settings.apiKey.trim();
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
    return { url: base + "/messages", headers, body: { model, max_tokens: 12000, messages: [{ role: "user", content: prompt }] }, protocol: "anthropic" };
  }
  if (settings.apiKey?.trim()) headers.Authorization = `Bearer ${settings.apiKey.trim()}`;
  if (provider.protocol === "responses") {
    return { url: base + "/responses", headers, body: { model, store: false, input: [{ role: "user", content: prompt }] }, protocol: "responses" };
  }
  return { url: base + "/chat/completions", headers, body: { model, stream: false, messages: [{ role: "user", content: prompt }] }, protocol: "chat" };
}

async function checkedJson(response) {
  const text = await response.text();
  if (text.length > 2000000) throw new Error("Provider response exceeded the safety limit.");
  let result;
  try { result = JSON.parse(text); } catch { throw new Error(`The service returned non-JSON data (HTTP ${response.status}). Check the API base URL.`); }
  if (!response.ok) {
    // Do not echo raw provider errors: some gateways reflect prompts or credentials.
    const code = String(result?.error?.code || result?.error?.type || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 100);
    const detail = response.status === 401 || response.status === 403 ? "Check the key, model access, and account permissions." :
      response.status === 429 ? "Check the provider's rate limit, credits, or usage allowance." : "Check the model ID and API settings.";
    throw new Error(`Provider request failed (HTTP ${response.status}${code ? `, ${code}` : ""}). ${detail}`);
  }
  return result;
}

export async function callProvider(settings, prompt, signal, fetchImpl = fetch) {
  const req = providerRequest(settings, prompt);
  const result = await checkedJson(await fetchImpl(req.url, {
    method: "POST", headers: req.headers, body: JSON.stringify(req.body),
    credentials: "omit", redirect: "error", signal
  }));
  let text;
  if (req.protocol === "anthropic") {
    if (result.stop_reason === "max_tokens") throw new Error("The provider ran out of output space. Scan a smaller section or use a different model.");
    text = result.content?.filter(c => c.type === "text").map(c => c.text).join("\n");
  } else if (req.protocol === "responses") {
    if (result.status !== "completed") throw new Error("The provider did not complete the answer. No partial response was accepted.");
    text = result.output?.flatMap(x => x.content || []).filter(c => c.type === "output_text").map(c => c.text).join("\n");
  } else {
    const choice = result.choices?.[0];
    if (choice?.finish_reason && !["stop", "end_turn"].includes(choice.finish_reason)) throw new Error("The provider returned an incomplete or refused answer. No partial response was accepted.");
    text = choice?.message?.content;
    if (Array.isArray(text)) text = text.filter(x => x.type === "text").map(x => x.text).join("\n");
  }
  if (typeof text !== "string" || !text.trim()) throw new Error("The provider did not return text answers. It may have refused or used an unsupported response format.");
  return text;
}

export async function listModels(settings, signal, fetchImpl = fetch) {
  const provider = PROVIDERS[settings.provider];
  const base = safeBaseUrl(settings.apiBase);
  if (!provider) throw new Error("Choose a provider.");
  if (!["custom", "ollama"].includes(settings.provider) && base !== provider.base) throw new Error("Preset API host mismatch.");
  const headers = {};
  if (provider.protocol === "anthropic") {
    headers["x-api-key"] = settings.apiKey;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  } else if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;
  const data = await checkedJson(await fetchImpl(base + "/models", { headers, credentials: "omit", redirect: "error", signal }));
  const models = (data.data || data.models || []).map(m => ({ id: m.id || m.slug || m.name, name: m.display_name || m.id || m.slug || m.name }));
  return models.filter(m => typeof m.id === "string").slice(0, 1000);
}
