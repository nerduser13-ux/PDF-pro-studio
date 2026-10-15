const { app, BrowserWindow } = require("electron");
const path = require("path");

// Optimize V8 memory flags for low-RAM machines (4GB RAM PCs)
// Prevent Chromium from ballooning cache and heap memory
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=512 --expose-gc");
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
app.commandLine.appendSwitch("disable-background-timer-throttling");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true,
    },
  });

  win.loadFile(path.join(__dirname, "../dist/index.html"));

  // Clean memory when minimized or hidden
  win.on("minimize", () => {
    if (global.gc) {
      try { global.gc(); } catch (e) {}
    }
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
