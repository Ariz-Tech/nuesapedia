// Avatar generation utilities for NuesaPedia
// Provides distinct, high-res random avatar styles for engineering students

const AVATAR_STYLES = [
  "adventurer",
  "bottts",
  "lorelei",
  "micah",
  "thumbs",
  "notionists",
  "avataaars",
];

const AVATAR_SEEDS = [
  "AdaLovelace",
  "Tesla",
  "Turing",
  "Faraday",
  "Newton",
  "Curie",
  "Maxwell",
  "Ohm",
  "Shannon",
  "Hopper",
  "Babbage",
  "Fourier",
  "Bernoulli",
  "Euler",
  "Pascal",
  "Gauss",
];

/**
 * Returns a randomly generated avatar URL with a random style and seed
 */
export function getRandomAvatar(customSeed?: string): string {
  const seed = customSeed || AVATAR_SEEDS[Math.floor(Math.random() * AVATAR_SEEDS.length)] + "_" + Math.floor(Math.random() * 10000);
  const style = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)];
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}

/**
 * Returns a list of sample avatar URLs for the user to choose or cycle through
 */
export function getAvatarPresets(): string[] {
  return [
    `https://api.dicebear.com/7.x/adventurer/svg?seed=EngineeringTunde&backgroundColor=b6e3f4`,
    `https://api.dicebear.com/7.x/bottts/svg?seed=RoboticsFolashade&backgroundColor=ffd5dc`,
    `https://api.dicebear.com/7.x/lorelei/svg?seed=CivilChinedu&backgroundColor=c0aede`,
    `https://api.dicebear.com/7.x/micah/svg?seed=ElectricalAmina&backgroundColor=ffdfbf`,
    `https://api.dicebear.com/7.x/thumbs/svg?seed=MechFemi&backgroundColor=d1d4f9`,
    `https://api.dicebear.com/7.x/notionists/svg?seed=SoftwareZainab&backgroundColor=b6e3f4`,
  ];
}
