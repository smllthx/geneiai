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
  if (msg.includes('sesion invalida') || msg.includes('invalid jwt') || msg.includes('jwt expired') || msg.includes('no autenticado')) {
    return 'La sesión ya no es válida. Vuelve a ingresar a GENEAI.';
  }
  if (msg.includes('funcion no desplegada') || msg.includes('function not found')) {
    return 'Esta función no está disponible en el servidor. Actualiza GENEAI y vuelve a intentar.';
  }
  if (msg.includes('abort') || msg.includes('timeout') || msg.includes('timed out')) {
    return 'La solicitud tardó demasiado. Comprueba si el cambio se guardó antes de repetirlo.';
  }
  if (functionName?.startsWith('familysearch-')) {
    if (msg.includes('client id') || msg.includes('no configurado')) return 'La autorización de FamilySearch aún requiere configurar su aplicación oficial en el servidor.';
    if (msg.includes('failed to fetch') || msg.includes('non-2xx')) return 'No se pudo conectar con FamilySearch. Comprueba la conexión y vuelve a intentar.';
    return String(raw);
  }
  if (msg.includes('failed to fetch') || msg.includes('networkerror')) return 'No se pudo contactar al servidor. Comprueba la conexión y vuelve a intentar.';
  const label = functionName ? `La opción IA “${functionName}”` : "La función de IA";

  if (
    msg.includes("openai no configurado") ||
    msg.includes("api key") ||
    msg.includes("missing api") ||
    msg.includes("no configurado")
  ) {
    return "Falta activar ChatGPT: abre Configuración → IA, guarda tu API key de OpenAI.";
  }

  if (
    msg.includes("invalid_api_key") ||
    msg.includes("incorrect api key") ||
    msg.includes("openai unauthorized")
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
