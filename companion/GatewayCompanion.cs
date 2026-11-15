using System;
using System.IO;
using System.Diagnostics;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using System.Threading.Tasks;
using System.Collections.Generic;
class GatewayCompanion : Form {
 readonly string dir=AppDomain.CurrentDomain.BaseDirectory;
 readonly TextBox status=new TextBox(),gateway=new TextBox();
 readonly CheckBox startup=new CheckBox();
 Process running; Dictionary<string,object> cfg;
 const string DefaultGateway="https://wechat.clonemeup.com";
 string Settings { get {return Path.Combine(dir,"settings.json");} }
 static string Q(string s){return "\""+s.Replace("\"","\\\"")+"\"";}
 void LabelAt(string text,int y){Controls.Add(new Label{Text=text,Left=20,Top=y,Width=650,Height=40});}
 void ButtonAt(string label,int x,int y,Action action){var b=new Button{Text=label,Left=x,Top=y,Width=200,Height=34};b.Click+=(s,e)=>{try{action();}catch{status.Text="Action failed. Check local setup and permissions. No credentials logged.";}};Controls.Add(b);}
 ProcessStartInfo Info(string exe,string args,bool visible){var p=new ProcessStartInfo(exe,args){WorkingDirectory=dir,UseShellExecute=false,CreateNoWindow=!visible};p.EnvironmentVariables["WECHAT_COMPANION_SETTINGS"]=Settings;return p;}
 async void Check(){status.Text="Checking local WeChat access...";try{var p=Info((string)cfg["node"],Q(Path.Combine(dir,"server.mjs"))+" --check",false);p.RedirectStandardOutput=true;p.RedirectStandardError=true;using(var proc=Process.Start(p)){var output=proc.StandardOutput.ReadToEndAsync();var error=proc.StandardError.ReadToEndAsync();await Task.WhenAll(output,error);await Task.Run(()=>proc.WaitForExit());status.Text=proc.ExitCode==0?"Local WeChat access works. Click Connect to enable your private connection.":"WeChat access unavailable. Click Initialize WeChat, follow the setup window, then Check again.";}}catch{status.Text="Check failed. Rerun setup to repair dependencies.";}}
 void Connect(){
  if(running!=null&&!running.HasExited){status.Text="Connector is already running. Your private page opened when it started.";return;}
  Uri u;if(!Uri.TryCreate(gateway.Text,UriKind.Absolute,out u)||u.Scheme!="https"||u.AbsolutePath!="/"||u.UserInfo!=""||u.Query!=""||u.Fragment!=""){status.Text="Enter the HTTPS gateway origin supplied by your administrator.";return;}
  File.WriteAllText(Path.Combine(dir,"gateway-preferences.json"),new JavaScriptSerializer().Serialize(new{gateway=u.GetLeftPart(UriPartial.Authority)}));
  var p=Info((string)cfg["node"],Q(Path.Combine(dir,"connector.mjs"))+" "+Q(u.GetLeftPart(UriPartial.Authority)),false);p.RedirectStandardInput=true;p.RedirectStandardOutput=true;p.RedirectStandardError=true;
  running=Process.Start(p);status.Text="Starting private connector...";
  running.OutputDataReceived+=(s,e)=>{if(e.Data!=null&&!IsDisposed)BeginInvoke((Action)(()=>{status.AppendText("\r\n"+e.Data);}));};
  running.ErrorDataReceived+=(s,e)=>{if(e.Data!=null&&!IsDisposed)BeginInvoke((Action)(()=>{status.AppendText("\r\n"+e.Data);}));};running.BeginOutputReadLine();running.BeginErrorReadLine();
 }
 void Disconnect(){if(running!=null&&!running.HasExited){try{running.StandardInput.WriteLine("stop");running.StandardInput.Flush();if(!running.WaitForExit(5000)){var kill=Info("taskkill.exe","/PID "+running.Id+" /T /F",false);using(var p=Process.Start(kill)){p.WaitForExit(5000);}}}catch{}running.Dispose();running=null;}status.Text="Disconnected. This PC cannot serve reads until you connect again.";}
 public GatewayCompanion(){
  Text="WeChat Bridge — private read-only access";Width=740;Height=570;FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=false;
  cfg=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(File.ReadAllText(Settings));
  LabelAt("1. Check WeChat access on this computer",20);ButtonAt("Check connection",20,52,Check);
  ButtonAt("Initialize WeChat",240,52,()=>{Process.Start(Info((string)cfg["node"],Q(Path.Combine((string)cfg["weflowRoot"],"cli.cjs"))+" init",true));status.Text="Follow the WeFlow setup window. Initialization may require your WeChat login. Then Check again.";});
  LabelAt("2. Copy your private connection link into your chat app. Choose No authentication.",112);
  gateway.SetBounds(20,160,650,26);gateway.Text=DefaultGateway;gateway.Visible=false;Controls.Add(gateway);
  string preferences=Path.Combine(dir,"gateway-preferences.json");if(File.Exists(preferences)){var saved=new JavaScriptSerializer().Deserialize<Dictionary<string,string>>(File.ReadAllText(preferences));gateway.Text=saved["gateway"];}
  ButtonAt("Connect",20,205,Connect);ButtonAt("Disconnect",240,205,Disconnect);
  ButtonAt("Connection settings",460,205,()=>{gateway.Visible=!gateway.Visible;});
  LabelAt("Your private link is the credential. Anyone with it can read while this PC is connected. Keep it private; reset it below if you need a replacement.",255);
  ButtonAt("Reset private link",20,305,()=>{if(running==null||running.HasExited){status.Text="Connect first, then reset the private link.";return;}running.StandardInput.WriteLine("reset-link");running.StandardInput.Flush();status.Text="Replacing your private link. The updated connection page will open automatically.";});
  startup.Text="Connect automatically at Windows login";startup.SetBounds(240,310,440,26);Controls.Add(startup);
  string command=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup),"WeChatCompanion.cmd");startup.Checked=File.Exists(command);startup.CheckedChanged+=(s,e)=>{if(startup.Checked)File.WriteAllText(command,"@start \"\" "+Q(Application.ExecutablePath)+" --connect");else if(File.Exists(command))File.Delete(command);};
  status.SetBounds(20,355,680,145);status.Multiline=true;status.ReadOnly=true;status.ScrollBars=ScrollBars.Vertical;status.Text="Read-only. Requested messages and attachments pass through your gateway to the authorized client. Local credentials stay on this PC.";Controls.Add(status);
  FormClosing+=(s,e)=>Disconnect();
  Shown+=(s,e)=>Connect();
 }
 [STAThread]static void Main(){Application.EnableVisualStyles();try{Application.Run(new GatewayCompanion());}catch{MessageBox.Show("Run the companion setup command first to prepare this computer.");}}
}
