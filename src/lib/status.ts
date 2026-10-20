// 파스텔 톤 → Tailwind 클래스 매핑. 모든 배지/상태 칩이 이 토큰을 공유한다.
export type Tone =
  | "lavender" | "purple" | "pink" | "rose" | "sky" | "mint" | "cream" | "apricot" | "coral" | "slate";

export const toneClasses: Record<Tone, string> = {
  lavender: "bg-pastel-lavender text-pastel-lavenderInk",
  purple: "bg-pastel-purple text-pastel-purpleInk",
  pink: "bg-pastel-pink text-pastel-pinkInk",
  rose: "bg-pastel-rose text-pastel-roseInk",
  sky: "bg-pastel-sky text-pastel-skyInk",
  mint: "bg-pastel-mint text-pastel-mintInk",
  cream: "bg-pastel-cream text-pastel-creamInk",
  apricot: "bg-pastel-apricot text-pastel-apricotInk",
  coral: "bg-pastel-coral text-pastel-coralInk",
  slate: "bg-muted text-muted-foreground",
};
