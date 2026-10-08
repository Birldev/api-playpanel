/**
 * Gera um nome de usuário aleatório de 12 a 20 caracteres
 */
export function generateRandomUser(len = 12): string {
  const safeLength = Math.max(12, Math.min(20, len));
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789";
  let result = "";
  for (let i = 0; i < safeLength; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Gera uma senha aleatória segura contendo maiúscula, minúscula, número e símbolo
 */
export function generateRandomPass(len = 12): string {
  const safeLength = Math.max(12, Math.min(20, len));
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const nums = "123456789";
  const spec = "@";

  const pick = (set: string, count: number) => {
    let out = "";
    for (let i = 0; i < count; i++) {
      out += set.charAt(Math.floor(Math.random() * set.length));
    }
    return out;
  };

  const remaining = Math.max(0, safeLength - 12);
  const chars =
    pick(lower, 4) +
    pick(upper, 4) +
    pick(nums, 3) +
    pick(spec, 1) +
    pick(lower + upper + nums, remaining);

  return chars
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

/**
 * Retorna os links padrão de reprodução e DNS do servidor Play Panel
 */
export function buildPlayerLinks(username: string, password: string) {
  const baseDns = "http://exz75.link:80";
  return {
    dns: {
      smarters_xciptv: baseDns,
      stb_novo: "212.102.61.90",
      stb_antigo: "212.102.61.91",
      webplayer: "http://eyplayer.io",
      epg: "http://eyepg.io/",
    },
    playlists: {
      mpegts: `http://exz75.link/get.php?username=${username}&password=${password}&type=m3u_plus&output=ts`,
      hls: `http://exz75.link/get.php?username=${username}&password=${password}&type=m3u_plus&output=m3u8`,
      ssiptv_ts: `http://exz75.link/get.php?username=${username}&password=${password}&type=ss&output=ts`,
      ssiptv_hls: `http://exz75.link/get.php?username=${username}&password=${password}&type=ss&output=m3u8`,
    },
  };
}
