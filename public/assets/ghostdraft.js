// GhostDraft — UTF-8 safe Base64 encode/decode utilities
function gdEncode(str) {
  var bytes = new TextEncoder().encode(str);
  var bin = '';
  for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function gdDecode(b64) {
  try {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var decoded = new TextDecoder().decode(bytes);
    return decoded;
  } catch(e) {
    return b64;
  }
}
