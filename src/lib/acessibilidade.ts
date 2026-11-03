export const tamanhosFonte = { padrao: 100, grande: 125, muitoGrande: 150 } as const;
export type TamanhoFonte = keyof typeof tamanhosFonte;
export function validarTamanhoFonte(value: string | null): TamanhoFonte {
  return value !== null && Object.hasOwn(tamanhosFonte, value) ? (value as TamanhoFonte) : "padrao";
}
export function aplicarTamanhoFonte(tamanho: TamanhoFonte) {
  document.documentElement.style.fontSize = `${tamanhosFonte[tamanho]}%`;
  document.documentElement.dataset["fonte"] = tamanho;
}
export const chaveFonte = (id: string) => `libens-fonte:${id}`;
