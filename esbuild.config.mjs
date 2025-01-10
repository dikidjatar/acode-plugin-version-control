import { exec } from "child_process";
import * as esbuild from "esbuild";
import { sassPlugin } from 'esbuild-sass-plugin'
const isServe = process.argv.includes("--serve");
const servePort = process.argv.find((arg) => arg.includes("--port="))?.split("=")[1] || 3000;
// Function to pack the ZIP file
function packZip() {
  exec("node .vscode/pack-zip.js", (err, stdout, stderr) => {
    if (err) {
      console.error("Error packing zip:", err);
      return;
    }
    console.log(stdout.trim());
  });
}

// Custom plugin to pack ZIP after build or rebuild
const zipPlugin = {
  name: "zip-plugin",
  setup(build) {
    build.onEnd(() => {
      packZip();
    });
  },
};

// Base build configuration
let buildConfig = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  minify: true,
  logLevel: "info",
  color: true,
  outdir: "dist",
  plugins: [zipPlugin, sassPlugin()]
};

// Main function to handle both serve and production builds
(async function () {
  if (isServe) {
    console.log("Starting development server...");

    // Watch and Serve Mode
    const ctx = await esbuild.context(buildConfig);

    await ctx.watch();
    const { host, port } = await ctx.serve({
      servedir: ".",
      port: parseInt(servePort),
    });

  } else {
    console.log("Building for production...");
    await esbuild.build(buildConfig);
    console.log("Production build complete.");
  }
})();
