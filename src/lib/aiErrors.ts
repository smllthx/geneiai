const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function friendlyAiErrorMessage(error: unknown, functionName?: string) {
  const raw =
    typeof error === "string"
      ? error
      : (error as any)?.message ??
        (error as any)?.error?.message ??
        (error as any)?.error ??
        (error as any)?.details ??
        "La IA no pudo procesar la solicitud.";
  const msg = normalize(raw);
  const label = functionName ? `La opción IA “${functionName}”` : "La función de IA";

  if (
    msg.includes("openai no configurado") ||
    msg.includes("api key") ||
    msg.includes("missing api") ||
    msg.includes("no configurado")
  ) {
    return "Falta activar ChatGPT: abre Configuración → IA, guarda tu API key de OpenAI y reinicia para aplicar el cambio.";
  }

  if (
    msg.includes("invalid_api_key") ||
    msg.includes("incorrect api key") ||
    msg.includes("401") ||
    msg.includes("unauthorized")
  ) {
    return "La API key de OpenAI no fue aceptada. Revisa que empiece con sk- y vuelve a guardarla en Configuración → IA.";
  }

  if (
    msg.includes("insufficient_quota") ||
    msg.includes("quota") ||
    msg.includes("limite alcanzado") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("402")
  ) {
    return "No quedan créditos o cuota disponible en OpenAI. Recarga billing en OpenAI o revisa los límites del proyecto.";
  }

  if (
    msg === "openai" ||
    msg.includes("ai 500") ||
    msg.includes("non-2xx") ||
    msg.includes("edge function") ||
    msg.includes("functionshttperror") ||
    msg.includes("failed to fetch") ||
    msg.includes("networkerror")
  ) {
    return `${label} no pudo procesar ahora. Revisa tu API key de OpenAI, cuota/créditos y conexión, y vuelve a intentar.`;
  }

  return String(raw);
}

export function isAiProviderOrCreditError(error: unknown) {
  const msg = normalize(
    typeof error === "string"
      ? error
      : (error as any)?.message ??
          (error as any)?.error?.message ??
          (error as any)?.error ??
          (error as any)?.details ??
          "",
  );
  return (
    msg.includes("openai") ||
    msg.includes("api key") ||
    msg.includes("chatgpt") ||
    msg.includes("credito") ||
    msg.includes("creditos") ||
    msg.includes("cuota") ||
    msg.includes("quota") ||
    msg.includes("402") ||
    msg.includes("429") ||
    msg.includes("non-2xx") ||
    msg.includes("edge function") ||
    msg.includes("functionshttperror") ||
    msg.includes("ai 500")
  );
}
