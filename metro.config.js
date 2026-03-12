const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const { createProxyMiddleware } = require("http-proxy-middleware");

config.server = config.server || {};
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    if (req.url.startsWith("/api") || req.url.startsWith("/ws/")) {
      return createProxyMiddleware({
        target: "http://localhost:3001",
        changeOrigin: false,
        ws: true,
        on: {
          error: (err, _req, res) => {
            res.writeHead(502, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Backend unavailable", detail: err.message }));
          },
        },
      })(req, res, next);
    }
    return middleware(req, res, next);
  };
};

config.resolver = config.resolver || {};
config.resolver.blockList = [
  /[/\\]\.local[/\\].*/,
];

module.exports = config;
