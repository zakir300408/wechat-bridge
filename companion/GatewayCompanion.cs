using System;
using System.IO;
using System.Diagnostics;
using System.Drawing;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Text;

// The tray owns the connector process. No window is needed for everyday use.
class GatewayCompanion : ApplicationContext {
 readonly string dir = AppDomain.CurrentDomain.BaseDirectory;
 readonly NotifyIcon tray = new NotifyIcon();
 readonly Control dispatcher = new Control();
 readonly System.Windows.Forms.Timer timer = new System.Windows.Forms.Timer();
 readonly ToolStripMenuItem state = new ToolStripMenuItem("Starting...");
 readonly ToolStripMenuItem startup = new ToolStripMenuItem("Start with Windows");
 readonly EventWaitHandle pageEvent, quitEvent;
 readonly Dictionary<string,object> cfg;
 readonly HashSet<Process> helpers = new HashSet<Process>();
 Process running;
 bool closing, wanted = true, connected, pagePending, initializing;
 DateTime retryAt = DateTime.MinValue;
 string gateway = "https://wechat.clonemeup.com";
 string StartupFile { get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "WeChatBridge.lnk"); } }

 static string Q(string s) { return "\"" + s.Replace("\"", "\\\"") + "\""; }
 ProcessStartInfo Info(string args, bool visible) {
  var p = new ProcessStartInfo((string)cfg["node"], args) { WorkingDirectory = dir, UseShellExecute = false, CreateNoWindow = !visible };
  p.EnvironmentVariables["WECHAT_COMPANION_SETTINGS"] = Path.Combine(dir, "settings.json");
  p.EnvironmentVariables["COMPANION_NO_BROWSER"] = "1";
  p.EnvironmentVariables["COMPANION_QUIET"] = "1";
  return p;
 }
 void OnUI(Action action) {
  if (closing) return;
  try { dispatcher.BeginInvoke((Action)(() => { if (!closing) action(); })); } catch (InvalidOperationException) { }
 }
 void Status(string text) { state.Text = text; tray.Text = "WeChat Bridge — " + text; }
 void Notify(string text) { tray.ShowBalloonTip(6000, "WeChat Bridge", text, ToolTipIcon.Info); }
 void Send(string command) {
  try { if (running != null && !running.HasExited) { running.StandardInput.WriteLine(command); running.StandardInput.Flush(); } }
  catch (InvalidOperationException) { connected = false; }
  catch (IOException) { connected = false; }
 }
 void OpenPage() {
  pagePending = true;
  if (connected) { pagePending = false; Send("open-page"); }
  else { wanted = true; Connect(); }
 }
 void Connect() {
  if (closing || initializing || (running != null && !running.HasExited)) return;
  if (running != null) { running.Dispose(); running = null; }
  wanted = true; connected = false; Status("Connecting");
  try {
   var p = Info(Q(Path.Combine(dir, "connector.mjs")) + " " + Q(gateway), false);
   p.RedirectStandardInput = p.RedirectStandardOutput = p.RedirectStandardError = true;
   var child = new Process { StartInfo = p, EnableRaisingEvents = true };
   child.OutputDataReceived += (s,e) => { if (e.Data != null) OnUI(() => {
    if (running != child) return;
    if (e.Data.StartsWith("Connected.")) {
     connected = true; Status("Connected");
     if (pagePending) { pagePending = false; Send("open-page"); }
    } else if (e.Data.StartsWith("Connection interrupted")) { connected = false; Status("Reconnecting"); }
   }); };
   // Keep backend diagnostics out of notifications and files.
   child.ErrorDataReceived += (s,e) => { };
   child.Exited += (s,e) => OnUI(() => {
    if (running != child) return;
    connected = false; retryAt = DateTime.UtcNow.AddSeconds(30);
    Status(wanted ? "Offline — retrying" : "Disconnected");
   });
   running = child; child.Start(); child.BeginOutputReadLine(); child.BeginErrorReadLine();
  } catch {
   if (running != null) { running.Dispose(); running = null; }
   retryAt = DateTime.UtcNow.AddSeconds(30); Status("Offline — retrying");
  }
 }
 void Disconnect() {
  connected = false;
  if (running != null) {
   var child = running;
   try {
    if (!child.HasExited) {
     Send("stop");
     if (!child.WaitForExit(5000)) {
      using (var kill = Process.Start(new ProcessStartInfo("taskkill.exe", "/PID " + child.Id + " /T /F") { UseShellExecute = false, CreateNoWindow = true })) { kill.WaitForExit(5000); }
     }
    }
   } catch (InvalidOperationException) { } catch (IOException) { }
   running = null; child.Dispose();
  }
  if (!closing) Status("Disconnected");
 }
 async Task<bool> CheckLocal() {
  try {
   var info = Info(Q(Path.Combine(dir, "server.mjs")) + " --check", false);
   info.RedirectStandardOutput = info.RedirectStandardError = true;
   using (var child = Process.Start(info)) {
    helpers.Add(child);
    try {
    var output = child.StandardOutput.ReadToEndAsync(); var errors = child.StandardError.ReadToEndAsync();
    if (!await Task.Run(() => child.WaitForExit(60000))) { child.Kill(); return false; }
    await Task.WhenAll(output, errors);
    return child.ExitCode == 0;
    } finally { helpers.Remove(child); }
   }
  } catch { return false; }
 }
 async void Initialize() {
  if (initializing || closing) return;
  initializing = true; Disconnect(); Status("WeChat setup");
  try {
   using (var child = Process.Start(Info(Q(Path.Combine((string)cfg["weflowRoot"], "cli.cjs")) + " init", true))) {
    helpers.Add(child);
    try { await Task.Run(() => child.WaitForExit()); } finally { helpers.Remove(child); }
   }
   if (!closing && !await CheckLocal()) Notify("WeChat setup is incomplete. Right-click the tray icon and choose Set up WeChat to try again.");
  } catch { if (!closing) Notify("Could not open WeChat setup. Run the setup command again."); }
  finally { initializing = false; if (!closing && wanted) Connect(); }
 }
 async void FirstSetup() {
  bool ready = await CheckLocal();
  initializing = false;
  if (ready) { if (!closing) Connect(); }
  else if (!closing) { Notify("Follow the WeChat setup window. Your connection page will open when setup is complete."); Initialize(); }
 }
 void SetStartup(bool enable) {
  try {
   if (enable) {
    // A shortcut avoids cmd.exe expansion of unusual user-profile characters.
    var type = Type.GetTypeFromProgID("WScript.Shell");
    dynamic shell = Activator.CreateInstance(type);
    dynamic shortcut = shell.CreateShortcut(StartupFile);
    shortcut.TargetPath = Application.ExecutablePath; shortcut.Arguments = "--background"; shortcut.WorkingDirectory = dir; shortcut.Save();
   } else if (File.Exists(StartupFile)) File.Delete(StartupFile);
   startup.Checked = File.Exists(StartupFile);
   File.WriteAllText(Path.Combine(dir, "startup-preference.json"), new JavaScriptSerializer().Serialize(new { enabled = startup.Checked }));
  } catch { Notify("Could not change Windows startup settings."); }
 }
 ToolStripMenuItem Item(string label, Action action) {
  var item = new ToolStripMenuItem(label);
  item.Click += (s,e) => { try { action(); } catch { Notify("That action failed. Try again or run setup to repair the installation."); } };
  return item;
 }
 public GatewayCompanion(bool setup, EventWaitHandle page, EventWaitHandle quit) {
  pageEvent = page; quitEvent = quit; pagePending = setup;
  cfg = new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(Path.Combine(dir,"settings.json")));
  string preferences = Path.Combine(dir,"gateway-preferences.json");
  if (File.Exists(preferences)) {
   var saved = new JavaScriptSerializer().Deserialize<Dictionary<string,string>>(File.ReadAllText(preferences));
   Uri value;
   if (!Uri.TryCreate(saved["gateway"], UriKind.Absolute, out value) || value.Scheme != "https" || value.AbsolutePath != "/" || value.UserInfo != "" || value.Query != "" || value.Fragment != "") throw new InvalidDataException();
   gateway = value.GetLeftPart(UriPartial.Authority);
  }
  var handle = dispatcher.Handle;
  var menu = new ContextMenuStrip(); state.Enabled = false; menu.Items.Add(state); menu.Items.Add(new ToolStripSeparator());
  menu.Items.Add(Item("Open connection page", OpenPage));
  menu.Items.Add(Item("Connect", () => { wanted = true; Connect(); }));
  menu.Items.Add(Item("Disconnect", () => { wanted = false; pagePending = false; Disconnect(); }));
  menu.Items.Add(Item("Check WeChat", async () => Notify(await CheckLocal() ? "Local WeChat access works." : "WeChat access is unavailable. Choose Set up WeChat from this menu.")));
  menu.Items.Add(Item("Set up WeChat", () => { wanted = true; Initialize(); }));
  menu.Items.Add(Item("Reset private link", () => { if (connected) Send("reset-link"); else Notify("Connect before resetting your link."); }));
  startup.Checked = File.Exists(StartupFile); startup.Click += (s,e) => SetStartup(!startup.Checked); menu.Items.Add(startup);
  menu.Items.Add(new ToolStripSeparator()); menu.Items.Add(Item("Quit", ExitThread));
  tray.Icon = SystemIcons.Application; tray.ContextMenuStrip = menu; tray.Text = "WeChat Bridge"; tray.Visible = true;
  tray.DoubleClick += (s,e) => OpenPage();
  timer.Interval = 500; timer.Tick += (s,e) => {
   if (quitEvent.WaitOne(0)) { ExitThread(); return; }
   if (pageEvent.WaitOne(0)) OpenPage();
   if (wanted && !initializing && (running == null || running.HasExited) && DateTime.UtcNow >= retryAt) Connect();
  };
  if (setup) { initializing = true; Task.Delay(1).ContinueWith(t => OnUI(FirstSetup)); }
  else Connect();
  timer.Start();
 }
 protected override void ExitThreadCore() {
  if (closing) return;
  closing = true; wanted = false; timer.Stop(); Disconnect(); tray.Visible = false;
  foreach (var child in helpers) {
   try { if (!child.HasExited) using (var kill = Process.Start(new ProcessStartInfo("taskkill.exe", "/PID " + child.Id + " /T /F") { UseShellExecute = false, CreateNoWindow = true })) { kill.WaitForExit(5000); } }
   catch (InvalidOperationException) { }
  }
  tray.Dispose(); timer.Dispose(); dispatcher.Dispose(); base.ExitThreadCore();
 }
 [STAThread] static void Main(string[] args) {
  Application.EnableVisualStyles();
  string identity;
  using (var sha = SHA256.Create()) { identity = BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(AppDomain.CurrentDomain.BaseDirectory.ToUpperInvariant()))).Replace("-", "").Substring(0,24); }
  string name = "Local\\WeChatBridge-" + identity;
  bool first;
  using (var mutex = new Mutex(true, name, out first))
  using (var page = new EventWaitHandle(false, EventResetMode.AutoReset, name + "-page"))
  using (var quit = new EventWaitHandle(false, EventResetMode.AutoReset, name + "-quit")) {
   bool setup = Array.IndexOf(args,"--setup") >= 0, showPage = Array.IndexOf(args,"--page") >= 0, stop = Array.IndexOf(args,"--quit") >= 0;
   if (!first) { if (stop) quit.Set(); else if (setup || showPage) page.Set(); return; }
   if (stop) return;
   try { Application.Run(new GatewayCompanion(setup || showPage, page, quit)); }
   catch { MessageBox.Show("Run the WeChat Bridge setup command to repair this installation.", "WeChat Bridge"); }
  }
 }
}
