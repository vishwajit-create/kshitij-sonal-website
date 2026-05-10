const https = require("https");
const params = new URLSearchParams({
  code: "4/0AeoWuM8TkbDpUAEI6_JVGS9nGMNCTzAJsaSkMerMMJZN6c8R3IMn8_-KbsJ9SU62nBW-Yg",
  client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com",
  client_secret: "j9iVZfS7aaFr7y-MunAmE2c",
  redirect_uri: "http://localhost:9005",
  grant_type: "authorization_code"
});
const body = params.toString();
const options = {
  hostname: "oauth2.googleapis.com",
  path: "/token",
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": body.length }
};
const req = https.request(options, res => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => console.log(data));
});
req.on("error", e => console.error(e));
req.write(body);
req.end();
